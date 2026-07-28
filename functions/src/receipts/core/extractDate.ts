import type { AnchorMatch } from './anchors';
import { findAnchors } from './anchors';
import type { DateParts } from './dateParse';
import { parseDateToken } from './dateParse';
import type { DateRule } from './rules.config';
import { MAX_CANDIDATES } from './extractField';
import type { CandidateSource, FieldCandidate, OcrDocument, OcrWord } from './types';



const SCORES: Record<CandidateSource, number> = {
  inline: 1.0,
  below: 0.6,
  'pattern-scan': 0.25,
};

/** Longest run of words a single date can occupy: "JUL 28 , 2026" plus a trailing time. */
const MAX_WINDOW = 4;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function canonicalDate(parts: DateParts): string {
  const date = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  if (!parts.hasTime) return date;
  return `${date} ${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`;
}

/** Callers only ever pass non-empty runs — scanWords only emits a match with at least one word. */
function meanConfidence(words: readonly OcrWord[]): number {
  return words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
}

interface Found {
  parts: DateParts;
  words: OcrWord[];
  source: CandidateSource;
  lineIndex: number;
}

/** Slide a window over `words`, collecting every run that parses as a date. */
function scanWords(
  words: readonly OcrWord[],
  source: CandidateSource,
  lineIndex: number,
  order: 'MDY' | 'DMY',
): Found[] {
  const found: Found[] = [];

  for (let start = 0; start < words.length; start++) {
    // Longest window first: "07/28/2026 14:30" should win over the bare "07/28/2026", so the printed
    // time is not silently discarded.
    for (let size = Math.min(MAX_WINDOW, words.length - start); size >= 1; size--) {
      const run = words.slice(start, start + size);
      const parts = parseDateToken(run.map((w) => w.text).join(' '), order);
      if (parts) {
        found.push({ parts, words: [...run], source, lineIndex });
        break;
      }
    }
  }

  return found;
}

function collect(doc: OcrDocument, anchors: readonly AnchorMatch[], order: 'MDY' | 'DMY'): Found[] {
  const found: Found[] = [];

  for (const anchor of anchors) {
    found.push(
      ...scanWords(anchor.line.words.slice(anchor.endWord), 'inline', anchor.line.index, order),
    );

    const below = doc.lines[anchor.line.index + 1];
    if (below) found.push(...scanWords(below.words, 'below', below.index, order));
  }

  // A receipt almost always prints its date somewhere even when the label is unreadable.
  for (const line of doc.lines) {
    found.push(...scanWords(line.words, 'pattern-scan', line.index, order));
  }

  return found;
}

export function extractDateCandidates(doc: OcrDocument, rule: DateRule): FieldCandidate[] {
  const anchors = findAnchors(doc.lines, rule.labels);
  const found = collect(doc, anchors, rule.localeOrder);

  const byValue = new Map<string, FieldCandidate>();

  for (const item of found) {
    const value = canonicalDate(item.parts);

    const candidate: FieldCandidate = {
      value,
      raw: item.words.map((w) => w.text).join(' '),
      score: SCORES[item.source],
      confidence: meanConfidence(item.words),
      source: item.source,
      lineIndex: item.lineIndex,
    };

    const existing = byValue.get(value);
    if (
      !existing ||
      candidate.score > existing.score ||
      (candidate.score === existing.score && candidate.confidence > existing.confidence)
    ) {
      byValue.set(value, candidate);
    }
  }

  return [...byValue.values()]
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.lineIndex - b.lineIndex)
    .slice(0, MAX_CANDIDATES);
}
