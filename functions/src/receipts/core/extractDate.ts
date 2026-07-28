import type { AnchorMatch } from './anchors';
import { findAnchors } from './anchors';
import type { DateParts } from './dateParse';
import { parseDateToken, partsToUtcMs } from './dateParse';
import type { DateRule } from './rules.config';
import { MAX_CANDIDATES } from './extractField';
import type { CandidateSource, FieldCandidate, OcrDocument, OcrWord } from './types';

/**
 * Date candidate extraction. Separate from extractField because a date spans multiple tokens
 * ("JUL 28, 2026"), so this slides a word window and asks dateParse if it parses.
 *
 * Candidate `value` is canonical `YYYY-MM-DD` (plus ` HH:MM:SS` when a time was printed).
 */

const SCORES: Record<CandidateSource, number> = {
  inline: 1.0,
  below: 0.6,
  'pattern-scan': 0.25,
};

/** Longest run a date can occupy: "JUL 28 , 2026" plus a trailing time. */
const MAX_WINDOW = 4;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function canonicalDate(parts: DateParts): string {
  const date = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  if (!parts.hasTime) return date;
  return `${date} ${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`;
}

/** Callers only pass non-empty runs. */
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
    // Longest window first, so "07/28/2026 14:30" wins over the bare date and the time survives.
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
    if (anchor.gluedValue !== undefined) {
      const parts = parseDateToken(anchor.gluedValue, order);
      if (parts) {
        found.push({
          parts,
          words: [anchor.line.words[anchor.startWord]!],
          source: 'inline',
          lineIndex: anchor.line.index,
        });
      }
    }

    found.push(
      ...scanWords(anchor.line.words.slice(anchor.endWord), 'inline', anchor.line.index, order),
    );

    const below = doc.lines[anchor.line.index + 1];
    if (below) found.push(...scanWords(below.words, 'below', below.index, order));
  }

  // The date is usually printed somewhere even when its label is unreadable.
  for (const line of doc.lines) {
    found.push(...scanWords(line.words, 'pattern-scan', line.index, order));
  }

  return found;
}

interface Ranked {
  candidate: FieldCandidate;
  ms: number;
}

/**
 * Rank date candidates: score first, then domain facts to pick the transaction date out of the
 * several dates a receipt prints (POS permit validity, issue date). A transaction can't be in the
 * future, so future dates rank last; among the rest it's the most recent, since permit dates
 * necessarily predate the sale.
 */
function compareDateCandidates(a: Ranked, b: Ranked, nowMs: number): number {
  if (a.candidate.score !== b.candidate.score) return b.candidate.score - a.candidate.score;

  const aFuture = a.ms > nowMs;
  const bFuture = b.ms > nowMs;
  if (aFuture !== bFuture) return aFuture ? 1 : -1;

  if (a.ms !== b.ms) return b.ms - a.ms;

  return (
    b.candidate.confidence - a.candidate.confidence ||
    a.candidate.lineIndex - b.candidate.lineIndex
  );
}

export function extractDateCandidates(
  doc: OcrDocument,
  rule: DateRule,
  nowMs: number,
): FieldCandidate[] {
  const anchors = findAnchors(doc.lines, rule.labels);
  const found = collect(doc, anchors, rule.localeOrder);

  const byValue = new Map<string, FieldCandidate>();
  const instantOf = new Map<string, number>();

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
      instantOf.set(value, partsToUtcMs(item.parts, rule.utcOffsetMinutes));
    }
  }

  return [...byValue.values()]
    .map((candidate) => ({ candidate, ms: instantOf.get(candidate.value)! }))
    .sort((a, b) => compareDateCandidates(a, b, nowMs))
    .map((x) => x.candidate)
    .slice(0, MAX_CANDIDATES);
}
