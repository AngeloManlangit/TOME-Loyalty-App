import {
  makeSimpleReceipt,
  makeTwoColumnReceipt,
  makeVisionResponse,
} from '../../__fixtures__/synth/makeVisionResponse';
import { distanceBudget, findAnchors, splitGluedLabel } from '../../src/receipts/core/anchors';
import { extractDateCandidates } from '../../src/receipts/core/extractDate';
import { extractFieldCandidates, MAX_CANDIDATES } from '../../src/receipts/core/extractField';
import { receiptRules } from '../../src/receipts/core/rules.config';
import type { OcrDocument } from '../../src/receipts/core/types';
import { visionToOcrDocument } from '../../src/receipts/core/visionAdapter';

const docOf = (lines: string[]): OcrDocument => visionToOcrDocument(makeSimpleReceipt(lines));

/** Server clock for the date tests: 28 Jul 2026, 12:00 Manila (04:00 UTC). */
const NOW = Date.UTC(2026, 6, 28, 4, 0, 0);

/** Corpus-shaped values. Formats are digits-only per rules.config; see the D.3 notes there. */
const INVOICE = '00021838';
const MIN = '26013009560086199';
const ACCN = '0810107191682022121668';

describe('findAnchors', () => {
  it('finds an exact label', () => {
    const anchors = findAnchors(docOf([`INVOICE NO ${INVOICE}`]).lines, ['INVOICE NO']);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.distance).toBe(0);
    expect(anchors[0]!.trailing).toBe(INVOICE);
  });

  it('finds a label Vision mangled', () => {
    // Vision damages labels as often as values; an exact search would miss this receipt entirely.
    const anchors = findAnchors(docOf([`INVOlCE NO ${INVOICE}`]).lines, ['INVOICE NO']);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.trailing).toBe(INVOICE);
  });

  it('absorbs trailing punctuation into the label instead of the value', () => {
    // The tie-break toward the longer run consumes both "NO." and the ":" separator, so the value
    // comes out clean rather than needing punctuation stripped off it afterwards.
    const anchors = findAnchors(docOf([`INVOICE NO. : ${INVOICE}`]).lines, ['INVOICE NO']);
    expect(anchors[0]!.trailing).toBe(INVOICE);
  });

  it('matches a label whose words OCR split apart', () => {
    const anchors = findAnchors(docOf([`INV # ${INVOICE}`]).lines, ['INV']);
    expect(anchors).toHaveLength(1);
  });

  it('returns nothing when no line carries the label', () => {
    expect(findAnchors(docOf(['TOTAL 500.00', 'CASH 1000.00']).lines, ['INVOICE NO'])).toEqual([]);
  });

  it('does not match a label that is merely similar but too far', () => {
    expect(findAnchors(docOf(['SUBTOTAL 500.00']).lines, ['ACCN'])).toEqual([]);
  });

  it('ignores an empty alias', () => {
    expect(findAnchors(docOf(['ANYTHING']).lines, [''])).toEqual([]);
  });

  it('records an empty trailing when the label ends the line', () => {
    const anchors = findAnchors(docOf(['ACCN']).lines, ['ACCN']);
    expect(anchors[0]!.trailing).toBe('');
  });

  it('orders results by edit distance, closest first', () => {
    const anchors = findAnchors(docOf(['ACCM 111', 'ACCN 222']).lines, ['ACCN']);
    expect(anchors.map((a) => a.distance)).toEqual([0, 1]);
    expect(anchors[0]!.trailing).toBe('222');
  });

  it('breaks a tie toward the EARLIEST label on the line', () => {
    // The Robinsons fixture carries "SI NO" at position 0 and the document title "SALES INVOICE"
    // mid-line. Preferring the later label yielded the invoice number "TERMINAL".
    const anchors = findAnchors(
      docOf([`SI NO ${INVOICE} TERMINAL SI NO 0000`]).lines,
      ['SI NO'],
    );
    expect(anchors[0]!.startWord).toBe(0);
    expect(anchors[0]!.trailing.startsWith(INVOICE)).toBe(true);
  });

  describe('distanceBudget', () => {
    it('allows no edit for very short labels, one for short, two for long', () => {
      // A budget of 1 on a 3-letter alias would have "MIN" matching "TIN", "PIN" and each other.
      expect(distanceBudget('MIN')).toBe(0);
      expect(distanceBudget('ACCN')).toBe(1);
      expect(distanceBudget('DATE')).toBe(1);
      expect(distanceBudget('ACKNOWLEDGEMENT CERTIFICATE')).toBe(2);
    });
  });

  describe('splitGluedLabel', () => {
    it('splits a label printed glued to its value', () => {
      expect(splitGluedLabel(`INV#${INVOICE}`, 'INV')).toBe(INVOICE);
    });

    it('splits a punctuated label form', () => {
      expect(splitGluedLabel('S.I.#0001234', 'SI')).toBe('0001234');
    });

    it('refuses to decompose a longer word that merely starts with the alias', () => {
      // Without the digit requirement, alias "INV" would split "INVOICE" into INV + OICE and claim
      // "OICE" as an invoice number.
      expect(splitGluedLabel('INVOICE', 'INV')).toBeNull();
    });

    it('returns null when the alias is not a prefix at all', () => {
      expect(splitGluedLabel('TOTAL', 'INV')).toBeNull();
    });

    it('returns null when nothing follows the label', () => {
      expect(splitGluedLabel('INV', 'INV')).toBeNull();
    });

    it('returns null for an empty alias', () => {
      expect(splitGluedLabel('ANYTHING', '')).toBeNull();
    });
  });
});

describe('extractFieldCandidates', () => {
  describe('invoice number', () => {
    it('takes the value inline after the label', () => {
      const doc = docOf(['OUTLETS MALL', `INVOICE NO ${INVOICE}`, 'TOTAL 500.00']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates[0]!.value).toBe(INVOICE);
      expect(candidates[0]!.source).toBe('inline');
    });

    it('reads a value glued to its label', () => {
      // The ZenPOS receipts print "INV#00021838" as a single token, which matched no alias at all
      // before splitGluedLabel and lost the field on 3 of the 4 corpus receipts.
      const doc = docOf(['OUTLETS MALL', `INV#${INVOICE}`, 'TOTAL 500.00']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates[0]!.value).toBe(INVOICE);
      expect(candidates[0]!.source).toBe('inline');
    });

    it('strips the colon separator from the value', () => {
      const doc = docOf([`INVOICE NO: ${INVOICE}`]);
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe(INVOICE);
    });

    it('finds a value on the line BELOW the label', () => {
      const doc = docOf(['INVOICE NO', INVOICE, 'TOTAL 500.00']);
      const values = extractFieldCandidates(doc, receiptRules.invoice).map((c) => c.value);
      expect(values).toContain(INVOICE);
    });

    it('reunites label and value across Vision blocks in a two-column layout', () => {
      const doc = visionToOcrDocument(
        makeTwoColumnReceipt([
          ['INVOICE NO', INVOICE],
          ['TOTAL', '500.00'],
        ]),
      );
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe(INVOICE);
    });

    it('still proposes something when the label is unreadable, ranked low', () => {
      const doc = docOf(['OUTLETS MALL', `XXXXXX ${INVOICE}`, 'TOTAL 500.00']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      const match = candidates.find((c) => c.value === INVOICE);
      expect(match).toBeDefined();
      expect(match!.source).toBe('pattern-scan');
    });

    it('decays the score of words further from the label', () => {
      // On a merged line — a photo containing more than one document — treating every trailing word
      // equally let a number twenty tokens away outrank the real invoice number.
      const doc = docOf([`INVOICE NO ${INVOICE} 99887766`]);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      const near = candidates.find((c) => c.value === INVOICE)!;
      const far = candidates.find((c) => c.value === '99887766')!;
      expect(near.score).toBeGreaterThan(far.score);
    });

    it('returns ranked alternates, which become the review screen chips', () => {
      const doc = docOf([`INVOICE NO ${INVOICE}`, 'ORDER NO 00099887']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates.length).toBeGreaterThan(1);
      expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[1]!.score);
    });

    it('caps the candidate list', () => {
      const doc = docOf(
        Array.from({ length: 40 }, (_, i) => `LINE${i} ${String(i).padStart(6, '0')}`),
      );
      expect(extractFieldCandidates(doc, receiptRules.invoice).length).toBeLessThanOrEqual(
        MAX_CANDIDATES,
      );
    });

    it('returns nothing when no token matches the format', () => {
      const doc = docOf(['A', 'B', 'C']);
      expect(extractFieldCandidates(doc, receiptRules.invoice)).toEqual([]);
    });

    it('rejects a word, which is never an invoice number', () => {
      // The permissive placeholder pattern accepted "SERVES" out of "THIS SERVES AS AN OFFICIAL
      // SALES INVOICE". Requiring digits rejects that whole class of misread.
      const doc = docOf(['THIS SERVES AS AN OFFICIAL SALES INVOICE']);
      const values = extractFieldCandidates(doc, receiptRules.invoice).map((c) => c.value);
      expect(values).not.toContain('SERVES');
    });

    it('repairs digit confusions, since the field is numeric-only', () => {
      const doc = docOf(['INVOICE NO OOO21838']);
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe(INVOICE);
    });

    it('discards tokens that normalize away to nothing', () => {
      // Thermal printers scatter decorative punctuation; a standalone '***' or ':' must not become
      // an empty-string candidate.
      const doc = docOf([`*** INVOICE NO : ${INVOICE} ***`]);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates.map((c) => c.value)).not.toContain('');
      expect(candidates[0]!.value).toBe(INVOICE);
    });
  });

  describe('MIN — the terminal identity', () => {
    it('extracts a labelled MIN', () => {
      const doc = docOf(['OUTLETS MALL', `MIN: ${MIN}`, 'TOTAL 500.00']);
      expect(extractFieldCandidates(doc, receiptRules.min)[0]!.value).toBe(MIN);
    });

    it('accepts an unlabelled MIN, whose 17-digit shape is discriminating on its own', () => {
      const doc = docOf(['OUTLETS MALL', MIN, 'TOTAL 500.00']);
      expect(extractFieldCandidates(doc, receiptRules.min)[0]!.value).toBe(MIN);
    });

    it('does not mistake a short number for a MIN', () => {
      const doc = docOf(['TOTAL 500', 'CASH 1000']);
      expect(extractFieldCandidates(doc, receiptRules.min)).toEqual([]);
    });
  });

  describe('ACCN', () => {
    it('extracts an ACCN and repairs digit confusions', () => {
      // 'O8lOlO7l9l682O22l2l668' is what faded thermal print does to the 22-digit ACCN.
      const doc = docOf(['ACCN O8lOlO7l9l682O22l2l668']);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.value).toBe(ACCN);
    });

    it('keeps the raw text alongside the repaired value so the UI can show what was read', () => {
      const doc = docOf(['ACCN O8lOlO7l9l682O22l2l668']);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.raw).toBe('O8lOlO7l9l682O22l2l668');
    });

    it('matches the ACK CERT alias', () => {
      const doc = docOf([`ACK CERT ${ACCN}`]);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.value).toBe(ACCN);
    });
  });

  describe('TIN — identifies the business', () => {
    it('does not repair digits for the TIN, which is not numeric-only', () => {
      const doc = docOf(['VAT REG TIN 003-583-915-00006']);
      expect(extractFieldCandidates(doc, receiptRules.tin)[0]!.value).toBe('003-583-915-00006');
    });

    it("prefers the merchant's TIN at the top over the POS vendor's in the footer", () => {
      // Both carry a "VAT REG TIN" label and tie on every other signal, so without preferEarliest
      // the footer's can win and the accreditation lookup checks the wrong business.
      const doc = docOf([
        'HARBOUR CITY DIMSUM HOUSE',
        'VAT REG TIN 003-583-915-00006',
        'TOTAL 500.00',
        'POS BY CODELIKEUS TECHNOLOGIES INC',
        'VAT REG TIN 666-910-241-000',
      ]);
      expect(extractFieldCandidates(doc, receiptRules.tin)[0]!.value).toBe('003-583-915-00006');
    });
  });

  it('keeps the first occurrence when a duplicate value ties on score and is no more confident', () => {
    const response = makeVisionResponse({
      rows: [
        {
          y: 100,
          cells: [
            { text: 'INVOICE NO', x: 50 },
            { text: INVOICE, x: 400, confidence: 0.9 },
          ],
        },
        {
          y: 200,
          cells: [
            { text: 'INVOICE NO', x: 50 },
            { text: INVOICE, x: 400, confidence: 0.5 },
          ],
        },
      ],
    });
    const candidates = extractFieldCandidates(visionToOcrDocument(response), receiptRules.invoice);
    const match = candidates.filter((c) => c.value === INVOICE);
    expect(match).toHaveLength(1);
    expect(match[0]!.confidence).toBeCloseTo(0.9, 5);
  });

  it('prefers a higher-confidence candidate when scores tie', () => {
    const response = makeVisionResponse({
      rows: [
        {
          y: 100,
          cells: [
            { text: 'INVOICE NO', x: 50 },
            { text: '00021838', x: 400, confidence: 0.4 },
          ],
        },
        {
          y: 200,
          cells: [
            { text: 'INVOICE NO', x: 50 },
            { text: '00022492', x: 400, confidence: 0.99 },
          ],
        },
      ],
    });
    const candidates = extractFieldCandidates(visionToOcrDocument(response), receiptRules.invoice);
    expect(candidates[0]!.value).toBe('00022492');
  });
});

describe('extractDateCandidates', () => {
  it('extracts an inline date', () => {
    const doc = docOf(['DATE 07/28/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date, NOW);
    expect(candidates[0]!.value).toBe('2026-07-28');
    expect(candidates[0]!.source).toBe('inline');
  });

  it('keeps a printed time rather than discarding it', () => {
    const doc = docOf(['DATE 07/28/2026 14:30:00']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-28 14:30:00');
  });

  it('spans a multi-word date like JUL 28, 2026', () => {
    const doc = docOf(['TRANSACTION DATE JUL 28, 2026']);
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-28');
  });

  it('finds a date across a two-column layout', () => {
    const doc = visionToOcrDocument(
      makeTwoColumnReceipt([
        ['DATE', '07/28/2026'],
        ['TOTAL', '500.00'],
      ]),
    );
    expect(extractDateCandidates(doc, receiptRules.date, NOW)[0]!.value).toBe('2026-07-28');
  });

  it('finds an unlabelled date, ranked low', () => {
    const doc = docOf(['OUTLETS MALL', '07/28/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date, NOW);
    expect(candidates[0]!.value).toBe('2026-07-28');
    expect(candidates[0]!.source).toBe('pattern-scan');
  });

  it('returns nothing when the receipt carries no date', () => {
    expect(extractDateCandidates(docOf(['TOTAL 500.00']), receiptRules.date, NOW)).toEqual([]);
  });

  it('does not mistake a bare number for a date', () => {
    expect(extractDateCandidates(docOf(['TOTAL 12345']), receiptRules.date, NOW)).toEqual([]);
  });

  it('offers several dates as alternates when the receipt prints more than one', () => {
    const doc = docOf(['DATE 07/28/2026', 'DUE 08/28/2026']);
    const values = extractDateCandidates(doc, receiptRules.date, NOW).map((c) => c.value);
    expect(values).toContain('2026-07-28');
    expect(values).toContain('2026-08-28');
  });

  it('ranks a future date last — a transaction cannot be in the future', () => {
    // The corpus prints "VALIDITY : 03/29/2023 - 03/28/2028" and an "Issued on" permit date, both
    // unlabelled. Ranking them above the sale got valid receipts rejected as DATE_EXPIRED.
    const doc = docOf(['OUTLETS MALL', '03/28/2028', '07/27/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date, NOW);
    expect(candidates[0]!.value).toBe('2026-07-27');
  });

  it('prefers the most recent past date, since permit dates predate the sale', () => {
    const doc = docOf(['OUTLETS MALL', '02/02/2026', '07/27/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date, NOW);
    expect(candidates[0]!.value).toBe('2026-07-27');
  });

  it('caps the candidate list', () => {
    const doc = docOf(Array.from({ length: 40 }, (_, i) => `LINE 07/${(i % 28) + 1}/2026`));
    expect(extractDateCandidates(doc, receiptRules.date, NOW).length).toBeLessThanOrEqual(
      MAX_CANDIDATES,
    );
  });
});
