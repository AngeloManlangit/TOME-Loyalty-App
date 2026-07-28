import { Timestamp } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../../config';
import { db } from '../../firebase';
import { localCalendarDay } from '../core/dateParse';



export interface RateLimitDoc {
  /** YYYYMMDD as an integer in the receipt timezone, e.g. 20260728. */
  day_key: number;
  count: number;
  updated_at: Timestamp;
}

function limits() {
  return db().collection(COLLECTIONS.rateLimits);
}

/** Day key in the receipt's timezone, so the window rolls over at local midnight, not UTC's. */
export function dayKey(nowMs: number, utcOffsetMinutes: number): number {
  const { year, month, day } = localCalendarDay(nowMs, utcOffsetMinutes);
  return year * 10_000 + month * 100 + day;
}

export interface RateLimitStatus {
  allowed: boolean;
  count: number;
  limit: number;
}


export async function checkRateLimit(
  uid: string,
  limit: number,
  nowMs: number,
  utcOffsetMinutes: number,
): Promise<RateLimitStatus> {
  const snap = await limits().doc(uid).get();
  const today = dayKey(nowMs, utcOffsetMinutes);

  const count =
    snap.exists && (snap.data() as RateLimitDoc).day_key === today
      ? (snap.data() as RateLimitDoc).count
      : 0;

  return { allowed: count < limit, count, limit };
}

/** Read the current count inside a transaction, so the increment cannot race with itself. */
export async function readCountInTransaction(
  tx: Transaction,
  uid: string,
  nowMs: number,
  utcOffsetMinutes: number,
): Promise<number> {
  const snap = await tx.get(limits().doc(uid));
  const today = dayKey(nowMs, utcOffsetMinutes);

  if (!snap.exists) return 0;
  const data = snap.data() as RateLimitDoc;
  return data.day_key === today ? data.count : 0;
}

/** Write the incremented count as part of the award transaction. */
export function bumpRateLimit(
  tx: Transaction,
  uid: string,
  currentCount: number,
  nowMs: number,
  utcOffsetMinutes: number,
): void {
  tx.set(limits().doc(uid), {
    day_key: dayKey(nowMs, utcOffsetMinutes),
    count: currentCount + 1,
    updated_at: Timestamp.fromMillis(nowMs),
  });
}
