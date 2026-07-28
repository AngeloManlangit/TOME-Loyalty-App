import { Timestamp } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS, SESSION_TTL_MINUTES } from '../../config';
import { db } from '../../firebase';
import type { FieldCandidates } from '../core/types';



export interface ScanSession {
  owner_ID: string;
  ocr_text: string;
  candidates: FieldCandidates;
  created_at: Timestamp;
  expires_at: Timestamp;
  /** Set when a claim consumes this session. Present means it cannot be replayed. */
  consumed_at?: Timestamp;
}

function sessions() {
  return db().collection(COLLECTIONS.scanSessions);
}

export async function createSession(input: {
  ownerId: string;
  ocrText: string;
  candidates: FieldCandidates;
  nowMs: number;
}): Promise<string> {
  const ref = sessions().doc();

  await ref.set({
    owner_ID: input.ownerId,
    ocr_text: input.ocrText,
    candidates: input.candidates,
    created_at: Timestamp.fromMillis(input.nowMs),
    // Firestore's TTL policy reaps on this field. It is cleanup only — expiry is ENFORCED below,
    // because Firestore deletes within 24 hours of expiry rather than at the instant, and relying on
    // it alone would leave a day-long replay window.
    expires_at: Timestamp.fromMillis(input.nowMs + SESSION_TTL_MINUTES * 60_000),
  });

  return ref.id;
}

export type SessionLookup =
  | { ok: true; session: ScanSession }
  | { ok: false; reason: 'missing' | 'expired' | 'consumed' | 'not-owner' };


export async function loadSessionForClaim(
  tx: Transaction,
  sessionId: string,
  callerUid: string,
  nowMs: number,
): Promise<SessionLookup> {
  const snap = await tx.get(sessions().doc(sessionId));
  if (!snap.exists) return { ok: false, reason: 'missing' };

  const session = snap.data() as ScanSession;

  if (session.owner_ID !== callerUid) return { ok: false, reason: 'not-owner' };
  if (session.consumed_at) return { ok: false, reason: 'consumed' };
  if (session.expires_at.toMillis() <= nowMs) return { ok: false, reason: 'expired' };

  return { ok: true, session };
}

/** Mark a session consumed within the award transaction, so a replay cannot award twice. */
export function consumeSession(tx: Transaction, sessionId: string, nowMs: number): void {
  tx.update(sessions().doc(sessionId), { consumed_at: Timestamp.fromMillis(nowMs) });
}
