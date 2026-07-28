import { HttpsError } from 'firebase-functions/v2/https';
import type { RejectCode } from './core/types';



interface Mapping {
  status: 'invalid-argument' | 'failed-precondition' | 'resource-exhausted' | 'unauthenticated';
  message: string;
}

const MAPPINGS: Record<RejectCode, Mapping> = {
  // criterion 1 — invoice
  INVOICE_MISSING: {
    status: 'invalid-argument',
    message: 'We could not find an invoice number on this receipt.',
  },
  INVOICE_MALFORMED: {
    status: 'invalid-argument',
    message: 'That invoice number does not look right.',
  },
  INVOICE_DUPLICATE: {
    status: 'failed-precondition',
    message: 'This receipt has already been claimed.',
  },

  // criterion 2 — date
  DATE_MISSING: { status: 'invalid-argument', message: 'We could not find a date on this receipt.' },
  DATE_UNPARSEABLE: { status: 'invalid-argument', message: 'That date does not look right.' },
  DATE_FUTURE: {
    status: 'failed-precondition',
    message: 'This receipt is dated in the future.',
  },
  DATE_EXPIRED: {
    status: 'failed-precondition',
    message: 'This receipt is too old to claim.',
  },

  // criterion 3 — machine identity
  MIN_MISSING: {
    status: 'invalid-argument',
    message: 'We could not find the machine number (MIN) on this receipt.',
  },
  MIN_MALFORMED: {
    status: 'invalid-argument',
    message: 'That machine number (MIN) does not look right.',
  },

  // POS accreditation
  ACCN_MISSING: {
    status: 'invalid-argument',
    message: 'We could not find the ACCN on this receipt.',
  },
  ACCN_MALFORMED: { status: 'invalid-argument', message: 'That ACCN does not look right.' },
  ACCN_NOT_ACCREDITED: {
    status: 'failed-precondition',
    message: 'This receipt is not from an accredited point-of-sale system.',
  },
  MERCHANT_NOT_ACCREDITED: {
    status: 'failed-precondition',
    message: 'This store is not part of the rewards programme.',
  },

  // OCR / input
  OCR_NO_TEXT: {
    status: 'invalid-argument',
    message: 'We could not read any text. Try again in better light.',
  },
  NOT_A_RECEIPT: { status: 'invalid-argument', message: 'That does not look like a receipt.' },

  // flow / abuse
  RATE_LIMITED: {
    status: 'resource-exhausted',
    message: 'You have reached today’s scan limit. Try again tomorrow.',
  },
  SESSION_EXPIRED: {
    status: 'failed-precondition',
    message: 'This scan expired. Please take the photo again.',
  },
  CORRECTION_NOT_IN_OCR: {
    status: 'invalid-argument',
    message: 'That correction does not appear on the receipt you photographed.',
  },

  // key safety
  RECEIPT_KEY_INVALID: {
    status: 'invalid-argument',
    message: 'We could not read this receipt’s details clearly enough.',
  },
};

export function rejectionError(code: RejectCode): HttpsError {
  const mapping = MAPPINGS[code];
  return new HttpsError(mapping.status, mapping.message, { reject: code });
}

/** Guard for both callables. Anonymous access is never permitted. */
export function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to scan a receipt.');
  }
  return auth.uid;
}
