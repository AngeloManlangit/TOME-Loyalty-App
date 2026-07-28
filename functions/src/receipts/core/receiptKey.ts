import type { RejectCode } from './types';



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
