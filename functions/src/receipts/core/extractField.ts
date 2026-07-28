import type { AnchorMatch } from './anchors';
import { findAnchors } from './anchors';
import { normalizeFieldValue } from './normalize';
import type { FieldRule } from './rules.config';
import type { CandidateSource, FieldCandidate, OcrDocument, OcrWord } from './types';




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
