import { makeVisionResponse } from '../../__fixtures__/synth/makeVisionResponse';
import { findAnchors, splitGluedLabel } from '../../src/receipts/core/anchors';
import { extractDateCandidates } from '../../src/receipts/core/extractDate';
import { extractFieldCandidates } from '../../src/receipts/core/extractField';
import type { ReceiptRules } from '../../src/receipts/core/rules.config';
import { receiptRules } from '../../src/receipts/core/rules.config';
import type { OcrDocument, ValidationOutcome } from '../../src/receipts/core/types';
import { validateReceipt } from '../../src/receipts/core/validate';
import { visionToOcrDocument } from '../../src/receipts/core/visionAdapter';

/**
 * Tests for the corrected acceptance criteria, derived from the real fixture corpus:
 * uniqueness keys on MIN + invoice, ACCN is corroboration only, TIN drives accreditation.
 */

const NOW = Date.UTC(2026, 6, 28, 4, 0, 0);
const VENDOR_ACCN = '0810107191682022121668';

const docOf = (lines: string[]): OcrDocument =>
  visionToOcrDocument(
    makeVisionResponse({
      rows: lines.map((text, i) => ({ y: 100 + i * 30, cells: [{ text, x: 50 }] })),
    }),
  );

const RECEIPT = [
  'HARBOUR CITY DIMSUM HOUSE',
  'VAT REG TIN 003-583-915-00006',
  'MIN: 26013009560086199',
  'INV#00021838',
  'JUL 22 2026',
  `ACCN#: ${VENDOR_ACCN}`,
];

const run = (lines: string[], rules: ReceiptRules = receiptRules): ValidationOutcome =>
  validateReceipt({ doc: docOf(lines), rules, nowMs: NOW, mode: 'claim' });

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('splitGluedLabel', () => {
  it('splits a label glued to its value with a separator', () => {
    expect(splitGluedLabel('INV#00021838', 'INV')).toBe('00021838');
    expect(splitGluedLabel('MIN:26013009560086199', 'MIN')).toBe('26013009560086199');
  });

  it('splits when a digit follows the label directly, with no separator', () => {
    expect(splitGluedLabel('INV00021838', 'INV')).toBe('00021838');
  });

  it('refuses to split a word that merely STARTS with the alias', () => {
    // Without the separator/digit guard, "INVOICE" would decompose into INV + OICE and every
    // receipt would sprout a phantom invoice number.
    expect(splitGluedLabel('INVOICE', 'INV')).toBeNull();
    expect(splitGluedLabel('MINIMUM', 'MIN')).toBeNull();
  });

  it('returns null when the word does not start with the alias', () => {
    expect(splitGluedLabel('TOTAL', 'INV')).toBeNull();
  });

  it('returns null when nothing follows the label', () => {
    expect(splitGluedLabel('INV', 'INV')).toBeNull();
    expect(splitGluedLabel('INV#', 'INV')).toBeNull();
  });

  it('returns null for an empty alias', () => {
    expect(splitGluedLabel('ANYTHING', '')).toBeNull();
    expect(splitGluedLabel('ANYTHING', '   ')).toBeNull();
  });

  it('ignores spaces inside a multi-word alias', () => {
    expect(splitGluedLabel('SINO:0000074565', 'SI NO')).toBe('0000074565');
  });

  it('matches a PUNCTUATED label like S.I.#', () => {
    // Comparing raw prefixes would miss this: "S.I.#0001234" does not start with "SI", but its
    // first three characters reduce to exactly that.
    expect(splitGluedLabel('S.I.#0001234', 'SI')).toBe('0001234');
    expect(splitGluedLabel('SI#0001234', 'SI')).toBe('0001234');
    expect(splitGluedLabel('I.N.V.#00021838', 'INV')).toBe('00021838');
  });

  it('does not treat every #-separated number as an invoice', () => {
    // The corpus prints "TM#0027" (terminal) and "Order # 7". Both look exactly like an invoice
    // number once split, so the LABEL has to carry the whole distinction.
    expect(splitGluedLabel('TM#0027', 'INV')).toBeNull();
    expect(splitGluedLabel('TM#0027', 'SI')).toBeNull();
  });
});

describe('invoice labels are deliberately narrow', () => {
  const invoiceValues = (lines: string[]): string[] =>
    extractFieldCandidates(docOf(lines), receiptRules.invoice)
      .filter((c) => c.source !== 'pattern-scan')
      .map((c) => c.value);

  it.each([
    ['TM#0027', 'terminal number'],
    ['ORDER # 7000', 'order number'],
    ['TRANS NO 0027', 'transaction number'],
    ['OR NO 0027', 'official receipt number'],
    ['REF NO 123456', 'payment reference'],
    ['SALES INVOICE', 'the document title'],
  ])('does not anchor an invoice number on %s (%s)', (line) => {
    expect(invoiceValues(['HEADER', line, 'TOTAL 500.00'])).toEqual([]);
  });

  it.each([
    ['INV#00021838', '00021838'],
    ['INV NO 00021838', '00021838'],
    ['INVOICE NO 00021838', '00021838'],
    ['SI No: 0000074565', '0000074565'],
    ['S.I.#0000074565', '0000074565'],
  ])('DOES anchor on %s', (line, expected) => {
    expect(invoiceValues(['HEADER', line, 'TOTAL 500.00'])).toContain(expected);
  });
});

describe('anchors — glued matches and position', () => {
  it('keeps the glued match when a spaced match on the same line ties on distance', () => {
    const anchors = findAnchors(docOf(['INV#00021838 INV 999']).lines, ['INV']);
    expect(anchors[0]!.gluedValue).toBe('00021838');
  });

  it('keeps the FIRST glued match when a line carries two of them', () => {
    // Both are exact-distance matches, so neither can improve on the other; the earlier one stands.
    const anchors = findAnchors(docOf(['INV#00021838 INV#00099999']).lines, ['INV']);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.gluedValue).toBe('00021838');
  });

  it('prefers the label printed earliest on a merged line', () => {
    // The Robinsons failure: "INVOICE NO" appears mid-line as part of a title, and winning the tie
    // made the invoice number come out as the word that followed it.
    const line = 'SI NO : 0000074565 THIS SERVES AS YOUR SALES INVOICE TERMINAL NO : 0025';
    const anchors = findAnchors(docOf([line]).lines, ['SI NO', 'INVOICE NO']);
    expect(anchors[0]!.startWord).toBe(0);
    expect(anchors[0]!.trailing.startsWith('0000074565')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('date candidate ranking', () => {
  it('reads a date glued to its label', () => {
    const doc = docOf(['DATE:07/22/2026']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-22');
  });

  it('ignores a glued value that is not a date', () => {
    const doc = docOf(['DATE:NOTADATE', '07/22/2026']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-22');
  });

  it('ranks a future date LAST — a transaction cannot have happened yet', () => {
    const doc = docOf(['VALIDITY : 03/29/2023 - 03/28/2028', 'JUL 22 2026']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-22');
  });

  it('prefers the most recent non-future date', () => {
    // Permit issue dates necessarily predate the sale.
    const doc = docOf(['ISSUED ON: FEBRUARY 02, 2026', 'JUL 22 2026']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-22');
  });

  it('falls back to confidence when two candidates share a date and score', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: '07/22/2026', x: 50, confidence: 0.3 }] },
        { y: 130, cells: [{ text: '07/22/2026', x: 50, confidence: 0.9 }] },
      ],
    });
    const candidates = extractDateCandidates(visionToOcrDocument(response), receiptRules.date, NOW);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.confidence).toBeCloseTo(0.9, 5);
  });

  it('falls back to document order when two candidates tie on instant AND confidence', () => {
    // A bare date and the same date with a midnight time are different candidate VALUES that
    // resolve to the identical instant, so the ordering has to bottom out somewhere deterministic.
    const doc = docOf(['07/22/2026', '07/22/2026 00:00:00']);
    const candidates = extractDateCandidates(doc, receiptRules.date, NOW);
    expect(candidates.map((c) => c.value)).toEqual(['2026-07-22', '2026-07-22 00:00:00']);
  });

  it('picks the transaction date out of a receipt carrying four different dates', () => {
    const doc = docOf([
      'ISSUED ON: FEBRUARY 02, 2026',
      'JUL 22 2026',
      'VALIDITY : 03/29/2023 - 03/28/2028',
    ]);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-22');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('TIN — preferEarliest', () => {
  it('takes the merchant TIN at the top over the POS vendor TIN in the footer', () => {
    const doc = docOf([
      'VAT REG TIN 003-583-915-00006',
      'MIN: 26013009560086199',
      'POS RELATED SUPPORT',
      'VAT REG TIN 010-719-168-00000',
    ]);
    expect(extractFieldCandidates(doc, receiptRules.tin)[0]!.value).toBe('003-583-915-00006');
  });

  it('does not apply that preference to fields without the flag', () => {
    const doc = docOf(['INVOICE NO 00001111', 'INVOICE NO 00002222']);
    const values = extractFieldCandidates(doc, receiptRules.invoice).map((c) => c.value);
    expect(values).toContain('00001111');
    expect(values).toContain('00002222');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('ACCN as corroboration, not identity', () => {
  const requiring: ReceiptRules = {
    ...receiptRules,
    accreditation: { ...receiptRules.accreditation, requireAccn: true },
  };

  it('is carried on the result when present', () => {
    const result = run(RECEIPT);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.fields.accn).toBe(VENDOR_ACCN);
    expect(result.fields.tin).toBe('003-583-915-00006');
  });

  it('is NOT required by default, so a receipt whose ACCN was lost still claims', () => {
    // This is the Robinsons fixture's situation exactly.
    const withoutAccn = RECEIPT.filter((l) => !l.startsWith('ACCN'));
    expect(run(withoutAccn).status).toBe('valid');
  });

  it('rejects a missing ACCN once requireAccn is enabled', () => {
    const withoutAccn = RECEIPT.filter((l) => !l.startsWith('ACCN'));
    expect(run(withoutAccn, requiring)).toMatchObject({
      status: 'rejected',
      reject: 'ACCN_MISSING',
    });
  });

  it('rejects a malformed ACCN once requireAccn is enabled', () => {
    const result = validateReceipt({
      doc: docOf(RECEIPT),
      rules: requiring,
      nowMs: NOW,
      mode: 'claim',
      overrides: { accn: '123' },
    });
    expect(result).toMatchObject({ status: 'rejected', reject: 'ACCN_MALFORMED' });
  });

  it('accepts an ACCN on the vendor allowlist', () => {
    const rules: ReceiptRules = {
      ...receiptRules,
      accreditation: { ...receiptRules.accreditation, allowedVendorAccns: [VENDOR_ACCN] },
    };
    expect(run(RECEIPT, rules).status).toBe('valid');
  });

  it('rejects an ACCN absent from a non-empty vendor allowlist', () => {
    const rules: ReceiptRules = {
      ...receiptRules,
      accreditation: {
        ...receiptRules.accreditation,
        allowedVendorAccns: ['9999999999999999999999'],
      },
    };
    expect(run(RECEIPT, rules)).toMatchObject({
      status: 'rejected',
      reject: 'ACCN_NOT_ACCREDITED',
    });
  });

  it('an empty allowlist blocks nothing, so it is safe to ship enabled', () => {
    expect(receiptRules.accreditation.allowedVendorAccns).toEqual([]);
    expect(run(RECEIPT).status).toBe('valid');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('scan-mode partial results carry corroborating fields', () => {
  it('returns ACCN and TIN alongside a partial result', () => {
    const noInvoice = RECEIPT.filter((l) => !l.startsWith('INV#'));
    const result = validateReceipt({
      doc: docOf(noInvoice),
      rules: receiptRules,
      nowMs: NOW,
      mode: 'scan',
    });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('INVOICE_MISSING');
    expect(result.fields.accn).toBe(VENDOR_ACCN);
    expect(result.fields.tin).toBe('003-583-915-00006');
    expect(result.fields.min).toBe('26013009560086199');
  });

  it('omits a rejected ACCN from the partial result', () => {
    const requiring: ReceiptRules = {
      ...receiptRules,
      accreditation: {
        ...receiptRules.accreditation,
        requireAccn: true,
        allowedVendorAccns: ['9999999999999999999999'],
      },
    };
    const result = validateReceipt({
      doc: docOf(RECEIPT),
      rules: requiring,
      nowMs: NOW,
      mode: 'scan',
    });

    expect(result.status).toBe('needs_review');
    if (result.status !== 'needs_review') return;
    expect(result.softRejects).toContain('ACCN_NOT_ACCREDITED');
    expect(result.fields.accn).toBeUndefined();
  });
});
