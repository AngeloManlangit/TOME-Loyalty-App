import { boundedLevenshtein } from './levenshtein';
import { alphanumericOnly, normalizeText } from './normalize';
import type { OcrLine } from './types';



export interface AnchorMatch {
  line: OcrLine;
  /** Which alias matched. */
  alias: string;
  /** Edit distance between the alias and the matched run, in alphanumeric-only form. */
  distance: number;
  /** Index of the first word of the label within `line.words`. */
  startWord: number;
  /** Index one past the last word of the label. */
  endWord: number;
  /** Text remaining on the line to the right of the label. Empty when the label ends the line. */
  trailing: string;
  /** Right edge of the label, for geometry searches. */
  labelEndX: number;
}


export function distanceBudget(alias: string): number {
  return alphanumericOnly(alias).length <= 6 ? 1 : 2;
}


export function findAnchors(lines: readonly OcrLine[], aliases: readonly string[]): AnchorMatch[] {
  const matches: AnchorMatch[] = [];

  for (const line of lines) {
    let best: AnchorMatch | null = null;

    for (const alias of aliases) {
      const target = alphanumericOnly(alias);
      if (target.length === 0) continue;

      const budget = distanceBudget(alias);
      const aliasTokens = normalizeText(alias).split(' ').filter((t) => t.length > 0).length;
      // Allow one more word than the alias has, so "INVOICE NO ." and "INV #" both match.
      const maxRun = aliasTokens + 1;

      for (let start = 0; start < line.words.length; start++) {
        for (let run = 1; run <= maxRun && start + run <= line.words.length; run++) {
          const runWords = line.words.slice(start, start + run);
          const runText = alphanumericOnly(runWords.map((w) => w.text).join(''));
          if (runText.length === 0) continue;

          const distance = boundedLevenshtein(runText, target, budget);
          if (distance > budget) continue;

          // Prefer a closer match; break ties toward the longer run, which consumes trailing
          // punctuation like "NO." into the label instead of leaving it in the value.
          const better =
            best === null ||
            distance < best.distance ||
            (distance === best.distance && start + run > best.endWord);

          if (better) {
            const endWord = start + run;
            const trailing = line.words
              .slice(endWord)
              .map((w) => w.text)
              .join(' ')
              .trim();

            best = {
              line,
              alias,
              distance,
              startWord: start,
              endWord,
              trailing,
              labelEndX: runWords[runWords.length - 1]!.box.x1,
            };
          }
        }
      }
    }

    if (best) matches.push(best);
  }

  return matches.sort((a, b) => a.distance - b.distance || a.line.index - b.line.index);
}
