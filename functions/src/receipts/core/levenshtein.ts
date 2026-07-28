
export function boundedLevenshtein(a: string, b: string, max: number): number {
  const exceeded = max + 1;

  if (max < 0) return exceeded;
  if (a === b) return 0;

  // Length difference alone can exceed the bound — the cheapest possible rejection.
  if (Math.abs(a.length - b.length) > max) return exceeded;

  // Ensure `a` is the shorter string so the DP row is as small as possible.
  if (a.length > b.length) {
    const t = a;
    a = b;
    b = t;
  }

  // b.length is already known to be <= max here: `a` is the shorter string and the length-difference
  // check above returned when |a - b| exceeded the bound, so with a empty that difference IS b.length.
  if (a.length === 0) return b.length;

  const n = a.length;
  let prev: number[] = new Array<number>(n + 1);
  let curr: number[] = new Array<number>(n + 1);

  for (let i = 0; i <= n; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    let rowMin = curr[0]!;

    for (let i = 1; i <= n; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        curr[i - 1]! + 1, // insertion
        prev[i]! + 1, // deletion
        prev[i - 1]! + cost, // substitution
      );
      curr[i] = v;
      if (v < rowMin) rowMin = v;
    }

    // Every remaining cell is >= rowMin, so once the whole row is past the bound we can stop.
    if (rowMin > max) return exceeded;

    const swap = prev;
    prev = curr;
    curr = swap;
  }

  // The row-min early exit does not subsume this: a row can contain a cell within the bound while the
  // final cell still exceeds it. A transposition is the smallest example — "AB" vs "BA" with max 1
  // never trips the early exit, yet the true distance is 2.
  const result = prev[n]!;
  return result <= max ? result : exceeded;
}

/** Convenience wrapper for the common "close enough?" question. */
export function isWithinDistance(a: string, b: string, max: number): boolean {
  return boundedLevenshtein(a, b, max) <= max;
}
