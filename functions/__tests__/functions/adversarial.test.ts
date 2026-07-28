import { HttpsError } from 'firebase-functions/v2/https';
import { COLLECTIONS } from '../../src/config';
import { handleClaimReceipt } from '../../src/receipts/claimReceipt';
import { handleScanReceipt } from '../../src/receipts/scanReceipt';
import {
  callable,
  clearFirestore,
  fakeVision,
  GOOD_RECEIPT_LINES,
  NOW,
  receiptVision,
  testDb,
  throwingVision,
} from './helpers';



const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const IMAGE = 'aGVsbG8='; // any non-empty base64

jest.setTimeout(30_000);

/** Reject code carried on the thrown HttpsError, or null if it was not a rejection. */
async function rejectCodeOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof HttpsError) {
      const details = error.details as { reject?: string } | undefined;
      return details?.reject ?? error.code;
    }
    throw error;
  }
}

async function scan(uid: string, lines = GOOD_RECEIPT_LINES, nowMs = NOW) {
  return handleScanReceipt(callable({ imageBase64: IMAGE }, uid), {
    vision: fakeVision([receiptVision(lines)]),
    nowMs,
  });
}

/**
 * `extra` exists only so tests can prove that anything a client bolts onto the payload is ignored.
 * The real call takes a session id and nothing else.
 */
async function claim(uid: string, sessionId: string, nowMs = NOW, extra?: object) {
  return handleClaimReceipt(callable({ sessionId, ...extra }, uid), { nowMs });
}

beforeEach(async () => {
  await clearFirestore();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the happy path', () => {
  it('scans and claims, awarding exactly one stamp', async () => {
    const scanned = await scan(ALICE);
    expect(scanned.sessionId).toBeTruthy();
    expect(scanned.fields.invoice_no).toBe('00021838');

    const result = await claim(ALICE, scanned.sessionId);
    expect(result.receiptId).toBe('26013009560086199__00021838');
    // One stamp earned, held in the wallet as an unspent receipt.
    expect(result.balance).toBe(1);

    const card = await testDb().collection(COLLECTIONS.stamps).doc(result.stampCardId).get();
    expect(card.data()!.owner_ID).toBe(ALICE);
  });

  it('writes the receipt with the fields the server derived, not the client', async () => {
    const scanned = await scan(ALICE);
    await claim(ALICE, scanned.sessionId);

    const doc = await testDb()
      .collection(COLLECTIONS.receipts)
      .doc('26013009560086199__00021838')
      .get();

    expect(doc.data()).toMatchObject({
      owner_ID: ALICE,
      min: '26013009560086199',
      invoice_no: '00021838',
      tin: '003-583-915-00006',
      accn: '0810107191682022121668',
      was_manually_corrected: false,
      is_used: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('duplicate claims', () => {
  it('rejects the same receipt claimed twice by the same user', async () => {
    const first = await scan(ALICE);
    await claim(ALICE, first.sessionId);

    const second = await scan(ALICE);
    expect(await rejectCodeOf(() => claim(ALICE, second.sessionId))).toBe('INVOICE_DUPLICATE');
  });

  it('rejects the same receipt claimed by a DIFFERENT user', async () => {
    const alice = await scan(ALICE);
    await claim(ALICE, alice.sessionId);

    const bob = await scan(BOB);
    expect(await rejectCodeOf(() => claim(BOB, bob.sessionId))).toBe('INVOICE_DUPLICATE');
  });

  it('awards exactly one stamp when two claims race', async () => {
    // The property the whole transaction exists for.
    const a = await scan(ALICE);
    const b = await scan(BOB);

    const results = await Promise.allSettled([claim(ALICE, a.sessionId), claim(BOB, b.sessionId)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const receipts = await testDb().collection(COLLECTIONS.receipts).get();
    expect(receipts.size).toBe(1);

    // Exactly one wallet entry across both users — the receipt IS the stamp, so one receipt
    // document is one stamp and there is no separate counter that could disagree with it.
    const unspent = await testDb()
      .collection(COLLECTIONS.receipts)
      .where('is_used', '==', false)
      .get();
    expect(unspent.size).toBe(1);
  });

  it('lets a DIFFERENT receipt from the same terminal through', async () => {
    const first = await scan(ALICE);
    await claim(ALICE, first.sessionId);

    const otherInvoice = GOOD_RECEIPT_LINES.map((l) =>
      l === 'INV#00021838' ? 'INV#00022492' : l,
    );
    const second = await scan(ALICE, otherInvoice);
    const result = await claim(ALICE, second.sessionId);

    expect(result.receiptId).toBe('26013009560086199__00022492');
    expect(result.balance).toBe(2);
  });

  it('lets two merchants issue the same invoice number', async () => {
    // The false-duplicate case that keying on the shared vendor ACCN would have produced.
    const first = await scan(ALICE);
    await claim(ALICE, first.sessionId);

    const otherTerminal = GOOD_RECEIPT_LINES.map((l) =>
      l.startsWith('MIN:') ? 'MIN: 25090417305924929' : l,
    );
    const second = await scan(ALICE, otherTerminal);
    const result = await claim(ALICE, second.sessionId);

    expect(result.receiptId).toBe('25090417305924929__00021838');
    expect(result.balance).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('authentication', () => {
  it('rejects an unauthenticated scan', async () => {
    await expect(
      handleScanReceipt(callable({ imageBase64: IMAGE }), {
        vision: fakeVision([receiptVision()]),
        nowMs: NOW,
      }),
    ).rejects.toThrow(/signed in/i);
  });

  it('rejects an unauthenticated claim', async () => {
    const scanned = await scan(ALICE);
    await expect(
      handleClaimReceipt(callable({ sessionId: scanned.sessionId }), { nowMs: NOW }),
    ).rejects.toThrow(/signed in/i);
  });

  it('makes NO Vision call for an unauthenticated scan', async () => {
    const vision = fakeVision([receiptVision()]);
    await expect(
      handleScanReceipt(callable({ imageBase64: IMAGE }), { vision, nowMs: NOW }),
    ).rejects.toThrow();
    expect(vision.callCount()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('rate limiting — a billing control', () => {
  it('rejects once the daily limit is reached, and spends NOTHING on Vision', async () => {
    await testDb().collection(COLLECTIONS.rateLimits).doc(ALICE).set({
      day_key: 20260728,
      count: 20,
      updated_at: new Date(),
    });

    const vision = fakeVision([receiptVision()]);
    const code = await rejectCodeOf(() =>
      handleScanReceipt(callable({ imageBase64: IMAGE }, ALICE), { vision, nowMs: NOW }),
    );

    expect(code).toBe('RATE_LIMITED');
    // The point of checking the limit BEFORE the OCR call: abuse costs nothing.
    expect(vision.callCount()).toBe(0);
  });

  it('ignores a counter from a previous day', async () => {
    await testDb().collection(COLLECTIONS.rateLimits).doc(ALICE).set({
      day_key: 20260727,
      count: 20,
      updated_at: new Date(),
    });
    await expect(scan(ALICE)).resolves.toMatchObject({ fields: { invoice_no: '00021838' } });
  });

  it('increments the counter on a successful claim', async () => {
    const scanned = await scan(ALICE);
    await claim(ALICE, scanned.sessionId);

    const doc = await testDb().collection(COLLECTIONS.rateLimits).doc(ALICE).get();
    expect(doc.data()).toMatchObject({ day_key: 20260728, count: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('sessions', () => {
  it('rejects a claim against another user’s session', async () => {
    const scanned = await scan(ALICE);
    expect(await rejectCodeOf(() => claim(BOB, scanned.sessionId))).toBe('SESSION_EXPIRED');
  });

  it('rejects an expired session, using the SERVER clock', async () => {
    const scanned = await scan(ALICE);
    const sixteenMinutesLater = NOW + 16 * 60_000;
    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId, sixteenMinutesLater))).toBe(
      'SESSION_EXPIRED',
    );
  });

  it('rejects a replayed session', async () => {
    const scanned = await scan(ALICE);
    await claim(ALICE, scanned.sessionId);
    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId))).toBe('SESSION_EXPIRED');
  });

  it('rejects an unknown session id', async () => {
    expect(await rejectCodeOf(() => claim(ALICE, 'does-not-exist'))).toBe('SESSION_EXPIRED');
  });

  it('reports every session failure identically, so it cannot be used as an oracle', async () => {
    const scanned = await scan(ALICE);
    const codes = await Promise.all([
      rejectCodeOf(() => claim(BOB, scanned.sessionId)),
      rejectCodeOf(() => claim(ALICE, 'does-not-exist')),
    ]);
    expect(new Set(codes)).toEqual(new Set(['SESSION_EXPIRED']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Scanned values are not editable. There is no correction payload to police any more, which makes
// the forgery question trivial: a session id is the only input the server reads, so the strongest
// thing a compromised client can do is choose which of its own scans to submit.
describe('the client cannot influence what is claimed', () => {
  it('ignores a corrections payload smuggled onto the request', async () => {
    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId, NOW, {
      corrections: { invoice_no: '99999999', min: '99999999999999999' },
    });

    // The receipt claimed is the one that was photographed, not the one that was asked for.
    expect(result.receiptId).toBe('26013009560086199__00021838');
  });

  it('ignores forged field values sent at the top level', async () => {
    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId, NOW, {
      invoice_no: '99999999',
      min: '99999999999999999',
      fields: { invoice_no: '99999999' },
    });

    expect(result.receiptId).toBe('26013009560086199__00021838');
  });

  it('records that no claimed receipt was ever hand-edited', async () => {
    const scanned = await scan(ALICE);
    await claim(ALICE, scanned.sessionId);

    const doc = await testDb()
      .collection(COLLECTIONS.receipts)
      .doc('26013009560086199__00021838')
      .get();
    expect(doc.data()!.was_manually_corrected).toBe(false);
    expect(doc.data()!.corrected_fields).toBeUndefined();
  });

  it('rejects a receipt whose invoice label was torn off, instead of offering it for correction', async () => {
    const torn = GOOD_RECEIPT_LINES.map((l) => (l === 'INV#00021838' ? 'INV#' : l));
    expect(await rejectCodeOf(() => scan(ALICE, torn))).toBe('INVOICE_MISSING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the date window is decided by the server', () => {
  it('rejects a receipt older than the claim window at CLAIM time', async () => {
    const scanned = await scan(ALICE);
    const elevenDaysLater = NOW + 11 * 86_400_000;
    // Session TTL would also fail here, so assert the session is still what stops it — then a fresh
    // scan of the same old receipt proves the window itself.
    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId, elevenDaysLater))).toBe(
      'SESSION_EXPIRED',
    );

    // A fresh scan of the same old receipt proves the window itself. It is now refused at SCAN
    // time rather than surviving to the claim: with no way to correct a misread date, there is
    // nothing to be gained by carrying an out-of-window receipt further.
    expect(
      await rejectCodeOf(() =>
        handleScanReceipt(callable({ imageBase64: IMAGE }, ALICE), {
          vision: fakeVision([receiptVision()]),
          nowMs: elevenDaysLater,
        }),
      ),
    ).toBe('DATE_EXPIRED');
  });

  it('rejects a future-dated receipt', async () => {
    // Refused at scan time, so no session is ever created for it.
    const earlier = Date.UTC(2026, 6, 20, 4, 0, 0);
    expect(
      await rejectCodeOf(() =>
        handleScanReceipt(callable({ imageBase64: IMAGE }, ALICE), {
          vision: fakeVision([receiptVision()]),
          nowMs: earlier,
        }),
      ),
    ).toBe('DATE_FUTURE');
  });

  it('still refuses a claim whose receipt fell out of the window after scanning', async () => {
    // The server re-derives and re-checks at claim time, so a session held open past the window
    // cannot be cashed in — the scan-time verdict is not trusted.
    const scanned = await scan(ALICE);
    const nineDaysLater = NOW + 9 * 86_400_000;

    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId, nineDaysLater))).toBe(
      'SESSION_EXPIRED',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('Vision failures burn nothing', () => {
  it('reports a clean error when Vision throws, and writes nothing', async () => {
    const vision = throwingVision();
    await expect(
      handleScanReceipt(callable({ imageBase64: IMAGE }, ALICE), { vision, nowMs: NOW }),
    ).rejects.toThrow(/could not read/i);

    expect((await testDb().collection(COLLECTIONS.scanSessions).get()).empty).toBe(true);
    expect((await testDb().collection(COLLECTIONS.receipts).get()).empty).toBe(true);
  });

  it('rejects OCR_NO_TEXT when Vision finds nothing, and writes nothing', async () => {
    const code = await rejectCodeOf(() =>
      handleScanReceipt(callable({ imageBase64: IMAGE }, ALICE), {
        vision: fakeVision([{}]),
        nowMs: NOW,
      }),
    );
    expect(code).toBe('OCR_NO_TEXT');
    expect((await testDb().collection(COLLECTIONS.scanSessions).get()).empty).toBe(true);
  });

  it('rejects an oversized image before calling Vision', async () => {
    const vision = fakeVision([receiptVision()]);
    const huge = 'A'.repeat(6 * 1024 * 1024);
    await expect(
      handleScanReceipt(callable({ imageBase64: huge }, ALICE), { vision, nowMs: NOW }),
    ).rejects.toThrow(/too large/i);
    expect(vision.callCount()).toBe(0);
  });

  it('rejects a missing image before calling Vision', async () => {
    const vision = fakeVision([receiptVision()]);
    await expect(
      handleScanReceipt(callable({}, ALICE), { vision, nowMs: NOW }),
    ).rejects.toThrow(/no image/i);
    expect(vision.callCount()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('merchant accreditation', () => {
  it('an empty merchants collection blocks nothing', async () => {
    const scanned = await scan(ALICE);
    await expect(claim(ALICE, scanned.sessionId)).resolves.toBeTruthy();
  });

  it('rejects a merchant absent from a NON-empty whitelist', async () => {
    await testDb()
      .collection(COLLECTIONS.merchants)
      .doc('99999999999999')
      .set({ name: 'Someone Else', active: true });

    const scanned = await scan(ALICE);
    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId))).toBe(
      'MERCHANT_NOT_ACCREDITED',
    );
  });

  it('accepts a whitelisted merchant', async () => {
    await testDb()
      .collection(COLLECTIONS.merchants)
      .doc('00358391500006')
      .set({ name: 'Harbour City Dimsum House', active: true });

    const scanned = await scan(ALICE);
    await expect(claim(ALICE, scanned.sessionId)).resolves.toBeTruthy();
  });

  it('rejects a whitelisted but INACTIVE merchant', async () => {
    await testDb()
      .collection(COLLECTIONS.merchants)
      .doc('00358391500006')
      .set({ name: 'Harbour City Dimsum House', active: false });

    const scanned = await scan(ALICE);
    expect(await rejectCodeOf(() => claim(ALICE, scanned.sessionId))).toBe(
      'MERCHANT_NOT_ACCREDITED',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the stamp wallet', () => {
  /** Claim n distinct receipts from the same terminal. */
  const claimMany = async (uid: string, invoices: string[]): Promise<void> => {
    for (const invoice of invoices) {
      const lines = GOOD_RECEIPT_LINES.map((l) => (l.startsWith('INV#') ? invoice : l));
      const scanned = await scan(uid, lines);
      await claim(uid, scanned.sessionId);
    }
  };

  it('writes every claimed receipt into the wallet as unspent', async () => {
    const scanned = await scan(ALICE);
    await claim(ALICE, scanned.sessionId);

    const doc = await testDb()
      .collection(COLLECTIONS.receipts)
      .doc('26013009560086199__00021838')
      .get();

    expect(doc.data()!.is_used).toBe(false);
  });

  it('does NOT advance the card on a claim — only the future press does that', async () => {
    // Decision D-1. If claiming also incremented stamp_count, the press would count the same stamp
    // a second time and the wallet balance would stop meaning anything.
    await testDb()
      .collection(COLLECTIONS.stamps)
      .doc('alice-card')
      .set({ owner_ID: ALICE, stamp_count: 3, stamp_total: 10, history: [] });

    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId);

    expect(result.stampCardId).toBe('alice-card');
    expect(result.stampCount).toBe(3); // unchanged
    expect(result.balance).toBe(1); // the stamp went to the wallet

    const card = await testDb().collection(COLLECTIONS.stamps).doc('alice-card').get();
    expect(card.data()!.stamp_count).toBe(3);
    expect(card.data()!.history).toHaveLength(0);
  });

  it('grows the balance by exactly one per claimed receipt', async () => {
    await claimMany(ALICE, ['INV#00021838', 'INV#00022492', 'INV#00023000']);

    const receipts = await testDb()
      .collection(COLLECTIONS.receipts)
      .where('owner_ID', '==', ALICE)
      .where('is_used', '==', false)
      .get();

    expect(receipts.size).toBe(3);
  });

  it('counts only UNSPENT receipts, so a spent stamp leaves the balance', async () => {
    await claimMany(ALICE, ['INV#00021838', 'INV#00022492']);

    // Simulate the future press having spent one.
    await testDb()
      .collection(COLLECTIONS.receipts)
      .doc('26013009560086199__00021838')
      .update({ is_used: true });

    const scanned = await scan(ALICE, GOOD_RECEIPT_LINES.map((l) => (l.startsWith('INV#') ? 'INV#00023000' : l)));
    const result = await claim(ALICE, scanned.sessionId);

    // 3 claimed, 1 spent.
    expect(result.balance).toBe(2);
  });

  it('keeps each user’s wallet separate', async () => {
    await claimMany(ALICE, ['INV#00021838', 'INV#00022492']);

    const scanned = await scan(BOB, GOOD_RECEIPT_LINES.map((l) => (l.startsWith('INV#') ? 'INV#00023000' : l)));
    const result = await claim(BOB, scanned.sessionId);

    expect(result.balance).toBe(1);
  });

  it('creates a card for a user who has none, left empty for the press to fill', async () => {
    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId);

    const card = await testDb().collection(COLLECTIONS.stamps).doc(result.stampCardId).get();
    expect(card.data()).toMatchObject({ owner_ID: ALICE, stamp_count: 0, stamp_total: 10 });
  });

  it('reuses the existing card rather than creating a second one', async () => {
    await testDb()
      .collection(COLLECTIONS.stamps)
      .doc('alice-card')
      .set({ owner_ID: ALICE, stamp_count: 3, stamp_total: 10, history: [] });

    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId);

    expect(result.stampCardId).toBe('alice-card');
    expect((await testDb().collection(COLLECTIONS.stamps).get()).size).toBe(1);
  });

  it('never touches another user’s card', async () => {
    await testDb()
      .collection(COLLECTIONS.stamps)
      .doc('bob-card')
      .set({ owner_ID: BOB, stamp_count: 5, stamp_total: 10, history: [] });

    const scanned = await scan(ALICE);
    const result = await claim(ALICE, scanned.sessionId);

    expect(result.stampCardId).not.toBe('bob-card');
    const bob = await testDb().collection(COLLECTIONS.stamps).doc('bob-card').get();
    expect(bob.data()!.stamp_count).toBe(5);
  });
});
