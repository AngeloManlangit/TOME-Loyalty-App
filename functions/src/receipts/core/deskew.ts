import { centerX, centerY, height } from './geometry';
import type { Box } from './types';



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


function rotatedY(x: number, y: number, angle: number): number {
  return -x * Math.sin(angle) + y * Math.cos(angle);
}

function rotatedX(x: number, y: number, angle: number): number {
  return x * Math.cos(angle) + y * Math.sin(angle);
}


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
