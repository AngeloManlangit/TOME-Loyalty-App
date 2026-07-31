import type { CallableRequest } from 'firebase-functions/v2/https';
import { makeVisionResponse } from '../../__fixtures__/synth/makeVisionResponse';
import { db } from '../../src/firebase';
import type { VisionResponse } from '../../src/receipts/core/types';



export const PROJECT_ID = 'tome-functions-test';


export function initTestApp(): void {
  process.env.GCLOUD_PROJECT ??= PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT ??= PROJECT_ID;
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
}

export function testDb() {
  initTestApp();
  return db();
}

/** Build a CallableRequest as the Functions runtime would. */
export function callable<T>(data: T, uid?: string): Pick<CallableRequest<T>, 'auth' | 'data'> {
  return {
    data,
    auth: uid ? ({ uid, token: {} } as CallableRequest<T>['auth']) : undefined,
  };
}

/** Delete every document the suite touches, so tests cannot leak into each other. */
export async function clearFirestore(): Promise<void> {
  const firestore = testDb();
  for (const name of ['receipts', 'stamps', 'scan_sessions', 'rate_limits', 'merchants']) {
    const snap = await firestore.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

/** A Vision fake that records how many times it was called — the basis of the "no Vision call" test. */
export function fakeVision(responses: VisionResponse[] = []) {
  const queue = [...responses];
  let calls = 0;
  return {
    async documentTextDetection(): Promise<VisionResponse> {
      calls++;
      const next = queue.shift();
      if (next === undefined) throw new Error('fake Vision client ran out of responses');
      return next;
    },
    callCount: () => calls,
  };
}

/** A Vision fake that always throws, for the outage tests. */
export function throwingVision() {
  let calls = 0;
  return {
    async documentTextDetection(): Promise<VisionResponse> {
      calls++;
      throw new Error('Vision unavailable');
    },
    callCount: () => calls,
  };
}

export const GOOD_RECEIPT_LINES = [
  'HARBOUR CITY DIMSUM HOUSE',
  'VAT REG TIN 003-583-915-00006',
  'MIN: 26013009560086199',
  'INV#00021838',
  'JUL 22 2026',
  'ACCN#: 0810107191682022121668',
];

export function receiptVision(lines: string[] = GOOD_RECEIPT_LINES): VisionResponse {
  return makeVisionResponse({
    rows: lines.map((text, i) => ({ y: 100 + i * 30, cells: [{ text, x: 50 }] })),
  });
}

/** Server clock used throughout: 28 Jul 2026, 12:00 Manila. */
export const NOW = Date.UTC(2026, 6, 28, 4, 0, 0);
