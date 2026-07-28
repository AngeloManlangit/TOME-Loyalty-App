import type { RejectCode } from './types';

/**
 * Builds the `{min}__{invoice_no}` uniqueness key used as the Firestore document ID for a claimed
 * receipt. Both fields are needed — invoice numbers are only sequential within a terminal. Left
 * readable rather than hashed so the constraint is visible in the Firestore console.
 *
 * ⚠️ The first component is the MIN, not the ACCN that design decision D5 specified. The corpus
 * disproved D5: unrelated merchants share an ACCN when they share a POS vendor, so it would collide
 * once their independent invoice counters overlapped. MIN is per terminal, and a terminal emits each
 * invoice number exactly once.
 *
 * Firestore's document-ID constraints are checked here rather than at write time, which would fail
 * after Vision has already been paid for: non-empty, no slash, not "." or "..", not the reserved
 * `__.*__` pattern, at most 1500 bytes.
 */

const MAX_KEY_BYTES = 1500;
const SEPARATOR = '__';

export type ReceiptKeyResult = { ok: true; key: string } | { ok: false; reject: RejectCode };

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function buildReceiptKey(min: string, invoiceNo: string): ReceiptKeyResult {
  const m = min.trim();
  const i = invoiceNo.trim();

  if (m.length === 0) return { ok: false, reject: 'MIN_MISSING' };
  if (i.length === 0) return { ok: false, reject: 'INVOICE_MISSING' };

  // A slash would silently turn the ID into a collection path.
  if (m.includes('/')) return { ok: false, reject: 'MIN_MALFORMED' };
  if (i.includes('/')) return { ok: false, reject: 'INVOICE_MALFORMED' };

  const key = `${m}${SEPARATOR}${i}`;

  // "." and ".." need no check: the key always has "__" between two non-empty components.
  // Firestore reserves IDs that both start and end with a double underscore.
  if (/^__.*__$/.test(key)) return { ok: false, reject: 'RECEIPT_KEY_INVALID' };

  if (byteLength(key) > MAX_KEY_BYTES) return { ok: false, reject: 'RECEIPT_KEY_INVALID' };

  return { ok: true, key };
}
