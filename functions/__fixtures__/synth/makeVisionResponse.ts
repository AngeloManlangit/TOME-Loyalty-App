import type {
  VisionBlock,
  VisionBoundingPoly,
  VisionParagraph,
  VisionResponse,
  VisionSymbol,
  VisionWord,
} from '../../src/receipts/core/types';



export interface SynthCell {
  text: string;
  /** Left edge in pixels. */
  x: number;
  /** 0..1, defaults to the doc's defaultConfidence. */
  confidence?: number;
  /**
   * Emit this cell's words with no boundingBox at all, simulating Vision dropping geometry on
   * low-confidence output. The adapter must still keep the text.
   */
  noGeometry?: boolean;
}

export interface SynthRow {
  /** Top edge in pixels. */
  y: number;
  /** Row height in pixels. Defaults to 20. */
  height?: number;
  cells: SynthCell[];
}

export type BlockStrategy =
  /** Each visual row is its own Vision block. The easy case. */
  | 'per-row'
  
  | 'per-column'
  /** Everything in a single block, one paragraph per row. */
  | 'single';

export interface SynthDoc {
  rows: SynthRow[];
  blockStrategy?: BlockStrategy;
  defaultConfidence?: number;
  /** Pixel width per character, used to lay out word boxes. Defaults to 10. */
  charWidth?: number;
  /**
   * Vertical drift in pixels applied per row index, simulating a photo taken at an angle. Words
   * within a row drift proportionally to their x position, exactly as real skew behaves.
   */
  skew?: number;
}

const DEFAULT_HEIGHT = 20;
const DEFAULT_CHAR_WIDTH = 10;
const DEFAULT_CONFIDENCE = 0.95;

function poly(x0: number, y0: number, x1: number, y1: number): VisionBoundingPoly {
  return {
    vertices: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  };
}

interface PlacedWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
  noGeometry: boolean;
  /** Column index within its row, used by the per-column block strategy. */
  column: number;
  row: number;
}

function placeWords(doc: SynthDoc): PlacedWord[] {
  const charWidth = doc.charWidth ?? DEFAULT_CHAR_WIDTH;
  const defaultConfidence = doc.defaultConfidence ?? DEFAULT_CONFIDENCE;
  const skew = doc.skew ?? 0;
  const placed: PlacedWord[] = [];

  doc.rows.forEach((row, rowIndex) => {
    const height = row.height ?? DEFAULT_HEIGHT;

    row.cells.forEach((cell, columnIndex) => {
      let cursor = cell.x;

      for (const token of cell.text.split(' ').filter((t) => t.length > 0)) {
        const w = token.length * charWidth;
        // Skew drifts a word down in proportion to how far right it sits — real rotation, not a
        // uniform offset, so row-merging is genuinely exercised.
        const drift = skew * rowIndex + (skew * cursor) / 100;
        const y0 = row.y + drift;

        placed.push({
          text: token,
          x0: cursor,
          y0,
          x1: cursor + w,
          y1: y0 + height,
          confidence: cell.confidence ?? defaultConfidence,
          noGeometry: cell.noGeometry === true,
          column: columnIndex,
          row: rowIndex,
        });

        cursor += w + charWidth; // trailing space
      }
    });
  });

  return placed;
}

function toVisionWord(p: PlacedWord, isLast: boolean): VisionWord {
  const symbols: VisionSymbol[] = [...p.text].map((ch, i, all) => {
    const charW = (p.x1 - p.x0) / all.length;
    const sx0 = p.x0 + charW * i;
    const symbol: VisionSymbol = {
      text: ch,
      confidence: p.confidence,
      boundingBox: p.noGeometry ? null : poly(sx0, p.y0, sx0 + charW, p.y1),
    };
    // Vision marks the break on the LAST symbol of a word.
    if (i === all.length - 1) {
      symbol.property = { detectedBreak: { type: isLast ? 'LINE_BREAK' : 'SPACE' } };
    }
    return symbol;
  });

  return {
    symbols,
    confidence: p.confidence,
    boundingBox: p.noGeometry ? null : poly(p.x0, p.y0, p.x1, p.y1),
  };
}

function paragraphOf(words: PlacedWord[]): VisionParagraph {
  return {
    words: words.map((w, i) => toVisionWord(w, i === words.length - 1)),
  };
}

function groupBy<K>(items: PlacedWord[], key: (w: PlacedWord) => K): Map<K, PlacedWord[]> {
  const out = new Map<K, PlacedWord[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function makeVisionResponse(doc: SynthDoc): VisionResponse {
  const placed = placeWords(doc);

  if (placed.length === 0) {
    // Vision returns no fullTextAnnotation at all for a textless image.
    return {};
  }

  const strategy: BlockStrategy = doc.blockStrategy ?? 'per-row';
  const blocks: VisionBlock[] = [];

  if (strategy === 'per-row') {
    for (const [, words] of groupBy(placed, (w) => w.row)) {
      blocks.push({ paragraphs: [paragraphOf(words)] });
    }
  } else if (strategy === 'per-column') {
    // One block per column: every label in one block, every value in another.
    for (const [, words] of groupBy(placed, (w) => w.column)) {
      const paragraphs: VisionParagraph[] = [];
      for (const [, rowWords] of groupBy(words, (w) => w.row)) {
        paragraphs.push(paragraphOf(rowWords));
      }
      blocks.push({ paragraphs });
    }
  } else {
    const paragraphs: VisionParagraph[] = [];
    for (const [, words] of groupBy(placed, (w) => w.row)) {
      paragraphs.push(paragraphOf(words));
    }
    blocks.push({ paragraphs });
  }

  // Vision's own flat text, reconstructed the way Vision would: block order, not visual order. The
  // adapter must NOT depend on this being correct — it is here so fixtures are realistic.
  const text = blocks
    .map((b) =>
      (b.paragraphs ?? [])
        .map((p) => (p.words ?? []).map((w) => (w.symbols ?? []).map((s) => s.text).join('')).join(' '))
        .join('\n'),
    )
    .join('\n');

  return {
    fullTextAnnotation: {
      text,
      pages: [{ blocks, width: 1000, height: 1600 }],
    },
  };
}

/** Convenience for the common "plain single-column receipt" fixture. */
export function makeSimpleReceipt(lines: string[], options: Partial<SynthDoc> = {}): VisionResponse {
  return makeVisionResponse({
    rows: lines.map((text, i) => ({ y: 100 + i * 30, cells: [{ text, x: 50 }] })),
    ...options,
  });
}

/** Convenience for a two-column label/value receipt, which is where block strategy matters most. */
export function makeTwoColumnReceipt(
  pairs: Array<[label: string, value: string]>,
  options: Partial<SynthDoc> = {},
): VisionResponse {
  return makeVisionResponse({
    blockStrategy: 'per-column',
    rows: pairs.map(([label, value], i) => ({
      y: 100 + i * 30,
      cells: [
        { text: label, x: 50 },
        { text: value, x: 400 },
      ],
    })),
    ...options,
  });
}
