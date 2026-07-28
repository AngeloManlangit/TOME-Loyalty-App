import { boundedLevenshtein } from './levenshtein';
import { alphanumericOnly, normalizeText } from './normalize';
import type { OcrLine } from './types';

/**
 * Locating label lines ("INVOICE NO", "ACCN", "DATE") in an OCR document.
 *
 * Not a string search: Vision mangles labels as often as values ("INVOlCE NO"), so matching is by
 * bounded edit distance; and a label may split across words unpredictably ("INV#" vs "INV" + "#"),
 * so comparison is on alphanumeric-only forms over word runs of varying length.
 */

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
  /**
   * Value found INSIDE the matched word, when label and value are printed glued — common in the
   * corpus (`INV#00021838`). Without it the combined token matches no alias and the field is lost.
   */
  gluedValue?: string;
  /** Right edge of the label, for geometry searches. */
  labelEndX: number;
}

/**
 * Edit-distance budget for an alias. Short aliases get none — one edit would have "MIN" and "TIN"
 * matching "PIN", "MAIN" and each other. Long ones get two, since faded print does multi-character
 * damage to strings like "ACKNOWLEDGEMENT CERTIFICATE".
 */
export function distanceBudget(alias: string): number {
  const length = alphanumericOnly(alias).length;
  if (length <= 3) return 0;
  // At nine characters, two edits let "INVOICE NO" match the bare word "INVOICE", anchoring on
  // "...OFFICIAL SALES INVOICE" and yielding the invoice number "SERVES".
  if (length <= 10) return 1;
  return 2;
}

/** Separators a receipt may put between a glued label and its value. */
const GLUE_SEPARATORS = /^[#:.\-=/\s]+/;

/**
 * Split a token into (label, value) when a label is printed glued to its value. Requires a
 * separator or a digit after the label, else alias "INV" would split "INVOICE" into INV + OICE.
 */
export function splitGluedLabel(word: string, alias: string): string | null {
  const upperWord = normalizeText(word);
  const target = alphanumericOnly(alias);
  if (target.length === 0) return null;

  // Shortest prefix whose alphanumeric form equals the alias. Raw prefixes would miss punctuated
  // labels ("S.I.#0001234"); shortest wins so the split never eats into the value.
  let labelLength = -1;
  for (let i = 1; i <= upperWord.length; i++) {
    const prefix = alphanumericOnly(upperWord.slice(0, i));
    if (prefix.length > target.length) break; // gone past it
    if (prefix === target) {
      labelLength = i;
      break;
    }
  }
  if (labelLength === -1) return null;

  const remainder = upperWord.slice(labelLength);
  if (remainder.length === 0) return null;

  const separatorMatch = remainder.match(GLUE_SEPARATORS);
  const value = separatorMatch ? remainder.slice(separatorMatch[0].length) : remainder;
  if (value.length === 0) return null;

  // Without a separator, require a digit after the label (see above).
  if (!separatorMatch && !/^[0-9]/.test(value)) return null;

  return value;
}

/**
 * Find every line carrying one of `aliases`, best match per line. Ordered by edit distance then
 * document order, so the first result is the most trustworthy anchor.
 */
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

      // Glued form first: a single token carrying both label and value, e.g. "INV#00021838".
      for (let start = 0; start < line.words.length; start++) {
        const glued = splitGluedLabel(line.words[start]!.text, alias);
        if (glued === null) continue;

        // Distance 0: the label was read exactly, it just was not spaced.
        if (best === null || best.distance > 0) {
          best = {
            line,
            alias,
            distance: 0,
            startWord: start,
            endWord: start + 1,
            trailing: line.words
              .slice(start + 1)
              .map((w) => w.text)
              .join(' ')
              .trim(),
            gluedValue: glued,
            labelEndX: line.words[start]!.box.x1,
          };
        }
      }

      for (let start = 0; start < line.words.length; start++) {
        for (let run = 1; run <= maxRun && start + run <= line.words.length; run++) {
          const runWords = line.words.slice(start, start + run);
          const runText = alphanumericOnly(runWords.map((w) => w.text).join(''));
          if (runText.length === 0) continue;

          const distance = boundedLevenshtein(runText, target, budget);
          if (distance > budget) continue;

          // Closer match wins. On a tie prefer the earliest label, then the longer run (which eats
          // trailing punctuation like "NO." instead of leaving it in the value). Position matters
          // on merged multi-document lines: the Robinsons fixture matches "SI NO" at position 0 and
          // "INVOICE NO" mid-line, and preferring the later one gave the invoice number "TERMINAL".
          // A glued match is never displaced by a tie — it already carries a concrete value.
          const better =
            best === null ||
            distance < best.distance ||
            (distance === best.distance &&
              best.gluedValue === undefined &&
              (start < best.startWord ||
                (start === best.startWord && start + run > best.endWord)));

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
