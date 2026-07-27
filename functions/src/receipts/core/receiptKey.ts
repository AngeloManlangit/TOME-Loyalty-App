import type { RejectCode } from './types';

/**
 * Builds the `{accn}__{invoice_no}` uniqueness key used as the Firestore document ID for a claimed
 * receipt (design decision D5).
 *
 * Keyed on BOTH fields because two different stores can legitimately both issue "INV-0001"; invoice
 * number alone would manufacture false duplicates across merchants. Kept as a readable composite
 * rather than a hash so the constraint is self-evident in the Firestore console and support can find a
 * receipt by eye.
 *
 * Firestore imposes constraints on document IDs that the architecture doc does not account for, and
 * violating them fails at write time — i.e. after Vision has already been paid for and the user is
 * waiting. All of them are checked here instead:
 *
 *   - must not be empty
 *   - must not contain a forward slash (it would silently create a subcollection path)
 *   - must not be "." or ".."
 *   - must not match the reserved __.*__ pattern
 *   - must be at most 1500 BYTES (not characters)
 */

const MAX_KEY_BYTES = 1500;
const SEPARATOR = '__';

export type ReceiptKeyResult =
  | { ok: true; key: string }
  | { ok: false; reject: RejectCode };

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function buildReceiptKey(accn: string, invoiceNo: string): ReceiptKeyResult {
  const a = accn.trim();
  const i = invoiceNo.trim();

  if (a.length === 0) return { ok: false, reject: 'ACCN_MISSING' };
  if (i.length === 0) return { ok: false, reject: 'INVOICE_MISSING' };

  // A slash would turn the ID into a collection path rather than failing loudly.
  if (a.includes('/')) return { ok: false, reject: 'ACCN_MALFORMED' };
  if (i.includes('/')) return { ok: false, reject: 'INVOICE_MALFORMED' };

  const key = `${a}${SEPARATOR}${i}`;

  // Firestore also forbids the ids "." and "..", but the key always contains the "__" separator
  // between two non-empty components, so it can never equal either. No check is needed.

  // Firestore reserves IDs that both start and end with a double underscore.
  if (/^__.*__$/.test(key)) return { ok: false, reject: 'RECEIPT_KEY_INVALID' };

  if (byteLength(key) > MAX_KEY_BYTES) return { ok: false, reject: 'RECEIPT_KEY_INVALID' };

  return { ok: true, key };
}
