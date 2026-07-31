import type { Box, VisionBoundingPoly } from './types';

/** Height of a box. Never negative — boxes are normalized on construction. */
export function height(b: Box): number {
  return b.y1 - b.y0;
}

/** Width of a box. */
export function width(b: Box): number {
  return b.x1 - b.x0;
}

export function centerY(b: Box): number {
  return (b.y0 + b.y1) / 2;
}

export function centerX(b: Box): number {
  return (b.x0 + b.x1) / 2;
}

/** Smallest box containing both. */
export function union(a: Box, b: Box): Box {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

export function unionAll(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  let acc = boxes[0]!;
  for (let i = 1; i < boxes.length; i++) acc = union(acc, boxes[i]!);
  return acc;
}


export function verticalOverlapRatio(a: Box, b: Box): number {
  const ha = height(a);
  const hb = height(b);
  if (ha <= 0 || hb <= 0) return 0;
  const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (overlap <= 0) return 0;
  return overlap / Math.min(ha, hb);
}


export function boxFromPoly(poly: VisionBoundingPoly | null | undefined): Box | null {
  const vertices = poly?.vertices;
  if (!vertices || vertices.length === 0) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const v of vertices) {
    // Vision omits x or y entirely when the coordinate is 0 (protobuf default-value elision).
    xs.push(typeof v.x === 'number' ? v.x : 0);
    ys.push(typeof v.y === 'number' ? v.y : 0);
  }

  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}
