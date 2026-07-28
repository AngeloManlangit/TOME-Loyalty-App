import {
  makeSimpleReceipt,
  makeVisionResponse,
} from '../../__fixtures__/synth/makeVisionResponse';
import type { ReceiptRules } from '../../src/receipts/core/rules.config';
import { receiptRules } from '../../src/receipts/core/rules.config';
import type { OcrDocument, ValidationOutcome } from '../../src/receipts/core/types';
import { validateReceipt } from '../../src/receipts/core/validate';
import { visionToOcrDocument } from '../../src/receipts/core/visionAdapter';

/** Server clock for every test: 28 Jul 2026, 12:00 Manila (04:00 UTC). */
const NOW = Date.UTC(2026, 6, 28, 4, 0, 0);

/**
 * Corpus-shaped field values. Uniqueness keys on MIN + invoice — see receiptKey.ts for why the ACCN
 * that design decision D5 specified could not do the job.
 */
const INVOICE = '00021838';
const MIN = '26013009560086199';
const ACCN = '0810107191682022121668';
const TIN = '003-583-915-00006';

const GOOD_RECEIPT = [
  'OUTLETS MALL',
  `VAT REG TIN ${TIN}`,
  `MIN ${MIN}`,
  `ACCN ${ACCN}`,
  `INVOICE NO ${INVOICE}`,
  'DATE 07/28/2026',
  'TOTAL 500.00',
];

/** Smallest receipt that can be valid: the two key fields plus a date. */
const minimal = (dateLine: string, invoice: string = INVOICE): string[] => [
  `MIN ${MIN}`,
  `INVOICE NO ${invoice}`,
  dateLine,
];

const docOf = (lines: string[], confidence = 0.95): OcrDocument =>
  visionToOcrDocument(
    makeVisionResponse({
      rows: lines.map((text, i) => ({ y: 100 + i * 30, cells: [{ text, x: 50, confidence }] })),
    }),
  );

const validate = (lines: string[], confidence = 0.95): ValidationOutcome =>
  validateReceipt({ doc: docOf(lines, confidence), rules: receiptRules, nowMs: NOW });

describe('validateReceipt — the happy path', () => {
  it('accepts a well-formed receipt and builds the uniqueness key', () => {
    const result = validate(GOOD_RECEIPT);

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;

    expect(result.fields.invoice_no).toBe(INVOICE);
    expect(result.fields.min).toBe(MIN);
    expect(result.fields.accn).toBe(ACCN);
    expect(result.fields.tin).toBe(TIN);
    expect(result.key).toBe(`${MIN}__${INVOICE}`);
    expect(new Date(result.fields.receipt_date_ms).toISOString()).toBe('2026-07-27T16:00:00.000Z');
  });

  it('keys on BOTH fields, so two terminals may both issue invoice 00000001', () => {
    const a = validate(minimal('DATE 07/28/2026', '00000001'));
    const b = validate(['MIN 25090417305924929', 'INVOICE NO 00000001', 'DATE 07/28/2026']);

    expect(a.status).toBe('valid');
    expect(b.status).toBe('valid');
    if (a.status !== 'valid' || b.status !== 'valid') return;
    expect(a.key).not.toBe(b.key);
  });

  it('accepts a receipt with no readable ACCN, which the Robinsons fixture is', () => {
    // requireAccn is off by default: the ACCN prints in the small vendor footer and is the first
    // thing lost to a fold, a crop or a faded edge.
    expect(validate(minimal('DATE 07/28/2026')).status).toBe('valid');
  });
});

describe('validateReceipt — no receipt at all', () => {
  it('rejects an empty OCR document with OCR_NO_TEXT', () => {
    const result = validateReceipt({
      doc: visionToOcrDocument({}),
      rules: receiptRules,
      nowMs: NOW,
    });
    expect(result).toMatchObject({ status: 'rejected', reject: 'OCR_NO_TEXT' });
  });

  it('rejects a photo of something that is plainly not a receipt', () => {
    expect(validate(['HELLO', 'WORLD'])).toMatchObject({
      status: 'rejected',
      reject: 'NOT_A_RECEIPT',
    });
  });

  it('does NOT call a long text document a non-receipt — it reports the missing field instead', () => {
    // A real receipt with a torn invoice line deserves a specific code, not "this is not a receipt".
    const result = validate(['OUTLETS MALL', 'CASHIER 3', 'TOTAL 500.00', 'CASH 1000.00']);
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reject).not.toBe('NOT_A_RECEIPT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The gates that make "the OCR must be sure" real. Scanned values are not editable, so a shaky read
// has no route to becoming correct: every one of these is a retake, never a stamp.
describe('validateReceipt — the OCR must be sure', () => {
  it('rejects a blurry photo outright, before trusting any field it produced', () => {
    // A photo this poor still yields plausible-looking values. Running the rest of the pipeline on
    // them only manufactures a confident answer out of an unreadable image.
    expect(validate(GOOD_RECEIPT, 0.5)).toMatchObject({
      status: 'rejected',
      reject: 'IMAGE_UNCLEAR',
    });
  });

  it('rejects a field read below the confidence floor', () => {
    // 0.65 clears the whole-document floor (0.60) but not the per-field one (0.70), so the two
    // gates are shown to be independent rather than one masking the other.
    expect(validate(GOOD_RECEIPT, 0.65)).toMatchObject({
      status: 'rejected',
      reject: 'LOW_CONFIDENCE',
    });
  });

  it('accepts a field read at exactly the confidence floor', () => {
    expect(validate(GOOD_RECEIPT, receiptRules.confidence.minFieldConfidence).status).toBe('valid');
  });

  it('rejects two equally plausible candidates rather than picking one', () => {
    // The failure mode this exists for: the ranking picks one, nothing looks unusual, and the user
    // has no way to say it was the other one. That is a confidently wrong stamp.
    const result = validate([
      `MIN ${MIN}`,
      `INVOICE NO ${INVOICE}`,
      'INVOICE NO 00022492',
      'DATE 07/28/2026',
    ]);
    expect(result).toMatchObject({ status: 'rejected', reject: 'AMBIGUOUS_FIELD' });
  });

  it('accepts a clear winner over a weak runner-up', () => {
    // The labelled value scores 1.0 against a pattern-scan match at 0.25 — a margin of 0.75.
    expect(validate(minimal('DATE 07/28/2026')).status).toBe('valid');
  });

  it('will not accept an unlabelled invoice number, however well it matches the format', () => {
    // The single most important correctness rule in the file: a receipt whose invoice label is torn
    // must not silently claim a random number off the page as its invoice number.
    expect(validate([`MIN ${MIN}`, INVOICE, 'DATE 07/28/2026'])).toMatchObject({
      status: 'rejected',
      reject: 'INVOICE_MISSING',
    });
  });

  it('DOES accept an unlabelled MIN, whose 17-digit shape is discriminating on its own', () => {
    const result = validate([MIN, `INVOICE NO ${INVOICE}`, 'DATE 07/28/2026']);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.min).toBe(MIN);
  });

  it('reports the weakest field confidence, not an average that would hide it', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: `MIN ${MIN}`, x: 50, confidence: 0.99 }] },
        { y: 130, cells: [{ text: `INVOICE NO ${INVOICE}`, x: 50, confidence: 0.86 }] },
        { y: 160, cells: [{ text: 'DATE 07/28/2026', x: 50, confidence: 0.99 }] },
      ],
    });
    const result = validateReceipt({
      doc: visionToOcrDocument(response),
      rules: receiptRules,
      nowMs: NOW,
    });
    expect(result.status).toBe('valid');
    expect(result.confidence).toBeCloseTo(0.86, 5);
  });

  it('omits a shakily-read TIN rather than deciding accreditation on it', () => {
    // TIN identifies the business. A guess here points the whitelist lookup at the wrong company.
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: `VAT REG TIN ${TIN}`, x: 50, confidence: 0.62 }] },
        { y: 130, cells: [{ text: `MIN ${MIN}`, x: 50, confidence: 0.99 }] },
        { y: 160, cells: [{ text: `INVOICE NO ${INVOICE}`, x: 50, confidence: 0.99 }] },
        { y: 190, cells: [{ text: 'DATE 07/28/2026', x: 50, confidence: 0.99 }] },
      ],
    });
    const result = validateReceipt({
      doc: visionToOcrDocument(response),
      rules: receiptRules,
      nowMs: NOW,
    });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.tin).toBeUndefined();
  });
});

describe('validateReceipt — criterion 1, invoice number', () => {
  it('reports INVOICE_MISSING when no invoice number is present', () => {
    expect(validate([`MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });

  it('never proposes a word as an invoice number', () => {
    const result = validate([
      `MIN ${MIN}`,
      'THIS SERVES AS AN OFFICIAL SALES INVOICE',
      'DATE 07/28/2026',
    ]);
    expect(result).toMatchObject({ status: 'rejected', reject: 'INVOICE_MISSING' });
  });
});

describe('validateReceipt — criterion 2, date and the claim window', () => {
  it('accepts a receipt dated today', () => {
    expect(validate(GOOD_RECEIPT).status).toBe('valid');
  });

  it('accepts a receipt exactly at the far edge of the window', () => {
    expect(validate(minimal('DATE 07/21/2026')).status).toBe('valid');
  });

  it('rejects a receipt one day past the window', () => {
    expect(validate(minimal('DATE 07/20/2026'))).toMatchObject({ reject: 'DATE_EXPIRED' });
  });

  it('rejects a future-dated receipt', () => {
    expect(validate(minimal('DATE 07/29/2026'))).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('rejects a receipt printed later TODAY when a time is actually printed', () => {
    // A bare date asserts a calendar DAY and is fine all day; 18:00 with now at 12:00 is not.
    expect(validate(minimal('DATE 07/28/2026 18:00'))).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('accepts a bare date printed today, because it asserts a calendar day', () => {
    expect(validate(minimal('DATE 07/28/2026')).status).toBe('valid');
  });

  it('accepts a timed receipt within the clock-skew tolerance', () => {
    expect(validate(minimal('DATE 07/28/2026 12:01')).status).toBe('valid');
  });

  it('rejects a timed receipt beyond the clock-skew tolerance', () => {
    expect(validate(minimal('DATE 07/28/2026 12:30'))).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('reports DATE_MISSING when the receipt carries no date', () => {
    expect(validate([`MIN ${MIN}`, `INVOICE NO ${INVOICE}`, 'TOTAL 500.00'])).toMatchObject({
      reject: 'DATE_MISSING',
    });
  });

  it('never proposes an impossible calendar date, so it cannot reach the window check', () => {
    // 30 February parses as nothing, so it is not a candidate at all and the receipt simply has no
    // date. Rejecting impossible dates rather than clamping them is what makes that true.
    expect(validate([`MIN ${MIN}`, `INVOICE NO ${INVOICE}`, 'DATE 02/30/2026'])).toMatchObject({
      reject: 'DATE_MISSING',
    });
  });

  it('is decided by the SERVER clock, so rolling the device clock forward changes nothing', () => {
    // The device clock is not an input to this function at all — there is nowhere to inject one.
    const rolledForward = Date.UTC(2027, 0, 1);
    expect(
      validateReceipt({ doc: docOf(GOOD_RECEIPT), rules: receiptRules, nowMs: rolledForward }),
    ).toMatchObject({ reject: 'DATE_EXPIRED' });
  });

  it('handles the window across a year boundary', () => {
    const newYear = Date.UTC(2027, 0, 2, 4, 0, 0);
    expect(
      validateReceipt({
        doc: docOf(minimal('DATE 12/28/2026')),
        rules: receiptRules,
        nowMs: newYear,
      }).status,
    ).toBe('valid');
  });
});

describe('validateReceipt — criterion 3, MIN', () => {
  it('reports MIN_MISSING when absent', () => {
    expect(validate([`INVOICE NO ${INVOICE}`, 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'MIN_MISSING',
    });
  });

  it('does not mistake a short number for a MIN', () => {
    expect(validate(['MIN 1234', `INVOICE NO ${INVOICE}`, 'DATE 07/28/2026'])).toMatchObject({
      reject: 'MIN_MISSING',
    });
  });
});

describe('validateReceipt — ACCN is corroboration, not identity', () => {
  const requiring: ReceiptRules = {
    ...receiptRules,
    accreditation: { ...receiptRules.accreditation, requireAccn: true },
  };

  it('reports ACCN_MISSING when required and absent', () => {
    expect(
      validateReceipt({
        doc: docOf(minimal('DATE 07/28/2026')),
        rules: requiring,
        nowMs: NOW,
      }),
    ).toMatchObject({ reject: 'ACCN_MISSING' });
  });

  it('accepts the receipt when required and present', () => {
    expect(
      validateReceipt({ doc: docOf(GOOD_RECEIPT), rules: requiring, nowMs: NOW }).status,
    ).toBe('valid');
  });

  it('rejects an ACCN outside the accredited vendor list', () => {
    const whitelisted: ReceiptRules = {
      ...receiptRules,
      accreditation: {
        ...receiptRules.accreditation,
        allowedVendorAccns: ['9999107191682022121668'],
      },
    };
    expect(
      validateReceipt({ doc: docOf(GOOD_RECEIPT), rules: whitelisted, nowMs: NOW }),
    ).toMatchObject({ reject: 'ACCN_NOT_ACCREDITED' });
  });

  it('accepts any well-formed ACCN when the vendor list is empty', () => {
    expect(validate(GOOD_RECEIPT).status).toBe('valid');
  });
});

describe('validateReceipt — reject precedence is deterministic', () => {
  it('reports invoice before MIN before date', () => {
    // Everything is wrong; the code returned must be stable so the UI copy and the tests can rely on it.
    expect(validate(['OUTLETS MALL', 'CASHIER 3', 'TOTAL 500.00', 'CASH 1000'])).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });
});

describe('validateReceipt — document id safety', () => {
  it('rejects a value that would turn the document id into a collection path', () => {
    // Needs a pattern permissive enough to let a slash through extraction, which the shipped
    // digits-only rule does not. buildReceiptKey is the backstop either way.
    const loose: ReceiptRules = {
      ...receiptRules,
      invoice: { ...receiptRules.invoice, pattern: /^[0-9/]{4,20}$/ },
    };
    const result = validateReceipt({
      doc: docOf([`MIN ${MIN}`, 'INVOICE NO 000/21838', 'DATE 07/28/2026']),
      rules: loose,
      nowMs: NOW,
    });
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(['INVOICE_MALFORMED', 'RECEIPT_KEY_INVALID']).toContain(result.reject);
  });

  it('rejects an over-long key', () => {
    const loose: ReceiptRules = {
      ...receiptRules,
      invoice: { ...receiptRules.invoice, pattern: /^[0-9]+$/ },
      min: { ...receiptRules.min, pattern: /^[0-9]+$/ },
    };
    const result = validateReceipt({
      doc: docOf([
        `MIN ${'1'.repeat(800)}`,
        `INVOICE NO ${'2'.repeat(800)}`,
        'DATE 07/28/2026',
      ]),
      rules: loose,
      nowMs: NOW,
    });
    expect(result).toMatchObject({ status: 'rejected', reject: 'RECEIPT_KEY_INVALID' });
  });
});

describe('validateReceipt — degraded but real receipts', () => {
  it('reads a receipt whose labels and digits OCR mangled', () => {
    // "MlN" falls outside the zero-edit budget for a 3-letter alias, so the MIN is recovered by its
    // 17-digit shape alone; the invoice label survives one edit and its digits are repaired.
    const result = validate([
      'OUTLETS MALL',
      'MlN 26O13OO956OO86199',
      'INVOlCE NO OOO21838',
      'DATE 07/28/2026',
    ]);

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.min).toBe(MIN);
    expect(result.fields.invoice_no).toBe(INVOICE);
  });

  it('reads a receipt whose label is glued to its value', () => {
    const result = validate(['OUTLETS MALL', `MIN ${MIN}`, `INV#${INVOICE}`, 'DATE 07/28/2026']);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.invoice_no).toBe(INVOICE);
  });

  it('reads a two-column receipt photographed at an angle', () => {
    const response = makeVisionResponse({
      blockStrategy: 'per-column',
      skew: 12,
      rows: [
        { y: 100, cells: [{ text: 'MIN', x: 50 }, { text: MIN, x: 400 }] },
        { y: 140, cells: [{ text: 'INVOICE NO', x: 50 }, { text: INVOICE, x: 400 }] },
        { y: 180, cells: [{ text: 'DATE', x: 50 }, { text: '07/28/2026', x: 400 }] },
        { y: 220, cells: [{ text: 'TOTAL', x: 50 }, { text: '500.00', x: 400 }] },
      ],
    });

    const result = validateReceipt({
      doc: visionToOcrDocument(response),
      rules: receiptRules,
      nowMs: NOW,
    });

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.key).toBe(`${MIN}__${INVOICE}`);
  });

  it('rejects a receipt with the invoice line torn off, rather than guessing', () => {
    expect(
      validate(['OUTLETS MALL', `MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00']),
    ).toMatchObject({ status: 'rejected', reject: 'INVOICE_MISSING' });
  });
});

describe('validateReceipt — rules are data', () => {
  it('honours a different claim window without any code change', () => {
    const strict: ReceiptRules = {
      ...receiptRules,
      window: { ...receiptRules.window, maxAgeDays: 0 },
    };
    const doc = docOf(minimal('DATE 07/27/2026'));

    expect(validateReceipt({ doc, rules: strict, nowMs: NOW })).toMatchObject({
      reject: 'DATE_EXPIRED',
    });
    expect(validateReceipt({ doc, rules: receiptRules, nowMs: NOW }).status).toBe('valid');
  });

  it('honours a DMY locale order without any code change', () => {
    const dmy: ReceiptRules = {
      ...receiptRules,
      date: { ...receiptRules.date, localeOrder: 'DMY' },
    };
    const doc = visionToOcrDocument(makeSimpleReceipt(minimal('DATE 07/08/2026')));

    const result = validateReceipt({ doc, rules: dmy, nowMs: Date.UTC(2026, 7, 8, 4) });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    // 07/08 read as 7 August, not 8 July.
    expect(new Date(result.fields.receipt_date_ms).toISOString()).toBe('2026-08-06T16:00:00.000Z');
  });

  it('honours a relaxed confidence floor without any code change', () => {
    const lenient: ReceiptRules = {
      ...receiptRules,
      confidence: { ...receiptRules.confidence, minFieldConfidence: 0.5 },
    };
    const doc = docOf(GOOD_RECEIPT, 0.65);

    expect(validateReceipt({ doc, rules: receiptRules, nowMs: NOW })).toMatchObject({
      reject: 'LOW_CONFIDENCE',
    });
    expect(validateReceipt({ doc, rules: lenient, nowMs: NOW }).status).toBe('valid');
  });
});
