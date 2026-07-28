import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { activeRules, RUNTIME_OPTS } from '../config';
import { isAccredited } from './data/merchantRepo';
import { claimReceipt as runClaimTransaction, countUnusedReceipts } from './data/receiptRepo';
import { rejectionError, requireAuth } from './errors';
import { buildReceiptKey } from './core/receiptKey';
import { validateReceipt } from './core/validate';
import type { OcrDocument } from './core/types';
import { db } from '../firebase';
import { COLLECTIONS } from '../config';
import type { ScanSession } from './data/sessionRepo';



export interface ClaimResponse {
  receiptId: string;
  stampCardId: string;
  /** Unspent stamps the user now holds — the wallet balance, including the one just earned. */
  balance: number;
  /** The card's progress. A claim does not advance it; the future press does. See decision D-1. */
  stampCount: number;
  stampTotal: number;
}


/** Exported for tests: the handler without the onCall wrapper. */
export async function handleClaimReceipt(
  request: Pick<CallableRequest<{ sessionId?: unknown }>, 'auth' | 'data'>,
  deps: { nowMs: number },
): Promise<ClaimResponse> {
  const uid = requireAuth(request.auth);
  const rules = activeRules();

  const sessionId = request.data?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new HttpsError('invalid-argument', 'No scan session was supplied.');
  }

  // Read outside the transaction to re-run the parser; the transaction re-reads and re-checks, so
  // nothing here can be raced.
  const snap = await db().collection(COLLECTIONS.scanSessions).doc(sessionId).get();
  if (!snap.exists) throw rejectionError('SESSION_EXPIRED');

  const session = snap.data() as ScanSession;
  if (session.owner_ID !== uid) throw rejectionError('SESSION_EXPIRED');
  if (session.consumed_at) throw rejectionError('SESSION_EXPIRED');
  if (session.expires_at.toMillis() <= deps.nowMs) throw rejectionError('SESSION_EXPIRED');

  // ── re-validate from the stored OCR text ──────────────────────────────────────────────────────
  // A session id is the ONLY input. Scanned values are not editable, so there is no correction
  // payload to police and no way for a client to influence what is claimed beyond choosing which of
  // its own sessions to submit — the strongest form of the property the two-call flow was built for.
  const doc: OcrDocument = rebuildDocument(session.ocr_text);
  const outcome = validateReceipt({ doc, rules, nowMs: deps.nowMs });

  if (outcome.status !== 'valid') {
    throw rejectionError(outcome.reject);
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
    nowMs: deps.nowMs,
    utcOffsetMinutes: rules.date.utcOffsetMinutes,
    scansPerDay: rules.limits.scansPerUserPerDay,
  });

  if (!result.ok) throw rejectionError(result.reject);

  // Read after the transaction commits, so the count includes the receipt just written. A failed
  // claim never reaches here, so the balance is never reported for a stamp that was not awarded.
  const balance = await countUnusedReceipts(uid);

  return {
    receiptId: result.receiptId,
    stampCardId: result.stampCardId,
    balance,
    stampCount: result.stampCount,
    stampTotal: result.stampTotal,
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
