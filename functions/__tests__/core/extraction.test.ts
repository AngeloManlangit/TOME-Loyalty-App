import {
  makeSimpleReceipt,
  makeTwoColumnReceipt,
  makeVisionResponse,
} from '../../__fixtures__/synth/makeVisionResponse';
import { distanceBudget, findAnchors } from '../../src/receipts/core/anchors';
import { extractDateCandidates } from '../../src/receipts/core/extractDate';
import { extractFieldCandidates, MAX_CANDIDATES } from '../../src/receipts/core/extractField';
import { receiptRules } from '../../src/receipts/core/rules.config';
import type { OcrDocument } from '../../src/receipts/core/types';
import { visionToOcrDocument } from '../../src/receipts/core/visionAdapter';

const docOf = (lines: string[]): OcrDocument => visionToOcrDocument(makeSimpleReceipt(lines));

describe('findAnchors', () => {
  it('finds an exact label', () => {
    const anchors = findAnchors(docOf(['INVOICE NO 12345']).lines, ['INVOICE NO']);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.distance).toBe(0);
    expect(anchors[0]!.trailing).toBe('12345');
  });

  it('finds a label Vision mangled', () => {
    // Vision damages labels as often as values; an exact search would miss this receipt entirely.
    const anchors = findAnchors(docOf(['INVOlCE NO 12345']).lines, ['INVOICE NO']);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.trailing).toBe('12345');
  });

  it('absorbs trailing punctuation into the label instead of the value', () => {
    // The tie-break toward the longer run consumes both "NO." and the ":" separator, so the value
    // comes out clean rather than needing punctuation stripped off it afterwards.
    const anchors = findAnchors(docOf(['INVOICE NO. : 12345']).lines, ['INVOICE NO']);
    expect(anchors[0]!.trailing).toBe('12345');
  });

  it('matches a label whose words OCR split apart', () => {
    const anchors = findAnchors(docOf(['INV # 12345']).lines, ['INV']);
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

  describe('distanceBudget', () => {
    it('allows one edit for short labels and two for long ones', () => {
      expect(distanceBudget('ACCN')).toBe(1);
      expect(distanceBudget('DATE')).toBe(1);
      expect(distanceBudget('ACKNOWLEDGEMENT CERTIFICATE')).toBe(2);
    });
  });
});

describe('extractFieldCandidates', () => {
  describe('invoice number', () => {
    it('takes the value inline after the label', () => {
      const doc = docOf(['OUTLETS MALL', 'INVOICE NO SI-004512', 'TOTAL 500.00']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates[0]!.value).toBe('SI-004512');
      expect(candidates[0]!.source).toBe('inline');
    });

    it('strips the colon separator from the value', () => {
      const doc = docOf(['INVOICE NO: SI-004512']);
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe('SI-004512');
    });

    it('finds a value on the line BELOW the label', () => {
      const doc = docOf(['SALES INVOICE', 'SI-004512', 'TOTAL 500.00']);
      const values = extractFieldCandidates(doc, receiptRules.invoice).map((c) => c.value);
      expect(values).toContain('SI-004512');
    });

    it('reunites label and value across Vision blocks in a two-column layout', () => {
      const doc = visionToOcrDocument(
        makeTwoColumnReceipt([
          ['INVOICE NO', 'SI-004512'],
          ['TOTAL', '500.00'],
        ]),
      );
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe('SI-004512');
    });

    it('still proposes something when the label is unreadable, ranked low', () => {
      const doc = docOf(['OUTLETS MALL', 'XXXXXX SI-004512', 'TOTAL 500.00']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      const match = candidates.find((c) => c.value === 'SI-004512');
      expect(match).toBeDefined();
      expect(match!.source).toBe('pattern-scan');
    });

    it('returns ranked alternates, which become the review screen chips', () => {
      const doc = docOf(['INVOICE NO SI-004512', 'REF NO RF-99887']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates.length).toBeGreaterThan(1);
      expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[1]!.score);
    });

    it('caps the candidate list', () => {
      const doc = docOf(
        Array.from({ length: 40 }, (_, i) => `LINE${i} VALUE${String(i).padStart(4, '0')}`),
      );
      expect(extractFieldCandidates(doc, receiptRules.invoice).length).toBeLessThanOrEqual(
        MAX_CANDIDATES,
      );
    });

    it('returns nothing when no token matches the format', () => {
      const doc = docOf(['A', 'B', 'C']);
      expect(extractFieldCandidates(doc, receiptRules.invoice)).toEqual([]);
    });

    it('discards tokens that normalize away to nothing', () => {
      // Thermal printers scatter decorative punctuation; a standalone '***' or ':' must not become
      // an empty-string candidate.
      const doc = docOf(['*** INVOICE NO : SI-004512 ***']);
      const candidates = extractFieldCandidates(doc, receiptRules.invoice);
      expect(candidates.map((c) => c.value)).not.toContain('');
      expect(candidates[0]!.value).toBe('SI-004512');
    });
  });

  describe('ACCN', () => {
    it('extracts a dash-grouped ACCN and repairs digit confusions', () => {
      // 'll6-OOO123456789' is what faded thermal print does to '116-000123456789'.
      const doc = docOf(['ACCN ll6-OOO123456789']);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.value).toBe('116-000123456789');
    });

    it('keeps the raw text alongside the repaired value so the UI can show what was read', () => {
      const doc = docOf(['ACCN ll6-OOO123456789']);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.raw).toBe('ll6-OOO123456789');
    });

    it('matches the ACK CERT alias', () => {
      const doc = docOf(['ACK CERT 116000123456789']);
      expect(extractFieldCandidates(doc, receiptRules.accn)[0]!.value).toBe('116000123456789');
    });

    it('does not repair digits for the invoice field, which may contain real letters', () => {
      const doc = docOf(['INVOICE NO SO-12345']);
      expect(extractFieldCandidates(doc, receiptRules.invoice)[0]!.value).toBe('SO-12345');
    });
  });

  it('keeps the first occurrence when a duplicate value ties on score and is no more confident', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'AA-1111', x: 400, confidence: 0.9 }] },
        { y: 200, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'AA-1111', x: 400, confidence: 0.5 }] },
      ],
    });
    const candidates = extractFieldCandidates(visionToOcrDocument(response), receiptRules.invoice);
    const match = candidates.filter((c) => c.value === 'AA-1111');
    expect(match).toHaveLength(1);
    expect(match[0]!.confidence).toBeCloseTo(0.9, 5);
  });

  it('prefers a higher-confidence candidate when scores tie', () => {
    const response = makeVisionResponse({
      rows: [
        { y: 100, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'AA-1111', x: 400, confidence: 0.4 }] },
        { y: 200, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'BB-2222', x: 400, confidence: 0.99 }] },
      ],
    });
    const candidates = extractFieldCandidates(visionToOcrDocument(response), receiptRules.invoice);
    expect(candidates[0]!.value).toBe('BB-2222');
  });
});

describe('extractDateCandidates', () => {
  it('extracts an inline date', () => {
    const doc = docOf(['DATE 07/28/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date);
    expect(candidates[0]!.value).toBe('2026-07-28');
    expect(candidates[0]!.source).toBe('inline');
  });

  it('keeps a printed time rather than discarding it', () => {
    const doc = docOf(['DATE 07/28/2026 14:30:00']);
    expect(extractDateCandidates(doc, receiptRules.date)[0]!.value).toBe('2026-07-28 14:30:00');
  });

  it('spans a multi-word date like JUL 28, 2026', () => {
    const doc = docOf(['TRANSACTION DATE JUL 28, 2026']);
    expect(extractDateCandidates(doc, receiptRules.date)[0]!.value).toBe('2026-07-28');
  });

  it('finds a date across a two-column layout', () => {
    const doc = visionToOcrDocument(
      makeTwoColumnReceipt([
        ['DATE', '07/28/2026'],
        ['TOTAL', '500.00'],
      ]),
    );
    expect(extractDateCandidates(doc, receiptRules.date)[0]!.value).toBe('2026-07-28');
  });

  it('finds an unlabelled date, ranked low', () => {
    const doc = docOf(['OUTLETS MALL', '07/28/2026', 'TOTAL 500.00']);
    const candidates = extractDateCandidates(doc, receiptRules.date);
    expect(candidates[0]!.value).toBe('2026-07-28');
    expect(candidates[0]!.source).toBe('pattern-scan');
  });

  it('returns nothing when the receipt carries no date', () => {
    expect(extractDateCandidates(docOf(['TOTAL 500.00']), receiptRules.date)).toEqual([]);
  });

  it('does not mistake a bare number for a date', () => {
    expect(extractDateCandidates(docOf(['TOTAL 12345']), receiptRules.date)).toEqual([]);
  });

  it('offers several dates as alternates when the receipt prints more than one', () => {
    const doc = docOf(['DATE 07/28/2026', 'DUE 08/28/2026']);
    const values = extractDateCandidates(doc, receiptRules.date).map((c) => c.value);
    expect(values).toContain('2026-07-28');
    expect(values).toContain('2026-08-28');
  });

  it('caps the candidate list', () => {
    const doc = docOf(Array.from({ length: 40 }, (_, i) => `LINE 07/${(i % 28) + 1}/2026`));
    expect(extractDateCandidates(doc, receiptRules.date).length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });
});
