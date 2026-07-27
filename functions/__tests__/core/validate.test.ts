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

const GOOD_RECEIPT = [
  'OUTLETS MALL',
  'ACCN 116-000123456789',
  'INVOICE NO SI-004512',
  'DATE 07/28/2026',
  'TOTAL 500.00',
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

    expect(result.fields.invoice_no).toBe('SI-004512');
    expect(result.fields.accn).toBe('116-000123456789');
    expect(result.key).toBe('116-000123456789__SI-004512');
    expect(new Date(result.fields.receipt_date_ms).toISOString()).toBe('2026-07-27T16:00:00.000Z');
  });

  it('keys on BOTH fields, so two stores may both issue INV-0001', () => {
    const a = validate(['ACCN 116-000000000001', 'INVOICE NO INV-0001', 'DATE 07/28/2026']);
    const b = validate(['ACCN 116-000000000002', 'INVOICE NO INV-0001', 'DATE 07/28/2026']);

    expect(a.status).toBe('valid');
    expect(b.status).toBe('valid');
    if (a.status !== 'valid' || b.status !== 'valid') return;
    expect(a.key).not.toBe(b.key);
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
    expect(validate(['ACCN 116-000123456789', 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });

  it('reports INVOICE_MALFORMED for a corrected value that does not fit the format', () => {
    expect(
      validate(GOOD_RECEIPT, { overrides: { invoice_no: '!!' } }),
    ).toMatchObject({ reject: 'INVOICE_MALFORMED' });
  });
});

describe('validateReceipt — criterion 2, date and the claim window', () => {
  it('accepts a receipt dated today', () => {
    expect(validate(GOOD_RECEIPT).status).toBe('valid');
  });

  it('accepts a receipt exactly at the far edge of the window', () => {
    expect(
      validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/21/2026']).status,
    ).toBe('valid');
  });

  it('rejects a receipt one day past the window', () => {
    expect(
      validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/20/2026']),
    ).toMatchObject({ reject: 'DATE_EXPIRED' });
  });

  it('rejects a future-dated receipt', () => {
    expect(
      validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/29/2026']),
    ).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('accepts a receipt printed later TODAY, because a bare date asserts a calendar day', () => {
    // The receipt says 28 Jul with no time. Comparing instants would make it 00:00 Manila, which is
    // fine — but a receipt printed at 18:00 today must not be "future" just because now is 12:00.
    const result = validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/28/2026 18:00']);
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reject).toBe('DATE_FUTURE'); // WITH a printed time, 18:00 really is in the future
  });

  it('accepts a timed receipt within the clock-skew tolerance', () => {
    const nearFuture = NOW + 60_000; // 1 minute ahead, inside the 300s tolerance
    const doc = docOf(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/28/2026 12:01']);
    expect(
      validateReceipt({ doc, rules: receiptRules, nowMs: nearFuture - 60_000, mode: 'claim' })
        .status,
    ).toBe('valid');
  });

  it('rejects a timed receipt beyond the clock-skew tolerance', () => {
    expect(
      validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/28/2026 12:30']),
    ).toMatchObject({ reject: 'DATE_FUTURE' });
  });

  it('reports DATE_MISSING when the receipt carries no date', () => {
    expect(validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'TOTAL 500.00'])).toMatchObject({
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
    const doc = docOf(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 12/28/2026']);
    expect(
      validateReceipt({ doc, rules: receiptRules, nowMs: newYear, mode: 'claim' }).status,
    ).toBe('valid');
  });
});

describe('validateReceipt — criterion 3, ACCN', () => {
  it('reports ACCN_MISSING when absent', () => {
    expect(validate(['INVOICE NO SI-004512', 'DATE 07/28/2026', 'TOTAL 500.00'])).toMatchObject({
      reject: 'ACCN_MISSING',
    });
  });

  it('reports ACCN_MALFORMED for a corrected value that does not fit the format', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { accn: 'ABC' } })).toMatchObject({
      reject: 'ACCN_MALFORMED',
    });
  });
});

describe('validateReceipt — reject precedence is deterministic', () => {
  it('reports invoice before ACCN before date', () => {
    // Everything is wrong; the code returned must be stable so the UI copy and the tests can rely on it.
    expect(validate(['OUTLETS MALL', 'CASHIER 3', 'TOTAL 500.00', 'CASH 1000'])).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });
});

describe('validateReceipt — scan mode proposes, claim mode decides', () => {
  it('scan does not hard-reject a missing field; it asks for review', () => {
    const result = validate(['ACCN 116-000123456789', 'DATE 07/28/2026', 'TOTAL 500.00'], {
      mode: 'scan',
    });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
    expect(result.fields.accn).toBe('116-000123456789');
  });

  it('omits a field that is present but malformed from the partial result', () => {
    // The user must re-enter it; handing back a value we know is invalid would invite them to
    // just confirm it.
    const result = validate(GOOD_RECEIPT, {
      mode: 'scan',
      overrides: { accn: 'NOT-AN-ACCN' },
    });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('ACCN_MALFORMED');
    expect(result.fields.accn).toBeUndefined();
    expect(result.fields.invoice_no).toBe('SI-004512');
  });

  it('omits an out-of-window date from the partial result', () => {
    const result = validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 01/02/2026'], {
      mode: 'scan',
    });
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.fields.receipt_date_ms).toBeUndefined();
  });

  it('scan surfaces an expired date as a soft reject, so a MISREAD date can still be corrected', () => {
    const result = validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 01/02/2026'], {
      mode: 'scan',
    });
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('DATE_EXPIRED');
  });

  it('claim rejects that same expired receipt outright — the server is the authority', () => {
    expect(
      validate(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 01/02/2026'], { mode: 'claim' }),
    ).toMatchObject({ status: 'rejected', reject: 'DATE_EXPIRED' });
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
    expect(result.fields.invoice_no).toBe('SI-004512');
  });

  it('accepts it at claim time, because the user has confirmed the fields by then', () => {
    expect(lowConfidence('claim').status).toBe('valid');
  });

  it('reports the weakest field confidence, not an average that would hide it', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: 'ACCN 116-000123456789', x: 50, confidence: 0.99 }] },
        { y: 130, cells: [{ text: 'INVOICE NO SI-004512', x: 50, confidence: 0.3 }] },
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
    const result = validate(['ACCN 116-000123456789', 'DATE 07/28/2026', 'TOTAL 500.00'], {
      overrides: { invoice_no: 'SI-004512' },
    });

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.invoice_no).toBe('SI-004512');
    // Overall confidence stays the WEAKEST field's, not the corrected one's — a human-confirmed
    // invoice number says nothing about how well the ACCN was read.
    expect(result.confidence).toBeCloseTo(0.95, 5);
  });

  it('gives the corrected field itself full confidence', () => {
    const result = validate(['ACCN 116-000123456789', 'DATE 07/28/2026', 'TOTAL 500.00'], {
      overrides: { invoice_no: 'SI-004512', accn: '116-000123456789', receipt_date: '2026-07-28' },
    });
    expect(result.confidence).toBe(1);
  });

  it('normalizes a correction the same way OCR output is normalized', () => {
    const result = validate(GOOD_RECEIPT, { overrides: { accn: ' ll6-OOO123456789 ' } });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.accn).toBe('116-000123456789');
  });

  it('treats a correction that normalizes to nothing as missing', () => {
    expect(validate(GOOD_RECEIPT, { overrides: { invoice_no: '  :::  ' } })).toMatchObject({
      reject: 'INVOICE_MISSING',
    });
  });

  it('lets corrections rescue a document with no extractable fields at all', () => {
    const result = validate(['HELLO', 'WORLD'], {
      overrides: {
        invoice_no: 'SI-004512',
        accn: '116-000123456789',
        receipt_date: '2026-07-28',
      },
    });
    expect(result.status).toBe('valid');
  });
});

describe('validateReceipt — document id safety', () => {
  it('rejects field values that would produce an illegal Firestore document id', () => {
    // A slash would silently create a subcollection path rather than failing.
    const result = validate(GOOD_RECEIPT, { overrides: { invoice_no: 'SI/004512' } });
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    // The format rule catches it first; either way it never reaches Firestore.
    expect(['INVOICE_MALFORMED', 'RECEIPT_KEY_INVALID']).toContain(result.reject);
  });

  it('rejects an over-long key', () => {
    const rules: ReceiptRules = {
      ...receiptRules,
      invoice: { ...receiptRules.invoice, pattern: /^[A-Z0-9-]+$/ },
      accn: { ...receiptRules.accn, pattern: /^[0-9-]+$/ },
    };
    const result = validateReceipt({
      doc: docOf(GOOD_RECEIPT),
      rules,
      nowMs: NOW,
      mode: 'claim',
      overrides: { invoice_no: 'A'.repeat(800), accn: '1'.repeat(800) },
    });
    expect(result).toMatchObject({ status: 'rejected', reject: 'RECEIPT_KEY_INVALID' });
  });
});

describe('validateReceipt — degraded but real receipts', () => {
  it('reads a receipt whose labels and digits OCR mangled', () => {
    const result = validate([
      'OUTLETS MALL',
      'ACCM ll6-OOO123456789',
      'INVOlCE NO SI-004512',
      'DATE 07/28/2026',
    ]);

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.accn).toBe('116-000123456789');
  });

  it('reads a two-column receipt photographed at an angle', () => {
    const response = makeVisionResponse({
      blockStrategy: 'per-column',
      skew: 12,
      rows: [
        { y: 100, cells: [{ text: 'ACCN', x: 50 }, { text: '116-000123456789', x: 400 }] },
        { y: 140, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'SI-004512', x: 400 }] },
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
    expect(result.key).toBe('116-000123456789__SI-004512');
  });

  it('handles a receipt with the invoice line torn off', () => {
    const result = validate(
      ['OUTLETS MALL', 'ACCN 116-000123456789', 'DATE 07/28/2026', 'TOTAL 500.00'],
      { mode: 'scan' },
    );
    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
  });
});

describe('validateReceipt — rules are data', () => {
  it('honours a different claim window without any code change', () => {
    const strict: ReceiptRules = { ...receiptRules, window: { ...receiptRules.window, maxAgeDays: 0 } };
    const doc = docOf(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/27/2026']);

    expect(validateReceipt({ doc, rules: strict, nowMs: NOW, mode: 'claim' })).toMatchObject({
      reject: 'DATE_EXPIRED',
    });
    expect(validateReceipt({ doc, rules: receiptRules, nowMs: NOW, mode: 'claim' }).status).toBe(
      'valid',
    );
  });

  it('honours a DMY locale order without any code change', () => {
    const dmy: ReceiptRules = { ...receiptRules, date: { ...receiptRules.date, localeOrder: 'DMY' } };
    const doc = visionToOcrDocument(
      makeSimpleReceipt(['ACCN 116-000123456789', 'INVOICE NO SI-1', 'DATE 07/08/2026']),
    );

    const result = validateReceipt({ doc, rules: dmy, nowMs: Date.UTC(2026, 7, 8, 4), mode: 'claim' });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    // 07/08 read as 7 August, not 8 July.
    expect(new Date(result.fields.receipt_date_ms).toISOString()).toBe('2026-08-06T16:00:00.000Z');
  });
});
