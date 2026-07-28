import {
  calendarDaysBetween,
  localCalendarDay,
  parseDateToken,
  partsToUtcMs,
} from './dateParse';
import { extractDateCandidates } from './extractDate';
import { extractFieldCandidates } from './extractField';
import { normalizeFieldValue } from './normalize';
import { buildReceiptKey } from './receiptKey';
import type { ReceiptRules } from './rules.config';
import type {
  FieldCandidate,
  FieldCandidates,
  OcrDocument,
  ReceiptFieldName,
  ReceiptFields,
  RejectCode,
  ValidationMode,
  ValidationOutcome,
} from './types';

export interface ValidateInput {
  doc: OcrDocument;
  rules: ReceiptRules;
  /** Server clock, epoch ms. Injected so window tests are deterministic and the device clock is irrelevant. */
  nowMs: number;
  mode: ValidationMode;
  /** User corrections from the review screen. Callers MUST have checked these against the OCR text first. */
  overrides?: Partial<Record<ReceiptFieldName, string>>;
}

/**
 * Below this many lines, "no fields found" is reported as NOT_A_RECEIPT rather than a field problem:
 * the photo is a wall, a hand, or a blank page.
 */
const MIN_LINES_FOR_RECEIPT = 3;

/**
 * Minimum score accepted as a field value without user confirmation. Deliberately above the
 * pattern-scan score: the format patterns are permissive, so an unlabelled match would let a torn
 * invoice label silently claim "OUTLETS" as the invoice number. Such candidates still appear as
 * review chips; they just cannot become the answer on their own.
 */
const MIN_AUTO_ACCEPT_SCORE = 0.5;

/**
 * The best candidate acceptable without user confirmation. An unlabelled one scores below
 * MIN_AUTO_ACCEPT_SCORE and is only promoted when the rule sets `allowUnlabelled` — i.e. its pattern
 * is discriminating enough to stand alone. See rules.config.ts.
 */
function pickTop(
  candidates: readonly FieldCandidate[],
  allowUnlabelled: boolean,
): FieldCandidate | null {
  const top = candidates.length > 0 ? candidates[0]! : null;
  if (!top) return null;
  return top.score >= MIN_AUTO_ACCEPT_SCORE || allowUnlabelled ? top : null;
}

interface Resolved {
  value: string | null;
  confidence: number;
  corrected: boolean;
}

/**
 * A user override wins over OCR outright, at confidence 1 — a human confirmed it. Forgery is
 * prevented upstream by checking the override appears in the stored OCR text.
 */
function resolve(
  candidates: readonly FieldCandidate[],
  override: string | undefined,
  numericOnly: boolean,
  allowUnlabelled: boolean,
): Resolved {
  if (override !== undefined) {
    const value = normalizeFieldValue(override, numericOnly);
    return { value: value.length > 0 ? value : null, confidence: 1, corrected: true };
  }

  const top = pickTop(candidates, allowUnlabelled);
  if (!top) return { value: null, confidence: 0, corrected: false };
  return { value: top.value, confidence: top.confidence, corrected: false };
}

/** Window check. Returns null when the date is inside the claim window. */
function checkWindow(receiptMs: number, input: ValidateInput, hasTime: boolean): RejectCode | null {
  const { rules, nowMs } = input;
  const offset = rules.date.utcOffsetMinutes;

  if (hasTime) {
    if (receiptMs > nowMs + rules.window.futureToleranceSeconds * 1000) return 'DATE_FUTURE';
  } else {
    // With no printed time the receipt asserts a calendar DAY; comparing instants would call
    // today's own receipt "future" for most of the day.
    const receiptDay = localCalendarDay(receiptMs, offset);
    const today = localCalendarDay(nowMs, offset);
    if (calendarDaysBetween(today, receiptDay) > 0) return 'DATE_FUTURE';
  }

  const receiptDay = localCalendarDay(receiptMs, offset);
  const today = localCalendarDay(nowMs, offset);
  if (calendarDaysBetween(receiptDay, today) > rules.window.maxAgeDays) return 'DATE_EXPIRED';

  return null;
}

interface FieldOutcome {
  value: string | null;
  reject: RejectCode | null;
  confidence: number;
}

function validateSimpleField(
  resolved: Resolved,
  pattern: RegExp,
  missing: RejectCode,
  malformed: RejectCode,
): FieldOutcome {
  if (resolved.value === null) {
    return { value: null, reject: missing, confidence: 0 };
  }
  if (!pattern.test(resolved.value)) {
    return { value: resolved.value, reject: malformed, confidence: resolved.confidence };
  }
  return { value: resolved.value, reject: null, confidence: resolved.confidence };
}

function validateDateField(
  resolved: Resolved,
  input: ValidateInput,
): FieldOutcome & { ms: number | null } {
  if (resolved.value === null) {
    return { value: null, ms: null, reject: 'DATE_MISSING', confidence: 0 };
  }

  const parts = parseDateToken(resolved.value, input.rules.date.localeOrder);
  if (!parts) {
    return {
      value: resolved.value,
      ms: null,
      reject: 'DATE_UNPARSEABLE',
      confidence: resolved.confidence,
    };
  }

  const ms = partsToUtcMs(parts, input.rules.date.utcOffsetMinutes);
  const windowReject = checkWindow(ms, input, parts.hasTime);

  return {
    value: resolved.value,
    ms,
    reject: windowReject,
    confidence: resolved.confidence,
  };
}

export function validateReceipt(input: ValidateInput): ValidationOutcome {
  const { doc, rules, mode } = input;
  const overrides = input.overrides ?? {};

  const empty: FieldCandidates = {
    invoice_no: [],
    min: [],
    accn: [],
    tin: [],
    receipt_date: [],
  };

  if (doc.lines.length === 0) {
    return { status: 'rejected', reject: 'OCR_NO_TEXT', candidates: empty, confidence: 0 };
  }

  const candidates: FieldCandidates = {
    invoice_no: extractFieldCandidates(doc, rules.invoice),
    min: extractFieldCandidates(doc, rules.min),
    accn: extractFieldCandidates(doc, rules.accn),
    tin: extractFieldCandidates(doc, rules.tin),
    receipt_date: extractDateCandidates(doc, rules.date, input.nowMs),
  };

  // Nothing TRUSTWORTHY found — a page of pattern-scan noise is not a located field.
  const nothingFound =
    pickTop(candidates.invoice_no, rules.invoice.allowUnlabelled) === null &&
    pickTop(candidates.min, rules.min.allowUnlabelled) === null &&
    pickTop(candidates.receipt_date, rules.date.allowUnlabelled) === null;
  const noOverrides = Object.keys(overrides).length === 0;

  // Text, but no fields and too little of it to be a receipt: a menu or a business card.
  if (nothingFound && noOverrides && doc.lines.length < MIN_LINES_FOR_RECEIPT) {
    return {
      status: 'rejected',
      reject: 'NOT_A_RECEIPT',
      candidates,
      confidence: doc.meanConfidence,
    };
  }

  const invoice = validateSimpleField(
    resolve(
      candidates.invoice_no,
      overrides.invoice_no,
      rules.invoice.numericOnly,
      rules.invoice.allowUnlabelled,
    ),
    rules.invoice.pattern,
    'INVOICE_MISSING',
    'INVOICE_MALFORMED',
  );

  const min = validateSimpleField(
    resolve(candidates.min, overrides.min, rules.min.numericOnly, rules.min.allowUnlabelled),
    rules.min.pattern,
    'MIN_MISSING',
    'MIN_MALFORMED',
  );

  const date = validateDateField(
    resolve(candidates.receipt_date, overrides.receipt_date, false, rules.date.allowUnlabelled),
    input,
  );

  // ACCN is corroboration, not identity — it belongs to the POS vendor. Only enforced when
  // configured, since it prints in the small footer and is the first thing lost to a fold or crop.
  const accnResolved = resolve(
    candidates.accn,
    overrides.accn,
    rules.accn.numericOnly,
    rules.accn.allowUnlabelled,
  );

  let accnReject: RejectCode | null = null;
  if (rules.accreditation.requireAccn) {
    if (accnResolved.value === null) {
      accnReject = 'ACCN_MISSING';
    } else if (!rules.accn.pattern.test(accnResolved.value)) {
      accnReject = 'ACCN_MALFORMED';
    }
  }
  if (
    accnReject === null &&
    accnResolved.value !== null &&
    rules.accreditation.allowedVendorAccns.length > 0 &&
    !rules.accreditation.allowedVendorAccns.includes(accnResolved.value)
  ) {
    accnReject = 'ACCN_NOT_ACCREDITED';
  }

  // TIN never rejects here — the whitelist lookup needs I/O, so the callable does it. This only
  // surfaces the value.
  const tin = resolve(candidates.tin, overrides.tin, rules.tin.numericOnly, rules.tin.allowUnlabelled);

  // Deterministic precedence, following the acceptance criteria: invoice, MIN, date, ACCN.
  const rejects = [invoice.reject, min.reject, date.reject, accnReject].filter(
    (r): r is RejectCode => r !== null,
  );

  // Weakest of the three fields that gate a claim. ACCN and TIN are excluded — a faint vendor
  // footer would drag good receipts into review for nothing the user can act on.
  const confidence = Math.min(invoice.confidence, min.confidence, date.confidence);

  let key: string | null = null;
  let keyReject: RejectCode | null = null;
  if (rejects.length === 0 && min.value !== null && invoice.value !== null) {
    const built = buildReceiptKey(min.value, invoice.value);
    if (built.ok) key = built.key;
    else keyReject = built.reject;
  }

  const allRejects = keyReject ? [...rejects, keyReject] : rejects;

  if (allRejects.length > 0) {
    if (mode === 'claim') {
      return { status: 'rejected', reject: allRejects[0]!, candidates, confidence };
    }

    const partial: Partial<ReceiptFields> = {};
    if (invoice.value !== null && invoice.reject === null) partial.invoice_no = invoice.value;
    if (min.value !== null && min.reject === null) partial.min = min.value;
    if (date.ms !== null && date.reject === null) partial.receipt_date_ms = date.ms;
    if (accnResolved.value !== null && accnReject === null) partial.accn = accnResolved.value;
    if (tin.value !== null) partial.tin = tin.value;

    return {
      status: 'needs_review',
      fields: partial,
      candidates,
      softRejects: allRejects,
      confidence,
    };
  }

  const fields: ReceiptFields = {
    invoice_no: invoice.value!,
    min: min.value!,
    receipt_date_ms: date.ms!,
  };
  if (accnResolved.value !== null) fields.accn = accnResolved.value;
  if (tin.value !== null) fields.tin = tin.value;

  // Valid, but a field was read weakly. Confirm rather than award a stamp on a silent OCR error.
  if (confidence < rules.review.minFieldConfidence && mode === 'scan') {
    return { status: 'needs_review', fields, candidates, softRejects: [], confidence };
  }

  return { status: 'valid', fields, key: key!, candidates, confidence };
}
