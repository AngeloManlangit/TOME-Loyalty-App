import type { AnchorMatch } from './anchors';
import { findAnchors } from './anchors';
import { normalizeFieldValue } from './normalize';
import type { FieldRule } from './rules.config';
import type { CandidateSource, FieldCandidate, OcrDocument, OcrWord } from './types';

/**
 * Token-based candidate extraction for the invoice number and ACCN. Returns ranked candidates, not
 * one answer, so the review screen can offer alternates as tap-to-pick chips.
 *
 * Sources, most to least trustworthy:
 *
 *   inline        value right of the label on its own line — the common case
 *   below         value on the line under the label
 *   pattern-scan  right shape, no label nearby; scored low so a torn label still yields something
 *
 * No "geometry" source (unlike the architecture doc): visionAdapter already merges lines sharing a
 * visual row, so any line such a search could find is already part of the anchor's line.
 */

/**
 * Cap on returned candidates. pattern-scan matches loosely and can produce dozens of low-scoring
 * hits; only the top few are useful as chips. Also bounds the callable's response size.
 */
export const MAX_CANDIDATES = 8;

const SCORES: Record<CandidateSource, number> = {
  inline: 1.0,
  below: 0.6,
  'pattern-scan': 0.25,
};

/** Callers only pass non-empty runs. */
function meanConfidence(words: readonly OcrWord[]): number {
  return words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
}

/**
 * How many words after a label may still be its value. On long merged lines (a photo of more than
 * one document), treating every trailing word equally let "0311" — twenty tokens away, under a
 * different label — outrank the real invoice number.
 */
const MAX_INLINE_WORDS = 3;

/** Score penalty per word of distance from the label. */
const DISTANCE_DECAY = 0.1;

interface RawCandidate {
  raw: string;
  words: OcrWord[];
  source: CandidateSource;
  lineIndex: number;
  score: number;
}

/**
 * Turn a run into candidates: the whole run, plus each token. Both are needed — ": 12345" leaves
 * punctuation on the whole-run form, and "SI-004512 CASHIER 3" only yields the number per token.
 */
function candidatesFromWords(
  words: readonly OcrWord[],
  source: CandidateSource,
  lineIndex: number,
  baseScore: number,
): RawCandidate[] {
  if (words.length === 0) return [];

  const out: RawCandidate[] = [
    {
      raw: words.map((w) => w.text).join(' '),
      words: [...words],
      source,
      lineIndex,
      score: baseScore,
    },
  ];

  if (words.length > 1) {
    words.forEach((w, i) => {
      out.push({
        raw: w.text,
        words: [w],
        source,
        lineIndex,
        score: baseScore - i * DISTANCE_DECAY,
      });
    });
  }

  return out;
}

function collectRaw(doc: OcrDocument, anchors: readonly AnchorMatch[]): RawCandidate[] {
  const raw: RawCandidate[] = [];

  for (const anchor of anchors) {
    // A value glued to its label ("INV#00021838") is the strongest signal: same token, no ambiguity.
    if (anchor.gluedValue !== undefined) {
      raw.push({
        raw: anchor.gluedValue,
        words: [anchor.line.words[anchor.startWord]!],
        source: 'inline',
        lineIndex: anchor.line.index,
        score: SCORES.inline,
      });
    }

    // Only the words immediately following the label. See MAX_INLINE_WORDS.
    const trailingWords = anchor.line.words.slice(anchor.endWord, anchor.endWord + MAX_INLINE_WORDS);
    raw.push(...candidatesFromWords(trailingWords, 'inline', anchor.line.index, SCORES.inline));

    const below = doc.lines[anchor.line.index + 1];
    if (below) {
      raw.push(
        ...candidatesFromWords(
          below.words.slice(0, MAX_INLINE_WORDS),
          'below',
          below.index,
          SCORES.below,
        ),
      );
    }
  }

  for (const line of doc.lines) {
    for (const word of line.words) {
      raw.push({
        raw: word.text,
        words: [word],
        source: 'pattern-scan',
        lineIndex: line.index,
        score: SCORES['pattern-scan'],
      });
    }
  }

  return raw;
}

/**
 * Extract ranked candidates for a labelled field. Each is normalized (digit-confusion repair only
 * when the rule is numeric-only) and must match the rule's pattern; duplicates collapse to the best.
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
      score: item.score,
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
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      // For fields printed more than once, position beats OCR confidence. See preferEarliest.
      if (rule.preferEarliest === true && a.lineIndex !== b.lineIndex) {
        return a.lineIndex - b.lineIndex;
      }
      return b.confidence - a.confidence || a.lineIndex - b.lineIndex;
    })
    .slice(0, MAX_CANDIDATES);
}
