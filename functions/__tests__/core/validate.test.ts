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

const validate = (
  lines: string[],
  overrides: Partial<Parameters<typeof validateReceipt>[0]> = {},
): ValidationOutcome =>
  validateReceipt({
    doc: docOf(lines),
    rules: receiptRules,
    nowMs: NOW,
    mode: 'claim',
    ...overrides,
  });

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
    const b = validate([
      'MIN 25090417305924929',
      'INVOICE NO 00000001',
      'DATE 07/28/2026',
    ]);

    expect(a.status).toBe('valid');
    expect(b.status).toBe('valid');
    if (a.status !== 'valid' || b.status !== 'valid') return;
    expect(a.key).not.toBe(b.key);
  });

  it('accepts a receipt with no readable ACCN, which the Robinsons fixture is', () => {
    // requireAccn is off by default: the ACCN prints in the small vendor footer and is the first
    // thing lost to a fold, a crop or a faded edge.
    const result = validate(minimal('DATE 07/28/2026'));
    expect(result.status).toBe('valid');
  });
});

describe('validateReceipt — no receipt at all', () => {
  it('rejects an empty OCR document with OCR_NO_TEXT', () => {
    const result = validateReceipt({
      doc: visionToOcrDocument({}),
      rules: receiptRules,
      nowMs: NOW,
      mode: 'claim',
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

describe('validateReceipt — criterion 1, invoice number', () => {
  it('reports INVOICE_MISSING when no invoice number is present', () => {
    expect(validate([`MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });

  it('reports INVOICE_MALFORMED for a corrected value that does not fit the format', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { invoice_no: '!!' } })).toMatchObject({
      reject: 'INVOICE_MALFORMED',
    });
  });

  it('will not accept an unlabelled invoice number, however well it matches the format', () => {
    // The single most important correctness rule in the file: a receipt whose invoice label is torn
    // must not silently claim a random number as its invoice. It goes to review instead.
    const result = validate([`MIN ${MIN}`, '00021838', 'DATE 07/28/2026'], { mode: 'scan' });
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
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
    const result = validate(minimal('DATE 07/28/2026 18:00'));
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reject).toBe('DATE_FUTURE');
  });

  it('accepts a bare date printed today, because it asserts a calendar day', () => {
    expect(validate(minimal('DATE 07/28/2026')).status).toBe('valid');
  });

  it('accepts a timed receipt within the clock-skew tolerance', () => {
    const doc = docOf(minimal('DATE 07/28/2026 12:01'));
    expect(
      validateReceipt({ doc, rules: receiptRules, nowMs: NOW, mode: 'claim' }).status,
    ).toBe('valid');
  });

  it('rejects a timed receipt beyond the clock-skew tolerance', () => {
    expect(validate(minimal('DATE 07/28/2026 12:30'))).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('reports DATE_MISSING when the receipt carries no date', () => {
    expect(validate([`MIN ${MIN}`, `INVOICE NO ${INVOICE}`, 'TOTAL 500.00'])).toMatchObject({
      reject: 'DATE_MISSING',
    });
  });

  it('reports DATE_UNPARSEABLE for a corrected date that is not a date', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { receipt_date: 'NOT A DATE' } })).toMatchObject({
      reject: 'DATE_UNPARSEABLE',
    });
  });

  it('rejects an impossible calendar date supplied as a correction', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { receipt_date: '02/30/2026' } })).toMatchObject({
      reject: 'DATE_UNPARSEABLE',
    });
  });

  it('is decided by the SERVER clock, so rolling the device clock forward changes nothing', () => {
    // The device clock is not an input to this function at all — there is nowhere to inject one.
    const rolledForward = Date.UTC(2027, 0, 1);
    const doc = docOf(GOOD_RECEIPT);
    expect(
      validateReceipt({ doc, rules: receiptRules, nowMs: rolledForward, mode: 'claim' }),
    ).toMatchObject({ reject: 'DATE_EXPIRED' });
  });

  it('handles the window across a year boundary', () => {
    const newYear = Date.UTC(2027, 0, 2, 4, 0, 0);
    const doc = docOf(minimal('DATE 12/28/2026'));
    expect(validateReceipt({ doc, rules: receiptRules, nowMs: newYear, mode: 'claim' }).status).toBe(
      'valid',
    );
  });
});

describe('validateReceipt — criterion 3, MIN', () => {
  it('reports MIN_MISSING when absent', () => {
    expect(validate([`INVOICE NO ${INVOICE}`, 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'MIN_MISSING',
    });
  });

  it('reports MIN_MALFORMED for a corrected value that does not fit the format', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { min: 'ABC' } })).toMatchObject({
      reject: 'MIN_MALFORMED',
    });
  });

  it('accepts an unlabelled MIN, whose 17-digit shape is discriminating on its own', () => {
    const result = validate([MIN, `INVOICE NO ${INVOICE}`, 'DATE 07/28/2026']);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.min).toBe(MIN);
  });
});

describe('validateReceipt — ACCN is corroboration, not identity', () => {
  const requiring: ReceiptRules = {
    ...receiptRules,
    accreditation: { ...receiptRules.accreditation, requireAccn: true },
  };

  it('reports ACCN_MISSING when required and absent', () => {
    const doc = docOf(minimal('DATE 07/28/2026'));
    expect(validateReceipt({ doc, rules: requiring, nowMs: NOW, mode: 'claim' })).toMatchObject({
      reject: 'ACCN_MISSING',
    });
  });

  it('reports ACCN_MALFORMED when required and the value does not fit the format', () => {
    const doc = docOf(GOOD_RECEIPT);
    expect(
      validateReceipt({
        doc,
        rules: requiring,
        nowMs: NOW,
        mode: 'claim',
        overrides: { accn: '123' },
      }),
    ).toMatchObject({ reject: 'ACCN_MALFORMED' });
  });

  it('rejects an ACCN outside the accredited vendor list', () => {
    const whitelisted: ReceiptRules = {
      ...receiptRules,
      accreditation: {
        ...receiptRules.accreditation,
        allowedVendorAccns: ['9999107191682022121668'],
      },
    };
    const doc = docOf(GOOD_RECEIPT);
    expect(validateReceipt({ doc, rules: whitelisted, nowMs: NOW, mode: 'claim' })).toMatchObject({
      reject: 'ACCN_NOT_ACCREDITED',
    });
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

describe('validateReceipt — scan mode proposes, claim mode decides', () => {
  it('scan does not hard-reject a missing field; it asks for review', () => {
    const result = validate([`MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'], { mode: 'scan' });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
    expect(result.fields.min).toBe(MIN);
  });

  it('omits a field that is present but malformed from the partial result', () => {
    // The user must re-enter it; handing back a value we know is invalid would invite them to
    // just confirm it.
    const result = validate(GOOD_RECEIPT, { mode: 'scan', overrides: { min: 'NOT-A-MIN' } });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('MIN_MALFORMED');
    expect(result.fields.min).toBeUndefined();
    expect(result.fields.invoice_no).toBe(INVOICE);
  });

  it('omits an out-of-window date from the partial result', () => {
    const result = validate(minimal('DATE 01/02/2026'), { mode: 'scan' });
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.fields.receipt_date_ms).toBeUndefined();
  });

  it('scan surfaces an expired date as a soft reject, so a MISREAD date can still be corrected', () => {
    const result = validate(minimal('DATE 01/02/2026'), { mode: 'scan' });
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('DATE_EXPIRED');
  });

  it('claim rejects that same expired receipt outright — the server is the authority', () => {
    expect(validate(minimal('DATE 01/02/2026'), { mode: 'claim' })).toMatchObject({
      status: 'rejected',
      reject: 'DATE_EXPIRED',
    });
  });

  it('scan still hard-rejects when there is no text at all', () => {
    expect(
      validateReceipt({
        doc: visionToOcrDocument({}),
        rules: receiptRules,
        nowMs: NOW,
        mode: 'scan',
      }),
    ).toMatchObject({ status: 'rejected', reject: 'OCR_NO_TEXT' });
  });
});

describe('validateReceipt — low confidence', () => {
  const lowConfidence = (mode: 'scan' | 'claim'): ValidationOutcome =>
    validateReceipt({
      doc: docOf(GOOD_RECEIPT, 0.4),
      rules: receiptRules,
      nowMs: NOW,
      mode,
    });

  it('sends a valid but weakly-read receipt to review rather than awarding on a guess', () => {
    const result = lowConfidence('scan');
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toEqual([]); // nothing is WRONG, it just needs confirming
    expect(result.fields.invoice_no).toBe(INVOICE);
  });

  it('accepts it at claim time, because the user has confirmed the fields by then', () => {
    expect(lowConfidence('claim').status).toBe('valid');
  });

  it('reports the weakest field confidence, not an average that would hide it', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: `MIN ${MIN}`, x: 50, confidence: 0.99 }] },
        { y: 130, cells: [{ text: `INVOICE NO ${INVOICE}`, x: 50, confidence: 0.3 }] },
        { y: 160, cells: [{ text: 'DATE 07/28/2026', x: 50, confidence: 0.99 }] },
      ],
    });
    const result = validateReceipt({
      doc: visionToOcrDocument(response),
      rules: receiptRules,
      nowMs: NOW,
      mode: 'claim',
    });
    expect(result.confidence).toBeCloseTo(0.3, 5);
  });
});

describe('validateReceipt — corrections', () => {
  it('a correction overrides OCR and is trusted', () => {
    const result = validate([`MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'], {
      overrides: { invoice_no: INVOICE },
    });

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.invoice_no).toBe(INVOICE);
    // Overall confidence stays the WEAKEST field's, not the corrected one's — a human-confirmed
    // invoice number says nothing about how well the MIN was read.
    expect(result.confidence).toBeCloseTo(0.95, 5);
  });

  it('gives the corrected field itself full confidence', () => {
    const result = validate([`MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'], {
      overrides: { invoice_no: INVOICE, min: MIN, receipt_date: '2026-07-28' },
    });
    expect(result.confidence).toBe(1);
  });

  it('normalizes a correction the same way OCR output is normalized', () => {
    const result = validate(GOOD_RECEIPT, { overrides: { min: ' 26O13OO956OO86199 ' } });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.min).toBe(MIN);
  });

  it('treats a correction that normalizes to nothing as missing', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { invoice_no: '  :::  ' } })).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });

  it('lets corrections rescue a document with no extractable fields at all', () => {
    const result = validate(['HELLO', 'WORLD'], {
      overrides: { invoice_no: INVOICE, min: MIN, receipt_date: '2026-07-28' },
    });
    expect(result.status).toBe('valid');
  });
});

describe('validateReceipt — document id safety', () => {
  it('rejects field values that would produce an illegal Firestore document id', () => {
    // A slash would silently create a subcollection path rather than failing.
    const result = validate(GOOD_RECEIPT, { overrides: { invoice_no: '000/21838' } });
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    // The format rule catches it first; either way it never reaches Firestore.
    expect(['INVOICE_MALFORMED', 'RECEIPT_KEY_INVALID']).toContain(result.reject);
  });

  it('rejects an over-long key', () => {
    const rules: ReceiptRules = {
      ...receiptRules,
      invoice: { ...receiptRules.invoice, pattern: /^[A-Z0-9-]+$/ },
      min: { ...receiptRules.min, pattern: /^[0-9-]+$/ },
    };
    const result = validateReceipt({
      doc: docOf(GOOD_RECEIPT),
      rules,
      nowMs: NOW,
      mode: 'claim',
      overrides: { invoice_no: 'A'.repeat(800), min: '1'.repeat(800) },
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
      mode: 'claim',
    });

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.key).toBe(`${MIN}__${INVOICE}`);
  });

  it('handles a receipt with the invoice line torn off', () => {
    const result = validate(
      ['OUTLETS MALL', `MIN ${MIN}`, 'DATE 07/28/2026', 'TOTAL 500.00'],
      { mode: 'scan' },
    );
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
  });
});

describe('validateReceipt — rules are data', () => {
  it('honours a different claim window without any code change', () => {
    const strict: ReceiptRules = {
      ...receiptRules,
      window: { ...receiptRules.window, maxAgeDays: 0 },
    };
    const doc = docOf(minimal('DATE 07/27/2026'));

    expect(validateReceipt({ doc, rules: strict, nowMs: NOW, mode: 'claim' })).toMatchObject({
      reject: 'DATE_EXPIRED',
    });
    expect(validateReceipt({ doc, rules: receiptRules, nowMs: NOW, mode: 'claim' }).status).toBe(
      'valid',
    );
  });

  it('honours a DMY locale order without any code change', () => {
    const dmy: ReceiptRules = {
      ...receiptRules,
      date: { ...receiptRules.date, localeOrder: 'DMY' },
    };
    const doc = visionToOcrDocument(makeSimpleReceipt(minimal('DATE 07/08/2026')));

    const result = validateReceipt({
      doc,
      rules: dmy,
      nowMs: Date.UTC(2026, 7, 8, 4),
      mode: 'claim',
    });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    // 07/08 read as 7 August, not 8 July.
    expect(new Date(result.fields.receipt_date_ms).toISOString()).toBe('2026-08-06T16:00:00.000Z');
  });
});
