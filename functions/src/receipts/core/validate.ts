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

/**
 * Composes extraction, format rules and the claim window into a single verdict.
 *
 * The mode split is the heart of this file:
 *
 *   scan  — proposes. A field problem is never fatal, because a misread is the user's to fix on the
 *           review screen. Only "there is no receipt here" stops a scan.
 *   claim — decides. The server is the sole authority, so anything not fully valid is rejected with a
 *           specific code.
 *
 * That is what makes a faded receipt land in review rather than in a false rejection, while a
 * genuinely expired one still cannot be claimed. It also means an attacker gains nothing by calling
 * scan repeatedly: scan awards nothing.
 */

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
 * A receipt needs at least this many lines before "no fields found" is reported as a field problem
 * rather than "this is not a receipt". Below it, the photo is a wall, a hand, or a blank page.
 */
const MIN_LINES_FOR_RECEIPT = 3;

/**
 * Minimum candidate score that may be accepted as a field value WITHOUT the user confirming it.
 *
 * This sits above the pattern-scan score deliberately. Pattern-scan finds text that merely has the
 * right shape anywhere on the receipt, with no label nearby — and because the format patterns are
 * permissive placeholders (see rules.config.ts), that matches plenty of innocent words. Auto-accepting
 * one would mean a receipt with a torn invoice label silently claims "OUTLETS" as its invoice number:
 * a wrong stamp, awarded with no signal to anyone. Exactly what §2 of the architecture doc forbids.
 *
 * Such candidates are still returned for the review screen's chips — they are just not allowed to
 * become the answer on their own.
 */
const MIN_AUTO_ACCEPT_SCORE = 0.5;

function pickTop(candidates: readonly FieldCandidate[]): FieldCandidate | null {
  const top = candidates.length > 0 ? candidates[0]! : null;
  return top && top.score >= MIN_AUTO_ACCEPT_SCORE ? top : null;
}

interface Resolved {
  value: string | null;
  confidence: number;
  corrected: boolean;
}

/**
 * A user override wins over OCR outright.
 *
 * It is given confidence 1 because a human typed it — the whole purpose of the review screen is that
 * a confirmed value is more trustworthy than a probabilistic one. Forgery is prevented upstream, by
 * checking the override appears in the stored OCR text.
 */
function resolve(
  candidates: readonly FieldCandidate[],
  override: string | undefined,
  numericOnly: boolean,
): Resolved {
  if (override !== undefined) {
    const value = normalizeFieldValue(override, numericOnly);
    return { value: value.length > 0 ? value : null, confidence: 1, corrected: true };
  }

  const top = pickTop(candidates);
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
    // With no printed time the receipt asserts a calendar DAY, so comparing instants would call
    // today's own receipt "future" for most of the day. Compare days instead.
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

function validateDateField(resolved: Resolved, input: ValidateInput): FieldOutcome & { ms: number | null } {
  if (resolved.value === null) {
    return { value: null, ms: null, reject: 'DATE_MISSING', confidence: 0 };
  }

  const parts = parseDateToken(resolved.value, input.rules.date.localeOrder);
  if (!parts) {
    return { value: resolved.value, ms: null, reject: 'DATE_UNPARSEABLE', confidence: resolved.confidence };
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

  const empty: FieldCandidates = { invoice_no: [], accn: [], receipt_date: [] };

  if (doc.lines.length === 0) {
    return { status: 'rejected', reject: 'OCR_NO_TEXT', candidates: empty, confidence: 0 };
  }

  const candidates: FieldCandidates = {
    invoice_no: extractFieldCandidates(doc, rules.invoice),
    accn: extractFieldCandidates(doc, rules.accn),
    receipt_date: extractDateCandidates(doc, rules.date),
  };

  // "Nothing found" means nothing TRUSTWORTHY found — a page of pattern-scan noise does not count as
  // having located a field.
  const nothingFound =
    pickTop(candidates.invoice_no) === null &&
    pickTop(candidates.accn) === null &&
    pickTop(candidates.receipt_date) === null;
  const noOverrides = Object.keys(overrides).length === 0;

  // A photo with text but none of the three fields, and too little text to be a receipt at all, is
  // reported as NOT_A_RECEIPT — a menu or a business card, not a receipt with an unreadable label.
  if (nothingFound && noOverrides && doc.lines.length < MIN_LINES_FOR_RECEIPT) {
    return {
      status: 'rejected',
      reject: 'NOT_A_RECEIPT',
      candidates,
      confidence: doc.meanConfidence,
    };
  }

  const invoice = validateSimpleField(
    resolve(candidates.invoice_no, overrides.invoice_no, rules.invoice.numericOnly),
    rules.invoice.pattern,
    'INVOICE_MISSING',
    'INVOICE_MALFORMED',
  );

  const accn = validateSimpleField(
    resolve(candidates.accn, overrides.accn, rules.accn.numericOnly),
    rules.accn.pattern,
    'ACCN_MISSING',
    'ACCN_MALFORMED',
  );

  const date = validateDateField(resolve(candidates.receipt_date, overrides.receipt_date, false), input);

  // Deterministic precedence, so a receipt failing several checks always reports the same code and
  // the tests can assert it. Order follows the acceptance criteria: invoice, then ACCN, then date.
  const rejects = [invoice.reject, accn.reject, date.reject].filter(
    (r): r is RejectCode => r !== null,
  );

  const confidence = Math.min(invoice.confidence, accn.confidence, date.confidence);

  let key: string | null = null;
  let keyReject: RejectCode | null = null;
  if (rejects.length === 0 && accn.value !== null && invoice.value !== null) {
    const built = buildReceiptKey(accn.value, invoice.value);
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
    if (accn.value !== null && accn.reject === null) partial.accn = accn.value;
    if (date.ms !== null && date.reject === null) partial.receipt_date_ms = date.ms;

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
    accn: accn.value!,
    receipt_date_ms: date.ms!,
  };

  // Everything is valid but at least one field was read weakly. Ask the user to confirm rather than
  // awarding a stamp on a guess — an OCR error that reaches this point would otherwise be silent.
  if (confidence < rules.review.minFieldConfidence && mode === 'scan') {
    return { status: 'needs_review', fields, candidates, softRejects: [], confidence };
  }

  return { status: 'valid', fields, key: key!, candidates, confidence };
}
