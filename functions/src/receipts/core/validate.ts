import { calendarDaysBetween, localCalendarDay } from './dateParse';
import type { DateCandidate } from './extractDate';
import { extractDateCandidates } from './extractDate';
import { extractFieldCandidates } from './extractField';
import { buildReceiptKey } from './receiptKey';
import type { FieldRule, ReceiptRules } from './rules.config';
import type {
  FieldCandidate,
  FieldCandidates,
  OcrDocument,
  ReceiptFields,
  RejectCode,
  ValidationOutcome,
} from './types';

export interface ValidateInput {
  doc: OcrDocument;
  rules: ReceiptRules;
  /** Server clock, epoch ms. Injected so window tests are deterministic and the device clock is irrelevant. */
  nowMs: number;
}

/**
 * Below this many lines, "no fields found" is reported as NOT_A_RECEIPT rather than a field problem:
 * the photo is a wall, a hand, or a blank page.
 */
const MIN_LINES_FOR_RECEIPT = 3;

/**
 * Resolving a field to a single value, or to the reason it cannot be trusted.
 *
 * Scanned values are NOT editable, so every branch that once produced "here is a guess, let the user
 * fix it" now has to produce either a value we stand behind or a retake. There is no third option.
 */
interface Resolved {
  value: string | null;
  confidence: number;
  /** Set when the candidate exists but is not trustworthy enough to use. */
  reject: RejectCode | null;
}

function resolveField(
  candidates: readonly FieldCandidate[],
  rule: Pick<FieldRule, 'allowUnlabelled'>,
  rules: ReceiptRules,
): Resolved {
  const top = candidates.length > 0 ? candidates[0]! : null;
  if (!top) return { value: null, confidence: 0, reject: null };

  const { confidence: gates } = rules;

  // An unlabelled match scores below the auto-accept floor. It is promoted only when the rule says
  // the field's format is discriminating enough to stand alone (a 17-digit MIN); otherwise a receipt
  // with a torn label would claim a random number off the page.
  if (top.score < gates.minAutoAcceptScore && !rule.allowUnlabelled) {
    return { value: null, confidence: top.confidence, reject: null };
  }

  if (top.confidence < gates.minFieldConfidence) {
    return { value: top.value, confidence: top.confidence, reject: 'LOW_CONFIDENCE' };
  }

  // Ambiguity, but only for fields that depend on a label being read correctly.
  //
  // Scoped deliberately. A field with `allowUnlabelled` is one whose format is discriminating on its
  // own (a 17-digit MIN, a real calendar date), and its extractor ranks on domain signals a score
  // comparison cannot see — date plausibility, `preferEarliest` for the merchant's TIN over the
  // vendor's. Those ties are RESOLVED, not ambiguous, and treating them otherwise rejected every
  // receipt in the corpus.
  //
  // Where the label IS the evidence, two values both sitting against a valid label means we cannot
  // tell which label was the real one — and the user cannot tell us. That is a retake.
  if (!rule.allowUnlabelled) {
    const runnerUp = candidates[1];
    if (runnerUp && top.score - runnerUp.score < gates.minCandidateMargin) {
      return { value: top.value, confidence: top.confidence, reject: 'AMBIGUOUS_FIELD' };
    }
  }

  return { value: top.value, confidence: top.confidence, reject: null };
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

/**
 * No format check here: `extractFieldCandidates` only emits candidates that already match the
 * rule's pattern, so a resolved value is well-formed by construction. Re-testing it would be a
 * branch nothing could reach — the *_MALFORMED codes are now raised only by `buildReceiptKey`,
 * which catches the characters Firestore forbids in a document id.
 */
function validateSimpleField(resolved: Resolved, missing: RejectCode): FieldOutcome {
  // A confidence or ambiguity problem outranks everything else: the value may well be well-formed
  // and still be the wrong number, which is exactly what these gates exist to catch.
  if (resolved.reject !== null) {
    return { value: resolved.value, reject: resolved.reject, confidence: resolved.confidence };
  }
  if (resolved.value === null) {
    return { value: null, reject: missing, confidence: 0 };
  }
  return { value: resolved.value, reject: null, confidence: resolved.confidence };
}

/**
 * The date's instant comes from the extractor, which parsed it to build the candidate. Re-parsing
 * the canonical value here would be both redundant and unfalsifiable: a candidate is parseable by
 * construction, so the "unparseable" branch could never be reached or tested.
 */
function validateDateField(
  resolved: Resolved,
  top: DateCandidate | null,
  input: ValidateInput,
): FieldOutcome & { ms: number | null } {
  if (resolved.reject !== null) {
    return {
      value: resolved.value,
      ms: null,
      reject: resolved.reject,
      confidence: resolved.confidence,
    };
  }
  if (resolved.value === null || top === null) {
    return { value: null, ms: null, reject: 'DATE_MISSING', confidence: 0 };
  }

  return {
    value: resolved.value,
    ms: top.ms,
    reject: checkWindow(top.ms, input, top.hasTime),
    confidence: resolved.confidence,
  };
}

export function validateReceipt(input: ValidateInput): ValidationOutcome {
  const { doc, rules } = input;

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

  // Whole-document floor, checked before any field logic. A photo this blurry will produce field
  // values, and they will look plausible — spending the rest of the pipeline on them only makes a
  // confident answer out of an unreadable image.
  if (doc.meanConfidence < rules.confidence.minMeanConfidence) {
    return {
      status: 'rejected',
      reject: 'IMAGE_UNCLEAR',
      candidates: empty,
      confidence: doc.meanConfidence,
    };
  }

  // Held separately from `candidates` because the date variant carries its resolved instant, which
  // widening to FieldCandidate[] would erase.
  const dateCandidates = extractDateCandidates(doc, rules.date, input.nowMs);

  const candidates: FieldCandidates = {
    invoice_no: extractFieldCandidates(doc, rules.invoice),
    min: extractFieldCandidates(doc, rules.min),
    accn: extractFieldCandidates(doc, rules.accn),
    tin: extractFieldCandidates(doc, rules.tin),
    receipt_date: dateCandidates,
  };

  const invoiceResolved = resolveField(candidates.invoice_no, rules.invoice, rules);
  const minResolved = resolveField(candidates.min, rules.min, rules);
  const dateResolved = resolveField(candidates.receipt_date, rules.date, rules);

  // Text, but none of the three fields located and too little of it to be a receipt: a menu or a
  // business card, not a receipt whose label was unreadable.
  const nothingFound =
    invoiceResolved.value === null && minResolved.value === null && dateResolved.value === null;
  if (nothingFound && doc.lines.length < MIN_LINES_FOR_RECEIPT) {
    return {
      status: 'rejected',
      reject: 'NOT_A_RECEIPT',
      candidates,
      confidence: doc.meanConfidence,
    };
  }

  const invoice = validateSimpleField(invoiceResolved, 'INVOICE_MISSING');

  const min = validateSimpleField(minResolved, 'MIN_MISSING');

  const date = validateDateField(dateResolved, dateCandidates[0] ?? null, input);

  // ACCN is corroboration, not identity — it belongs to the POS vendor. Only enforced when
  // configured, since it prints in the small footer and is the first thing lost to a fold or crop.
  const accnResolved = resolveField(candidates.accn, rules.accn, rules);

  // Same as above: a resolved ACCN already matches its pattern, so "missing" is the only shape
  // problem left to report.
  let accnReject: RejectCode | null = null;
  if (rules.accreditation.requireAccn && accnResolved.value === null) {
    accnReject = 'ACCN_MISSING';
  }
  if (
    accnReject === null &&
    accnResolved.value !== null &&
    accnResolved.reject === null &&
    rules.accreditation.allowedVendorAccns.length > 0 &&
    !rules.accreditation.allowedVendorAccns.includes(accnResolved.value)
  ) {
    accnReject = 'ACCN_NOT_ACCREDITED';
  }

  // TIN never rejects here — the whitelist lookup needs I/O, so the callable does it. Only a
  // confidently-read TIN is surfaced; a shaky one is simply omitted rather than used to decide
  // accreditation, which is a decision about a business.
  const tin = resolveField(candidates.tin, rules.tin, rules);

  // Deterministic precedence, following the acceptance criteria: invoice, MIN, date, ACCN.
  const rejects = [invoice.reject, min.reject, date.reject, accnReject].filter(
    (r): r is RejectCode => r !== null,
  );

  // Weakest of the three fields that gate a claim. ACCN and TIN are excluded — a faint vendor
  // footer would bounce good receipts for nothing the user can act on.
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
    return { status: 'rejected', reject: allRejects[0]!, candidates, confidence };
  }

  const fields: ReceiptFields = {
    invoice_no: invoice.value!,
    min: min.value!,
    receipt_date_ms: date.ms!,
  };
  if (accnResolved.value !== null && accnResolved.reject === null) fields.accn = accnResolved.value;
  if (tin.value !== null && tin.reject === null) fields.tin = tin.value;

  return { status: 'valid', fields, key: key!, candidates, confidence };
}
