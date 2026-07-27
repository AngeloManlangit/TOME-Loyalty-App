import { centerX, centerY, height } from './geometry';
import type { Box } from './types';

/**
 * Skew estimation and correction, by projection profile.
 *
 * Why this is needed: row grouping compares vertical overlap of axis-aligned boxes. On a photo taken
 * at an angle, a label on the left and its value 350px to the right drift apart vertically. Once that
 * drift approaches the line spacing, no amount of threshold tuning separates "same row, skewed" from
 * "different rows" — the two are genuinely indistinguishable in y alone. The fix is to remove the skew
 * before grouping, not to loosen the grouping.
 *
 * The method is the standard document-analysis one: rotate the page through a range of candidate
 * angles, and for each build a histogram of word-centre y positions. When the page is level, every
 * word of a row lands in the same bin and the histogram is spiky; when it is skewed, rows smear across
 * bins. Sum-of-squares of the bin counts measures that spikiness, so the angle maximising it is the
 * one that levels the page.
 *
 * Pure arithmetic — no dependencies, fully deterministic, exhaustively testable.
 */

/** Widest skew we attempt to correct, in degrees. Beyond this the photo is unusable anyway. */
const MAX_ANGLE_DEG = 15;

/** Search granularity, in degrees. */
const ANGLE_STEP_DEG = 0.25;

/** Below this many words the estimate is noise, so we do not rotate at all. */
const MIN_WORDS_FOR_ESTIMATE = 3;

/** Angles smaller than this are treated as level — avoids rotating an already-straight page. */
const NEGLIGIBLE_ANGLE_RAD = 0.002; // ~0.11 degrees

const DEG_TO_RAD = Math.PI / 180;

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The y coordinate a point would have if the page were rotated by `-angle` about the origin.
 *
 * Only y is needed — row grouping and the projection profile both work purely on y, and computing x
 * as well would be wasted work inside the angle sweep.
 */
function rotatedY(x: number, y: number, angle: number): number {
  return -x * Math.sin(angle) + y * Math.cos(angle);
}

function rotatedX(x: number, y: number, angle: number): number {
  return x * Math.cos(angle) + y * Math.sin(angle);
}

/**
 * How tightly word centres cluster in y at a given angle.
 *
 * This is a kernel density score, NOT a histogram: every pair of words closer together than the
 * bandwidth contributes `1 - |dy| / bandwidth`. A fixed-grid histogram was tried first and is subtly
 * wrong here — its score depends on where the bin boundaries happen to fall, so it saturates across a
 * wide plateau of angles and, worse, dips at the exact angle that levels the page whenever a row
 * straddles a boundary. Measured on an 8-row fixture, hard binning scored 200 across 4.00-6.00 degrees
 * but only 188 at the true 5.00.
 *
 * Being grid-free makes this offset-invariant and continuous in the angle, so the maximum sits on the
 * true skew rather than on an arbitrary member of a plateau.
 *
 * Cost is kept near-linear by sorting and sweeping a window: pairs beyond the bandwidth contribute
 * nothing, so they are never visited.
 */
function clusteringScore(boxes: readonly Box[], angle: number, bandwidth: number): number {
  const ys = boxes
    .map((b) => rotatedY(centerX(b), centerY(b), angle))
    .sort((a, b) => a - b);

  let score = 0;

  // Sorted input means the inner loop can stop at the first pair beyond the bandwidth, so this stays
  // near-linear in practice even though it is written as a double loop.
  for (let i = 0; i < ys.length; i++) {
    for (let j = i + 1; j < ys.length; j++) {
      const dy = ys[j]! - ys[i]!;
      if (dy >= bandwidth) break;
      score += 1 - dy / bandwidth;
    }
  }

  return score;
}

/**
 * Estimate the page's skew angle in radians. Positive means the page is rotated clockwise.
 *
 * Returns 0 when there is too little text to judge, or when the best angle found is negligible.
 * Candidate angles are evaluated in order of increasing magnitude and only strict improvements are
 * accepted, so a tie always resolves in favour of leaving the page alone.
 */
export function estimateSkewAngle(boxes: readonly Box[]): number {
  const usable = boxes.filter((b) => height(b) > 0);
  if (usable.length < MIN_WORDS_FOR_ESTIMATE) return 0;

  // Bandwidth of one text height: words on the same row sit well within it, while the next row up or
  // down is a full line-spacing away and contributes nothing.
  const bandwidth = Math.max(1, median(usable.map(height)));

  // Candidates ordered by |angle| ascending: 0, +step, -step, +2step, -2step, ...
  const candidates: number[] = [0];
  const steps = Math.floor(MAX_ANGLE_DEG / ANGLE_STEP_DEG);
  for (let i = 1; i <= steps; i++) {
    const deg = i * ANGLE_STEP_DEG;
    candidates.push(deg * DEG_TO_RAD, -deg * DEG_TO_RAD);
  }

  let bestAngle = 0;
  let bestScore = clusteringScore(usable, 0, bandwidth);

  for (const angle of candidates) {
    const score = clusteringScore(usable, angle, bandwidth);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  return Math.abs(bestAngle) < NEGLIGIBLE_ANGLE_RAD ? 0 : bestAngle;
}

/**
 * Rotate a box by `-angle` about the origin, preserving its width and height.
 *
 * Only the centre is rotated. Rotating all four corners and taking the axis-aligned hull would inflate
 * the box by up to its own diagonal, which would make tall boxes overlap rows they do not belong to —
 * the exact failure this module exists to prevent.
 */
export function deskewBox(b: Box, angle: number): Box {
  if (angle === 0) return b;

  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const cx = centerX(b);
  const cy = centerY(b);

  const nx = rotatedX(cx, cy, angle);
  const ny = rotatedY(cx, cy, angle);

  return { x0: nx - w / 2, y0: ny - h / 2, x1: nx + w / 2, y1: ny + h / 2 };
}
