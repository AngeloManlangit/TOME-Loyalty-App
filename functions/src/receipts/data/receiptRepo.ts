import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, DEFAULT_STAMP_CARD } from '../../config';
import { db } from '../../firebase';
import type { ReceiptFields, RejectCode } from '../core/types';
import { bumpRateLimit, readCountInTransaction } from './rateLimitRepo';
import { consumeSession, loadSessionForClaim } from './sessionRepo';



export interface ReceiptDoc {
  owner_ID: string;
  min: string;
  invoice_no: string;
  receipt_date: Timestamp;
  claimed_at: Timestamp;
  stamp_card_ID: string;
  accn?: string;
  tin?: string;
  ocr_confidence: number;
  was_manually_corrected: boolean;
  corrected_fields?: string[];
  /**
   * The wallet. An unused receipt IS a stamp the user holds; the balance is the count of these.
   *
   * ⚠️ This field is money. A client able to set it back to false mints unlimited stamps, so
   * `receipts` denies all client writes in firestore.rules and the future "Stamp this card" press
   * must flip it through a Cloud Function, never a loosened rule.
   */
  is_used: boolean;
  /** When the stamp was spent onto a card. Absent until the future press flow writes it. */
  used_at?: Timestamp;
}

export interface ClaimInput {
  uid: string;
  sessionId: string;
  key: string;
  fields: ReceiptFields;
  confidence: number;
  correctedFields: string[];
  nowMs: number;
  utcOffsetMinutes: number;
  scansPerDay: number;
}

export type ClaimResult =
  | {
      ok: true;
      receiptId: string;
      stampCardId: string;
      /** The card's progress. Unchanged by a claim — only the future press advances it. */
      stampCount: number;
      stampTotal: number;
    }
  | { ok: false; reject: RejectCode };

/**
 * The user's stamp balance: how many claimed receipts are still unspent.
 *
 * An aggregate over the ledger rather than a denormalized counter, because a counter can drift out
 * of agreement with the receipts it claims to count and an aggregate cannot. Billed as one read per
 * 1,000 index entries. Needs the (owner_ID, is_used) composite index.
 */
export async function countUnusedReceipts(uid: string): Promise<number> {
  const snapshot = await db()
    .collection(COLLECTIONS.receipts)
    .where('owner_ID', '==', uid)
    .where('is_used', '==', false)
    .count()
    .get();

  return snapshot.data().count;
}

export async function claimReceipt(input: ClaimInput): Promise<ClaimResult> {
  const firestore = db();
  const receiptRef = firestore.collection(COLLECTIONS.receipts).doc(input.key);

  return firestore.runTransaction(async (tx): Promise<ClaimResult> => {
    // ── ALL READS FIRST. Firestore forbids a read after a write in a transaction. ────────────────
    const session = await loadSessionForClaim(tx, input.sessionId, input.uid, input.nowMs);
    if (!session.ok) {
      // Every failure mode here — missing, expired, consumed, or someone else's — is reported as
      // SESSION_EXPIRED. Distinguishing them would tell a caller whether a session ID they guessed
      // exists and who owns it.
      return { ok: false, reject: 'SESSION_EXPIRED' };
    }

    const existing = await tx.get(receiptRef);
    if (existing.exists) return { ok: false, reject: 'INVOICE_DUPLICATE' };

    const rateCount = await readCountInTransaction(
      tx,
      input.uid,
      input.nowMs,
      input.utcOffsetMinutes,
    );
    if (rateCount >= input.scansPerDay) return { ok: false, reject: 'RATE_LIMITED' };

    const cards = await tx.get(
      firestore.collection(COLLECTIONS.stamps).where('owner_ID', '==', input.uid).limit(1),
    );

    // ── WRITES ──────────────────────────────────────────────────────────────────────────────────
    const stampRef = cards.empty
      ? firestore.collection(COLLECTIONS.stamps).doc()
      : cards.docs[0]!.ref;
    const priorCount = cards.empty ? 0 : ((cards.docs[0]!.data().stamp_count as number) ?? 0);
    const stampTotal = cards.empty
      ? DEFAULT_STAMP_CARD.stamp_total
      : ((cards.docs[0]!.data().stamp_total as number) ?? DEFAULT_STAMP_CARD.stamp_total);

    const claimedAt = Timestamp.fromMillis(input.nowMs);

    const receipt: ReceiptDoc = {
      owner_ID: input.uid,
      min: input.fields.min,
      invoice_no: input.fields.invoice_no,
      receipt_date: Timestamp.fromMillis(input.fields.receipt_date_ms),
      claimed_at: claimedAt,
      stamp_card_ID: stampRef.id,
      ocr_confidence: input.confidence,
      was_manually_corrected: input.correctedFields.length > 0,
      // The stamp the user just earned, unspent. Decision D-1: scanning fills the WALLET; the
      // future "Stamp this card" press is what moves a stamp onto the card and flips this to true.
      // Incrementing stamp_count here as well would count the same stamp twice once that ships.
      is_used: false,
    };
    if (input.fields.accn !== undefined) receipt.accn = input.fields.accn;
    if (input.fields.tin !== undefined) receipt.tin = input.fields.tin;
    if (input.correctedFields.length > 0) receipt.corrected_fields = input.correctedFields;

    // `create` rather than `set`: "already exists" becomes a precondition failure enforced by
    // Firestore itself, not a read-then-write race we hand-roll.
    tx.create(receiptRef, receipt);

    if (cards.empty) {
      // A user's first valid receipt creates their card, so stamp_card_ID always points at a real
      // document and the future press has a target. It starts empty — the receipt is the stamp.
      tx.create(stampRef, {
        ...DEFAULT_STAMP_CARD,
        owner_ID: input.uid,
        stamp_count: 0,
        history: [],
      });
    }

    bumpRateLimit(tx, input.uid, rateCount, input.nowMs, input.utcOffsetMinutes);
    consumeSession(tx, input.sessionId, input.nowMs);

    return {
      ok: true,
      receiptId: input.key,
      stampCardId: stampRef.id,
      stampCount: priorCount,
      stampTotal,
    };
  });
}
