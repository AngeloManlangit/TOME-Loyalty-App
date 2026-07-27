import {
  boxFromPoly,
  centerX,
  centerY,
  height,
  union,
  unionAll,
  verticalOverlapRatio,
  width,
} from '../../src/receipts/core/geometry';
import { boundedLevenshtein, isWithinDistance } from '../../src/receipts/core/levenshtein';
import {
  alphanumericOnly,
  normalizeFieldValue,
  normalizeText,
  repairNumericConfusions,
  stripLabelPunctuation,
} from '../../src/receipts/core/normalize';
import { buildReceiptKey } from '../../src/receipts/core/receiptKey';
import type { Box } from '../../src/receipts/core/types';

describe('boundedLevenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(boundedLevenshtein('ACCN', 'ACCN', 2)).toBe(0);
  });

  it('returns max + 1 for a negative bound', () => {
    expect(boundedLevenshtein('A', 'A', -1)).toBe(0); // identical short-circuits first
    expect(boundedLevenshtein('A', 'B', -1)).toBe(0); // max + 1 === 0
  });

  it.each([
    ['INVOICE', 'INVOlCE', 1],
    ['ACCN', 'ACCM', 1],
    ['DATE', 'DAT', 1],
    ['DATE', 'DATEE', 1],
    ['ABC', 'ACB', 2],
    ['', '', 0],
  ])('distance(%s, %s) === %i', (a, b, expected) => {
    expect(boundedLevenshtein(a, b, 3)).toBe(expected);
  });

  it('reports max + 1 once the bound is exceeded', () => {
    expect(boundedLevenshtein('ACCN', 'TOTAL', 1)).toBe(2);
  });

  it('rejects on length difference alone without doing any work', () => {
    expect(boundedLevenshtein('A', 'ABCDEFGHIJ', 2)).toBe(3);
  });

  it('handles an empty string against a non-empty one', () => {
    expect(boundedLevenshtein('', 'AB', 3)).toBe(2);
    expect(boundedLevenshtein('', 'ABCD', 2)).toBe(3);
  });

  it('is symmetric', () => {
    expect(boundedLevenshtein('INVOICE', 'INVOCE', 3)).toBe(
      boundedLevenshtein('INVOCE', 'INVOICE', 3),
    );
  });

  it('exits early when an entire DP row passes the bound', () => {
    // Long, completely dissimilar strings — the early exit is what keeps this cheap.
    expect(boundedLevenshtein('AAAAAAAAAA', 'BBBBBBBBBB', 2)).toBe(3);
  });

  it('catches a distance that only the FINAL cell exceeds, which the row-min exit misses', () => {
    // A transposition is the smallest such case: no DP row ever goes entirely past the bound, yet
    // the true distance is 2. Without the final check this would wrongly report "within 1 edit",
    // and "ACCN" would start matching "CACN".
    expect(boundedLevenshtein('AB', 'BA', 1)).toBe(2);
    expect(boundedLevenshtein('AAB', 'ABA', 1)).toBe(2);
    expect(boundedLevenshtein('AB', 'BA', 2)).toBe(2);
  });

  describe('isWithinDistance', () => {
    it('is true at the boundary and false past it', () => {
      expect(isWithinDistance('ACCN', 'ACCM', 1)).toBe(true);
      expect(isWithinDistance('ACCN', 'TOTAL', 1)).toBe(false);
    });
  });
});

describe('normalize', () => {
  describe('normalizeText', () => {
    it('uppercases, collapses whitespace and trims', () => {
      expect(normalizeText('  invoice   no  ')).toBe('INVOICE NO');
    });

    it('replaces non-breaking and thin spaces that thermal printers emit', () => {
      expect(normalizeText('INVOICE NO 123')).toBe('INVOICE NO 123');
    });

    it('collapses tabs and newlines', () => {
      expect(normalizeText('A\tB\nC')).toBe('A B C');
    });
  });

  describe('stripLabelPunctuation', () => {
    it.each([
      [': 12345', '12345'],
      ['*** 12345 ***', '12345'],
      ['#12345', '12345'],
      ['12345.', '12345'],
      ['  ==12345==  ', '12345'],
    ])('strips %s to %s', (input, expected) => {
      expect(stripLabelPunctuation(input)).toBe(expected);
    });

    it('keeps dashes and slashes, which appear inside real values', () => {
      expect(stripLabelPunctuation('SI-004512')).toBe('SI-004512');
      expect(stripLabelPunctuation('07/28/2026')).toBe('07/28/2026');
    });
  });

  describe('repairNumericConfusions', () => {
    it.each([
      ['O123', '0123'],
      ['I23', '123'],
      ['S5', '55'],
      ['B8', '88'],
      ['Z2', '22'],
      ['G6', '66'],
      ['|23', '123'],
      ['ll6', '116'],
    ])('repairs %s to %s', (input, expected) => {
      expect(repairNumericConfusions(input.toUpperCase())).toBe(expected);
    });

    it('leaves separators alone so dash grouping survives', () => {
      expect(repairNumericConfusions('116-OOO123')).toBe('116-000123');
    });
  });

  describe('normalizeFieldValue', () => {
    it('repairs digits for a numeric-only field', () => {
      expect(normalizeFieldValue(': 1l6-OOO123', true)).toBe('116-000123');
    });

    it('DOES NOT repair a field that is not numeric-only — the whole point of field scoping', () => {
      // A global O->0 substitution would corrupt every merchant name and label on the receipt.
      expect(normalizeFieldValue('SUBTOTAL', false)).toBe('SUBTOTAL');
      expect(normalizeFieldValue('SI-004512', false)).toBe('SI-004512');
    });

    it('shows what a global substitution would have done, for contrast', () => {
      expect(repairNumericConfusions('SUBTOTAL')).toBe('5U8707A1');
    });

    it('returns empty for input that is entirely punctuation', () => {
      expect(normalizeFieldValue(':::', true)).toBe('');
    });
  });

  describe('alphanumericOnly', () => {
    it('drops every separator and uppercases', () => {
      expect(alphanumericOnly('inv-oice #no.')).toBe('INVOICENO');
    });
  });
});

describe('geometry', () => {
  const b: Box = { x0: 10, y0: 20, x1: 50, y1: 40 };

  it('computes width, height and centres', () => {
    expect(width(b)).toBe(40);
    expect(height(b)).toBe(20);
    expect(centerX(b)).toBe(30);
    expect(centerY(b)).toBe(30);
  });

  it('unions two boxes', () => {
    expect(union(b, { x0: 0, y0: 30, x1: 20, y1: 60 })).toEqual({ x0: 0, y0: 20, x1: 50, y1: 60 });
  });

  it('unionAll returns null for an empty list', () => {
    expect(unionAll([])).toBeNull();
  });

  it('unionAll of one box is that box', () => {
    expect(unionAll([b])).toEqual(b);
  });

  it('unionAll folds several boxes', () => {
    expect(unionAll([b, { x0: 100, y0: 0, x1: 120, y1: 10 }])).toEqual({
      x0: 10,
      y0: 0,
      x1: 120,
      y1: 40,
    });
  });

  describe('verticalOverlapRatio', () => {
    it('is 1 for identical vertical spans', () => {
      expect(verticalOverlapRatio(b, { x0: 999, y0: 20, x1: 1099, y1: 40 })).toBe(1);
    });

    it('is 0 for disjoint spans', () => {
      expect(verticalOverlapRatio(b, { x0: 0, y0: 100, x1: 10, y1: 120 })).toBe(0);
    });

    it('is 0 when spans merely touch', () => {
      expect(verticalOverlapRatio(b, { x0: 0, y0: 40, x1: 10, y1: 60 })).toBe(0);
    });

    it('divides by the SHORTER box so a tall label still matches a short value', () => {
      const tall: Box = { x0: 0, y0: 0, x1: 10, y1: 100 };
      const short: Box = { x0: 20, y0: 40, x1: 30, y1: 60 };
      expect(verticalOverlapRatio(tall, short)).toBe(1);
    });

    it('is 0 when either box has no height', () => {
      expect(verticalOverlapRatio(b, { x0: 0, y0: 30, x1: 10, y1: 30 })).toBe(0);
      expect(verticalOverlapRatio({ x0: 0, y0: 30, x1: 10, y1: 30 }, b)).toBe(0);
    });
  });

  describe('boxFromPoly', () => {
    it('returns null for absent geometry', () => {
      expect(boxFromPoly(null)).toBeNull();
      expect(boxFromPoly(undefined)).toBeNull();
      expect(boxFromPoly({})).toBeNull();
      expect(boxFromPoly({ vertices: [] })).toBeNull();
      expect(boxFromPoly({ vertices: null })).toBeNull();
    });

    it('takes the axis-aligned hull of a rotated quad', () => {
      expect(
        boxFromPoly({
          vertices: [
            { x: 10, y: 12 },
            { x: 50, y: 8 },
            { x: 52, y: 28 },
            { x: 12, y: 32 },
          ],
        }),
      ).toEqual({ x0: 10, y0: 8, x1: 52, y1: 32 });
    });

    it('treats an omitted coordinate as 0', () => {
      expect(boxFromPoly({ vertices: [{ y: 5 }, { x: 20 }] })).toEqual({
        x0: 0,
        y0: 0,
        x1: 20,
        y1: 5,
      });
    });
  });
});

describe('buildReceiptKey', () => {
  it('builds a readable composite key', () => {
    expect(buildReceiptKey('116000123456789', 'SI-004512')).toEqual({
      ok: true,
      key: '116000123456789__SI-004512',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(buildReceiptKey('  123  ', '  ABC  ')).toEqual({ ok: true, key: '123__ABC' });
  });

  it.each([
    ['', 'INV1', 'ACCN_MISSING'],
    ['   ', 'INV1', 'ACCN_MISSING'],
    ['123', '', 'INVOICE_MISSING'],
    ['123', '   ', 'INVOICE_MISSING'],
  ])('rejects empty components (%s, %s)', (accn, invoice, reject) => {
    expect(buildReceiptKey(accn, invoice)).toEqual({ ok: false, reject });
  });

  it('rejects a slash, which would become a collection path rather than an error', () => {
    expect(buildReceiptKey('12/3', 'INV1')).toEqual({ ok: false, reject: 'ACCN_MALFORMED' });
    expect(buildReceiptKey('123', 'IN/V1')).toEqual({ ok: false, reject: 'INVOICE_MALFORMED' });
  });

  it("rejects Firestore's reserved __...__ document id pattern", () => {
    // '__' + '__' + '__' -> '____________'? No: accn '__x' + '__' + 'y__' -> '__x__y__'
    expect(buildReceiptKey('__x', 'y__')).toEqual({ ok: false, reject: 'RECEIPT_KEY_INVALID' });
  });

  it('allows a leading double underscore when the key does not also end with one', () => {
    expect(buildReceiptKey('__x', 'y')).toEqual({ ok: true, key: '__x__y' });
  });

  it('rejects a key over 1500 bytes', () => {
    const long = 'A'.repeat(1500);
    expect(buildReceiptKey(long, long)).toEqual({ ok: false, reject: 'RECEIPT_KEY_INVALID' });
  });

  it('measures the limit in BYTES, not characters', () => {
    // 'é' is two UTF-8 bytes, so 800 of them exceed 1500 bytes at only 800 characters.
    const multibyte = 'é'.repeat(800);
    expect(buildReceiptKey(multibyte, 'A')).toEqual({ ok: false, reject: 'RECEIPT_KEY_INVALID' });
  });

  it('accepts a key exactly at the byte limit', () => {
    const accn = 'A'.repeat(749);
    const invoice = 'B'.repeat(749);
    const result = buildReceiptKey(accn, invoice);
    expect(result.ok).toBe(true);
    expect(Buffer.byteLength((result as { key: string }).key, 'utf8')).toBe(1500);
  });

  it("accepts '.' components, since the separator means the key can never BE '.' or '..'", () => {
    expect(buildReceiptKey('.', '.')).toEqual({ ok: true, key: '.__.' });
  });
});
