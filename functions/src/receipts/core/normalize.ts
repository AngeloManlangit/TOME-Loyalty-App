/**
 * Text normalization and OCR-confusion repair.
 *
 * The important rule in this file: confusion repair is FIELD-SCOPED, never global. A blanket
 * O -> 0 substitution turns "SUBTOTAL" into "SUBT0TAL" and "OFFICE" into "0FFICE", which would break
 * every label match and corrupt merchant names. Repair is only ever applied to a candidate value that
 * a rule has already declared numeric-only.
 *
 * There is a test that asserts exactly this ("does not repair a word that is not numeric-only").
 */

/**
 * Uppercase, replace Unicode spaces, collapse runs of whitespace, trim.
 *
 * Vision emits non-breaking and thin spaces from justified receipt printing; left alone they break
 * both label matching and the substring check that claimReceipt uses to validate corrections.
 */
export function normalizeText(input: string): string {
  return input
    // U+00A0, U+1680, U+2000-U+200A, U+202F, U+205F, U+3000. These are invisible in an editor, so
    // verify by bytes rather than by eye if this line is ever touched.
    .replace(/[   -   　]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Strip the punctuation that separates a label from its value, plus decorative characters thermal
 * printers scatter around ("*** INVOICE NO. : 12345 ***").
 *
 * Deliberately keeps `-` and `/`, which appear inside real invoice numbers, ACCNs and dates.
 */
export function stripLabelPunctuation(input: string): string {
  return input.replace(/^[\s:.#*|=_-]+|[\s:.*|=_]+$/g, '').trim();
}

/** Characters OCR routinely confuses when reading digits on thermal paper. */
const NUMERIC_CONFUSIONS: ReadonlyMap<string, string> = new Map([
  ['O', '0'],
  ['Q', '0'],
  ['D', '0'],
  ['I', '1'],
  ['L', '1'],
  ['|', '1'],
  ['S', '5'],
  ['B', '8'],
  ['Z', '2'],
  ['G', '6'],
  ['T', '7'],
]);

/**
 * Repair digit-confusions in a value that is known to be numeric-only.
 *
 * ONLY call this for fields whose rule sets `numericOnly: true`. Separators (- and /) pass through
 * untouched so a dash-grouped ACCN keeps its shape.
 */
export function repairNumericConfusions(input: string): string {
  let out = '';
  for (const ch of input) {
    out += NUMERIC_CONFUSIONS.get(ch) ?? ch;
  }
  return out;
}

/**
 * Normalize a candidate value for a specific field.
 *
 * Order matters: uppercase and collapse first, then strip the label punctuation that survived the
 * split, then repair digits only if the field is numeric-only. Repairing before stripping would
 * convert a trailing "." into nothing useful and a leading "O" of a label remnant into "0".
 */
export function normalizeFieldValue(input: string, numericOnly: boolean): string {
  const base = stripLabelPunctuation(normalizeText(input));
  return numericOnly ? repairNumericConfusions(base) : base;
}

/**
 * Remove every character that is not alphanumeric, so two strings can be compared for "same content,
 * different separators". Used when checking a user's correction against the stored OCR text, where
 * insisting on identical spacing and dashes would reject legitimate fixes.
 */
export function alphanumericOnly(input: string): string {
  return input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
