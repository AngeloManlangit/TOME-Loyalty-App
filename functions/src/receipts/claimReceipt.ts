import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { activeRules, RUNTIME_OPTS } from '../config';
import { isAccredited } from './data/merchantRepo';
import { claimReceipt as runClaimTransaction } from './data/receiptRepo';
import { rejectionError, requireAuth } from './errors';
import { alphanumericOnly } from './core/normalize';
import { buildReceiptKey } from './core/receiptKey';
import { validateReceipt } from './core/validate';
import type { OcrDocument, ReceiptFieldName } from './core/types';
import { db } from '../firebase';
import { COLLECTIONS } from '../config';
import type { ScanSession } from './data/sessionRepo';



const CORRECTABLE: readonly ReceiptFieldName[] = [
  'invoice_no',
  'min',
  'accn',
  'tin',
  'receipt_date',
];

export interface ClaimResponse {
  receiptId: string;
  stampCardId: string;
  stampCount: number;
  stampTotal: number;
  rewardReached: boolean;
}


export function correctionAppearsInOcr(field: ReceiptFieldName, value: string, ocrText: string): boolean {
  if (field === 'receipt_date') return true;
  const needle = alphanumericOnly(value);
  if (needle.length === 0) return false;
  return alphanumericOnly(ocrText).includes(needle);
}

/** Exported for tests: the handler without the onCall wrapper. */
export async function handleClaimReceipt(
  request: Pick<CallableRequest<{ sessionId?: unknown; corrections?: unknown }>, 'auth' | 'data'>,
  deps: { nowMs: number },
): Promise<ClaimResponse> {
  const uid = requireAuth(request.auth);
  const rules = activeRules();

  const sessionId = request.data?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new HttpsError('invalid-argument', 'No scan session was supplied.');
  }

  // Read outside the transaction to validate corrections and re-run the parser; the transaction
  // re-reads and re-checks, so nothing here can be raced.
  const snap = await db().collection(COLLECTIONS.scanSessions).doc(sessionId).get();
  if (!snap.exists) throw rejectionError('SESSION_EXPIRED');

  const session = snap.data() as ScanSession;
  if (session.owner_ID !== uid) throw rejectionError('SESSION_EXPIRED');
  if (session.consumed_at) throw rejectionError('SESSION_EXPIRED');
  if (session.expires_at.toMillis() <= deps.nowMs) throw rejectionError('SESSION_EXPIRED');

  // ── corrections ───────────────────────────────────────────────────────────────────────────────
  const raw = request.data?.corrections;
  const corrections: Partial<Record<ReceiptFieldName, string>> = {};
  const correctedFields: string[] = [];

  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object') {
      throw new HttpsError('invalid-argument', 'Corrections must be an object.');
    }
    for (const field of CORRECTABLE) {
      const value = (raw as Record<string, unknown>)[field];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string') {
        throw new HttpsError('invalid-argument', `Correction for ${field} must be text.`);
      }
      if (!correctionAppearsInOcr(field, value, session.ocr_text)) {
        throw rejectionError('CORRECTION_NOT_IN_OCR');
      }
      corrections[field] = value;
      correctedFields.push(field);
    }
  }

  // ── re-validate from the stored OCR text, in claim mode ───────────────────────────────────────
  // The client's field values are never read; only the session and corrections are inputs.
  const doc: OcrDocument = rebuildDocument(session.ocr_text);
  const outcome = validateReceipt({
    doc,
    rules,
    nowMs: deps.nowMs,
    mode: 'claim',
    overrides: corrections,
  });

  if (outcome.status !== 'valid') {
    throw rejectionError(outcome.status === 'rejected' ? outcome.reject : 'INVOICE_MISSING');
  }

  if (rules.accreditation.enforceWhitelist && !(await isAccredited(outcome.fields.tin))) {
    throw rejectionError('MERCHANT_NOT_ACCREDITED');
  }

  const key = buildReceiptKey(outcome.fields.min, outcome.fields.invoice_no);
  if (!key.ok) throw rejectionError(key.reject);

  const result = await runClaimTransaction({
    uid,
    sessionId,
    key: key.key,
    fields: outcome.fields,
    confidence: outcome.confidence,
    correctedFields,
    nowMs: deps.nowMs,
    utcOffsetMinutes: rules.date.utcOffsetMinutes,
    scansPerDay: rules.limits.scansPerUserPerDay,
  });

  if (!result.ok) throw rejectionError(result.reject);

  return {
    receiptId: result.receiptId,
    stampCardId: result.stampCardId,
    stampCount: result.stampCount,
    stampTotal: result.stampTotal,
    rewardReached: result.stampCount >= result.stampTotal,
  };
}


function rebuildDocument(text: string): OcrDocument {
  const lines = text.split('\n').map((lineText, index) => {
    const words = lineText.split(' ').filter((w) => w.length > 0);
    let cursor = 0;
    const ocrWords = words.map((w) => {
      const x0 = cursor * 10;
      cursor += w.length + 1;
      return {
        text: w,
        box: { x0, y0: index * 30, x1: x0 + w.length * 10, y1: index * 30 + 20 },
        confidence: 1,
      };
    });

    return {
      text: lineText,
      box: { x0: 0, y0: index * 30, x1: Math.max(1, lineText.length * 10), y1: index * 30 + 20 },
      confidence: 1,
      words: ocrWords,
      index,
    };
  });

  return {
    lines,
    words: lines.flatMap((l) => l.words),
    text,
    meanConfidence: 1,
  };
}

export const claimReceipt = onCall(RUNTIME_OPTS, (request) =>
  handleClaimReceipt(request, { nowMs: Date.now() }),
);
