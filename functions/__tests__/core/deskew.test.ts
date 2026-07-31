import { deskewBox, estimateSkewAngle, median } from '../../src/receipts/core/deskew';
import type { Box } from '../../src/receipts/core/types';

const DEG = Math.PI / 180;

/** Build word boxes for `rows` rows of `perRow` words, rotated clockwise by `angleDeg`. */
function skewedPage(rows: number, perRow: number, angleDeg: number): Box[] {
  const angle = angleDeg * DEG;
  const boxes: Box[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      const x = 50 + c * 120;
      const y = 100 + r * 40;
      // Rotate the word's centre clockwise about the origin, keeping the glyph box axis-aligned —
      // the same approximation the adapter sees after taking Vision's axis-aligned hull.
      const cx = x * Math.cos(angle) - y * Math.sin(angle);
      const cy = x * Math.sin(angle) + y * Math.cos(angle);
      boxes.push({ x0: cx - 40, y0: cy - 10, x1: cx + 40, y1: cy + 10 });
    }
  }

  return boxes;
}

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle element of an odd-length list', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the two middle elements of an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate its input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('estimateSkewAngle', () => {
  it('returns 0 when there are too few words to judge', () => {
    expect(estimateSkewAngle([])).toBe(0);
    expect(estimateSkewAngle([{ x0: 0, y0: 0, x1: 10, y1: 10 }])).toBe(0);
  });

  it('returns 0 when every box is degenerate', () => {
    const flat: Box[] = [
      { x0: 0, y0: 0, x1: 10, y1: 0 },
      { x0: 20, y0: 0, x1: 30, y1: 0 },
      { x0: 40, y0: 0, x1: 50, y1: 0 },
    ];
    expect(estimateSkewAngle(flat)).toBe(0);
  });

  it('returns 0 for a level page', () => {
    expect(estimateSkewAngle(skewedPage(6, 4, 0))).toBe(0);
  });

  it.each([1, 2, 3, 5, 8, 12])('recovers a %s degree skew', (deg) => {
    const estimated = estimateSkewAngle(skewedPage(8, 5, deg)) / DEG;
    expect(estimated).toBeCloseTo(deg, 0);
  });

  it.each([-1, -3, -7, -12])('recovers a %s degree skew', (deg) => {
    const estimated = estimateSkewAngle(skewedPage(8, 5, deg)) / DEG;
    expect(estimated).toBeCloseTo(deg, 0);
  });

  it('prefers leaving the page alone when angles tie', () => {
    // A single column gives the projection profile no horizontal leverage, so many angles score
    // identically. The sweep must resolve that tie at 0 rather than picking an arbitrary rotation.
    const singleColumn: Box[] = [0, 1, 2, 3].map((i) => ({
      x0: 50,
      y0: 100 + i * 40,
      x1: 130,
      y1: 120 + i * 40,
    }));
    expect(estimateSkewAngle(singleColumn)).toBe(0);
  });

  it('ignores degenerate boxes mixed in with real ones', () => {
    const boxes = [...skewedPage(6, 4, 5), { x0: 0, y0: 500, x1: 100, y1: 500 }];
    expect(estimateSkewAngle(boxes) / DEG).toBeCloseTo(5, 0);
  });
});

describe('deskewBox', () => {
  it('returns the box unchanged at angle 0', () => {
    const b: Box = { x0: 10, y0: 20, x1: 30, y1: 40 };
    expect(deskewBox(b, 0)).toBe(b);
  });

  it('preserves width and height', () => {
    const b: Box = { x0: 100, y0: 200, x1: 180, y1: 220 };
    const out = deskewBox(b, 10 * DEG);
    expect(out.x1 - out.x0).toBeCloseTo(80, 6);
    expect(out.y1 - out.y0).toBeCloseTo(20, 6);
  });

  it('levels two boxes that a clockwise skew pushed apart vertically', () => {
    const angle = 5 * DEG;
    const [a, b] = skewedPage(1, 2, 5) as [Box, Box];

    // Before: the right-hand word sits noticeably lower.
    expect(b.y0 - a.y0).toBeGreaterThan(5);

    // After: both land on the same baseline.
    const da = deskewBox(a, angle);
    const db = deskewBox(b, angle);
    expect(db.y0 - da.y0).toBeCloseTo(0, 6);
  });

  it('is its own inverse under angle negation', () => {
    const b: Box = { x0: 10, y0: 20, x1: 30, y1: 40 };
    const round = deskewBox(deskewBox(b, 7 * DEG), -7 * DEG);
    expect(round.x0).toBeCloseTo(b.x0, 6);
    expect(round.y0).toBeCloseTo(b.y0, 6);
  });
});
