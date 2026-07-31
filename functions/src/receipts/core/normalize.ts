


export function normalizeText(input: string): string {
  return input
    .replace(/[   -   　]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}


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


export function repairNumericConfusions(input: string): string {
  let out = '';
  for (const ch of input) {
    out += NUMERIC_CONFUSIONS.get(ch) ?? ch;
  }
  return out;
}


export function normalizeFieldValue(input: string, numericOnly: boolean): string {
  const base = stripLabelPunctuation(normalizeText(input));
  return numericOnly ? repairNumericConfusions(base) : base;
}


export function alphanumericOnly(input: string): string {
  return input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
