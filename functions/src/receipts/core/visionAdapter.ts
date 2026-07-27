import { deskewBox, estimateSkewAngle } from './deskew';
import { boxFromPoly, centerY, unionAll, verticalOverlapRatio } from './geometry';
import { normalizeText } from './normalize';
import type {
  Box,
  OcrDocument,
  OcrLine,
  OcrWord,
  VisionBreakType,
  VisionResponse,
  VisionWord,
} from './types';

/**
 * Vision DOCUMENT_TEXT_DETECTION -> engine-agnostic OcrDocument.
 *
 * This is the ONLY file that knows Vision's response shape. Swapping OCR provider means rewriting
 * this file and nothing else.
 *
 * The non-obvious part is line reconstruction. Vision's own `fullTextAnnotation.text` newlines follow
 * its BLOCK structure, and on a receipt the label column and the value column are frequently separate
 * blocks. Trusting those newlines gives you:
 *
 *     ACCN                       <- one line
 *     116-000123456789           <- a different line, possibly far away in reading order
 *
 * ...and "the value to the right of the ACCN label" becomes unfindable. So we rebuild lines by
 * GEOMETRY: split on Vision's detected breaks to get raw runs, then merge runs that occupy the same
 * visual row, then sort each row left to right. That reunites the two columns into:
 *
 *     ACCN 116-000123456789
 */

/** Fraction of the shorter box's height that two runs must share to count as the same visual row. */
const ROW_MERGE_THRESHOLD = 0.5;

/** Protobuf enum values, since Vision may serialize detectedBreak.type as a number or a string. */
const BREAK_NAMES: Record<number, VisionBreakType> = {
  0: 'UNKNOWN',
  1: 'SPACE',
  2: 'SURE_SPACE',
  3: 'EOL_SURE_SPACE',
  4: 'HYPHEN',
  5: 'LINE_BREAK',
};

/** Breaks that end a visual line. */
const LINE_ENDING_BREAKS: ReadonlySet<VisionBreakType> = new Set<VisionBreakType>([
  'EOL_SURE_SPACE',
  'LINE_BREAK',
  'HYPHEN',
]);

function breakTypeOf(word: VisionWord): VisionBreakType | null {
  const symbols = word.symbols ?? [];
  const last = symbols.length > 0 ? symbols[symbols.length - 1] : undefined;
  const raw = last?.property?.detectedBreak?.type ?? word.property?.detectedBreak?.type;

  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return BREAK_NAMES[raw] ?? null;
  return raw;
}

function endsLine(word: VisionWord): boolean {
  const t = breakTypeOf(word);
  return t !== null && LINE_ENDING_BREAKS.has(t);
}

/**
 * A word plus the geometry we could actually recover for it.
 *
 * `box` is the real page geometry and is what we emit. `deskewed` is the same box with page skew
 * removed, and is used ONLY for row grouping and ordering — consumers get true coordinates.
 */
interface StagedWord {
  text: string;
  box: Box | null;
  deskewed: Box | null;
  confidence: number;
}

/** A run of words between two line-ending breaks, in structural (reading) order. */
interface RawRun {
  words: StagedWord[];
  box: Box | null;
  deskewed: Box | null;
  seq: number;
}

function stageWord(word: VisionWord): StagedWord | null {
  const symbols = word.symbols ?? [];

  let text = '';
  const symbolBoxes: Box[] = [];
  const symbolConfidences: number[] = [];

  for (const s of symbols) {
    if (typeof s.text === 'string') text += s.text;
    const b = boxFromPoly(s.boundingBox);
    if (b) symbolBoxes.push(b);
    if (typeof s.confidence === 'number') symbolConfidences.push(s.confidence);
  }

  // A word with no readable text contributes nothing and would only pollute row geometry.
  if (text.trim().length === 0) return null;

  // Prefer the word's own box; fall back to the hull of its symbols. Vision populates one or the
  // other depending on how confident it was about the word grouping.
  const box = boxFromPoly(word.boundingBox) ?? unionAll(symbolBoxes);

  // Confidence: the word's own if present, else the mean of its symbols, else 0. Substituting 0
  // rather than 1 for unknown confidence is deliberate — an unknown-confidence field should be
  // flagged for review, not waved through.
  let confidence = 0;
  if (typeof word.confidence === 'number') {
    confidence = word.confidence;
  } else if (symbolConfidences.length > 0) {
    confidence = symbolConfidences.reduce((a, b) => a + b, 0) / symbolConfidences.length;
  }

  return { text, box, deskewed: box, confidence };
}

/** Walk the page tree and split into raw runs at Vision's line-ending breaks. */
function collectRawRuns(response: VisionResponse): RawRun[] {
  const runs: RawRun[] = [];
  let current: StagedWord[] = [];
  let seq = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    const boxes = current.map((w) => w.box).filter((b): b is Box => b !== null);
    const deskewedBoxes = current.map((w) => w.deskewed).filter((b): b is Box => b !== null);
    runs.push({
      words: current,
      box: unionAll(boxes),
      deskewed: unionAll(deskewedBoxes),
      seq: seq++,
    });
    current = [];
  };

  for (const page of response.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          const staged = stageWord(word);
          if (staged) current.push(staged);
          if (endsLine(word)) flush();
        }
      }
      // A block boundary always ends a line, even when Vision did not mark a break on the last word.
      flush();
    }
  }
  flush();

  return runs;
}

/**
 * Estimate page skew from every word we have geometry for, then record a deskewed box on each word
 * and run. Nothing is rotated in the emitted output — this only levels the coordinates that row
 * grouping and left-to-right ordering are computed from.
 */
function applyDeskew(runs: RawRun[]): void {
  const wordBoxes: Box[] = [];
  for (const run of runs) {
    for (const w of run.words) {
      if (w.box) wordBoxes.push(w.box);
    }
  }

  const angle = estimateSkewAngle(wordBoxes);
  if (angle === 0) return;

  for (const run of runs) {
    for (const w of run.words) {
      w.deskewed = w.box ? deskewBox(w.box, angle) : null;
    }
    const deskewedBoxes = run.words.map((w) => w.deskewed).filter((b): b is Box => b !== null);
    run.deskewed = unionAll(deskewedBoxes);
  }
}

/**
 * Merge raw runs that occupy the same visual row.
 *
 * Operates on DESKEWED geometry — see deskew.ts for why a threshold alone cannot separate "same row,
 * skewed" from "different rows".
 *
 * Runs without recoverable geometry cannot be compared, so they pass through as their own row rather
 * than being dropped — losing a line because Vision omitted a bounding box would be a silent data
 * loss, and that line might be the one carrying the invoice number.
 */
function mergeIntoRows(runs: RawRun[]): RawRun[][] {
  const positioned = runs.filter((r) => r.deskewed !== null);
  const unpositioned = runs.filter((r) => r.deskewed === null);

  positioned.sort((a, b) => centerY(a.deskewed!) - centerY(b.deskewed!) || a.seq - b.seq);

  const rows: RawRun[][] = [];
  for (const run of positioned) {
    const currentRow = rows.length > 0 ? rows[rows.length - 1]! : null;
    const rowBox = currentRow ? unionAll(currentRow.map((r) => r.deskewed!)) : null;

    if (rowBox && verticalOverlapRatio(rowBox, run.deskewed!) >= ROW_MERGE_THRESHOLD) {
      currentRow!.push(run);
    } else {
      rows.push([run]);
    }
  }

  for (const run of unpositioned) rows.push([run]);

  return rows;
}

function buildLine(row: RawRun[], index: number): OcrLine {
  // Left-to-right within the row.
  //
  // Only multi-run rows need sorting, and mergeIntoRows only ever groups POSITIONED runs together —
  // a run without geometry is emitted as a row of its own. So whenever this comparator runs, both
  // sides are guaranteed to have a deskewed box.
  const ordered = row.length > 1 ? [...row].sort((a, b) => a.deskewed!.x0 - b.deskewed!.x0) : row;
  const words: StagedWord[] = ordered.flatMap((r) => r.words);

  // A row always has at least one word: collectRawRuns never flushes an empty run.
  const ocrWords: OcrWord[] = words.map((w) => ({
    text: w.text,
    box: w.box ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
    confidence: w.confidence,
  }));

  const boxes = words.map((w) => w.box).filter((b): b is Box => b !== null);
  const box = unionAll(boxes) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };

  const confidence =
    ocrWords.reduce((sum, w) => sum + w.confidence, 0) / ocrWords.length;

  return {
    text: normalizeText(ocrWords.map((w) => w.text).join(' ')),
    box,
    confidence,
    words: ocrWords,
    index,
  };
}

/**
 * Build an OcrDocument from a Vision response.
 *
 * Returns an empty document (no lines, no words, meanConfidence 0) when Vision found no text at all.
 * Callers turn that into OCR_NO_TEXT — this function does not throw, because "the photo had no text"
 * is an expected outcome, not an error.
 */
export function visionToOcrDocument(response: VisionResponse): OcrDocument {
  const runs = collectRawRuns(response);
  applyDeskew(runs);
  const rows = mergeIntoRows(runs);

  const lines: OcrLine[] = rows.map((row, index) => buildLine(row, index));

  const words = lines.flatMap((l) => l.words);
  const meanConfidence =
    words.length === 0 ? 0 : words.reduce((sum, w) => sum + w.confidence, 0) / words.length;

  return {
    lines,
    words,
    text: lines.map((l) => l.text).join('\n'),
    meanConfidence,
  };
}
