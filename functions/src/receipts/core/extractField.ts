import type { AnchorMatch } from './anchors';
import { findAnchors } from './anchors';
import { normalizeFieldValue } from './normalize';
import type { FieldRule } from './rules.config';
import type { CandidateSource, FieldCandidate, OcrDocument, OcrWord } from './types';

/**
 * Token-based candidate extraction for the invoice number and ACCN.
 *
 * Returns RANKED CANDIDATES rather than a single answer, because that is what makes a misread cheap
 * to fix: the review screen renders the alternates as tap-to-pick chips, so the user corrects a bad
 * read in one tap instead of typing an eighteen-digit ACCN by hand.
 *
 * Candidate sources, in descending trustworthiness:
 *
 *   inline        value sits on the label's own line, to its right — the overwhelmingly common case,
 *                 including two-column layouts, because the adapter has already rebuilt visual rows
 *   below         value is on the line under the label, a layout some merchants use
 *   pattern-scan  value matches the field's shape somewhere on the receipt with no label nearby;
 *                 scored low, present so a torn or unreadable label still yields something to review
 *
 * There is deliberately NO separate "geometry" source hunting for a box to the right of the label on
 * another line. The architecture doc lists one, but it is unreachable as designed: visionAdapter
 * already merges lines sharing a visual row at a 0.5 overlap threshold, so any line such a search
 * could find has by then been merged into the anchor's own line. Keeping an unreachable branch in the
 * file that has to be provably correct costs more than the speculative recovery is worth. If real
 * receipts ever show a case the merger misses, it comes back with a fixture that proves it.
 */

/**
 * Cap on returned candidates. The pattern-scan pass deliberately matches loosely, so on a long
 * receipt it can produce dozens of low-scoring hits; they are ranked last and only the top few are
 * ever useful as review chips. Capping also bounds the callable's response size.
 */
export const MAX_CANDIDATES = 8;

const SCORES: Record<CandidateSource, number> = {
  inline: 1.0,
  below: 0.6,
  'pattern-scan': 0.25,
};

/** Callers only ever pass non-empty runs — candidatesFromWords returns early on an empty one. */
function meanConfidence(words: readonly OcrWord[]): number {
  return words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
}

interface RawCandidate {
  raw: string;
  words: OcrWord[];
  source: CandidateSource;
  lineIndex: number;
}

/**
 * Turn a run of text into candidates: the whole run, plus each individual token.
 *
 * Both are needed. "12345" arrives as one token, but ": 12345" leaves punctuation the whole-run form
 * would keep, and "SI-004512 CASHIER 3" only yields the invoice number as a single token.
 */
function candidatesFromWords(
  words: readonly OcrWord[],
  source: CandidateSource,
  lineIndex: number,
): RawCandidate[] {
  if (words.length === 0) return [];

  const out: RawCandidate[] = [
    { raw: words.map((w) => w.text).join(' '), words: [...words], source, lineIndex },
  ];

  if (words.length > 1) {
    for (const w of words) {
      out.push({ raw: w.text, words: [w], source, lineIndex });
    }
  }

  return out;
}

function collectRaw(doc: OcrDocument, anchors: readonly AnchorMatch[]): RawCandidate[] {
  const raw: RawCandidate[] = [];

  for (const anchor of anchors) {
    const trailingWords = anchor.line.words.slice(anchor.endWord);
    raw.push(...candidatesFromWords(trailingWords, 'inline', anchor.line.index));

    const below = doc.lines[anchor.line.index + 1];
    if (below) {
      raw.push(...candidatesFromWords(below.words, 'below', below.index));
    }
  }

  for (const line of doc.lines) {
    for (const word of line.words) {
      raw.push({ raw: word.text, words: [word], source: 'pattern-scan', lineIndex: line.index });
    }
  }

  return raw;
}

/**
 * Extract ranked candidates for a labelled field.
 *
 * Every candidate is normalized (with digit-confusion repair when, and only when, the rule declares
 * the field numeric-only) and must match the rule's pattern to survive. Duplicates collapse to their
 * best-scoring occurrence.
 */
export function extractFieldCandidates(doc: OcrDocument, rule: FieldRule): FieldCandidate[] {
  const anchors = findAnchors(doc.lines, rule.labels);
  const raw = collectRaw(doc, anchors);

  const byValue = new Map<string, FieldCandidate>();

  for (const item of raw) {
    const value = normalizeFieldValue(item.raw, rule.numericOnly);
    if (value.length === 0) continue;
    if (!rule.pattern.test(value)) continue;

    const candidate: FieldCandidate = {
      value,
      raw: item.raw,
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
