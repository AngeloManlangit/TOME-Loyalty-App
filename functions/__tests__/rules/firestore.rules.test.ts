import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Security rules suite for firestore.rules.
 *
 * The most important tests here are the REGRESSION ones. The project ran with a wide-open ruleset
 * (`allow read, write: if request.auth != null` on `/{document=**}`), so deploying a real ruleset can
 * only break things by being too strict. The app performs exactly two Firestore operations, both
 * reads, and both are asserted below. If those two pass, the deploy is safe for this client.
 *
 * The rest prove the anti-fraud property the OCR feature depends on: a client cannot write stamps,
 * receipts, sessions or rate limits under any circumstances. Cloud Functions use the Admin SDK, which
 * bypasses rules entirely, so denying clients outright costs the feature nothing.
 */

const PROJECT_ID = 'tome-rules-test';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed as admin, bypassing rules — this is how Cloud Functions will write in production.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ALICE), { username: 'alice', email: 'a@example.com' });
    await setDoc(doc(db, 'users', BOB), { username: 'bob', email: 'b@example.com' });

    await setDoc(doc(db, 'stamps', 'alice-card'), { owner_ID: ALICE, stamp_count: 3 });
    await setDoc(doc(db, 'stamps', 'bob-card'), { owner_ID: BOB, stamp_count: 7 });

    await setDoc(doc(db, 'receipts', '116__SI-1'), { owner_ID: ALICE, accn: '116' });
    await setDoc(doc(db, 'scan_sessions', 'sess-1'), { owner_ID: ALICE, ocr_text: 'X' });
    await setDoc(doc(db, 'rate_limits', ALICE), { day_key: 20260728, count: 1 });
    await setDoc(doc(db, 'merchants', '116'), { name: 'Outlets', active: true });
  });
});

const asAlice = () => testEnv.authenticatedContext(ALICE).firestore();
const asBob = () => testEnv.authenticatedContext(BOB).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('REGRESSION — the two operations the live app actually performs', () => {
  it('userService.fetchUserDetails: getDoc(users/{uid}) still works', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'users', ALICE)));
  });

  it('stampService.fetchStamps: query(stamps, where owner_ID == uid) still works', async () => {
    // Firestore only permits a collection query when the rules can be satisfied for every possible
    // result. The where() clause is what makes that provable — remove it and this must fail.
    const q = query(collection(asAlice(), 'stamps'), where('owner_ID', '==', ALICE));
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.docs).toHaveLength(1);
    expect(snap.docs[0]!.id).toBe('alice-card');
  });

  it('an UNFILTERED stamps query is denied, which is why the where() clause matters', async () => {
    await assertFails(getDocs(query(collection(asAlice(), 'stamps'))));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the hole this ruleset closes', () => {
  it('a user can NO LONGER mint themselves stamps', async () => {
    // Under the previous ruleset this succeeded, and was the whole loyalty system's undoing.
    await assertFails(updateDoc(doc(asAlice(), 'stamps', 'alice-card'), { stamp_count: 999 }));
  });

  it('a user cannot tamper with someone else’s stamp card', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'stamps', 'bob-card'), { stamp_count: 0 }));
  });

  it('a user cannot read another user’s profile', async () => {
    await assertFails(getDoc(doc(asAlice(), 'users', BOB)));
  });

  it('a user cannot read another user’s stamp card directly', async () => {
    await assertFails(getDoc(doc(asAlice(), 'stamps', 'bob-card')));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('server-owned collections are read-only to clients', () => {
  const cases: Array<[string, string]> = [
    ['receipts', '116__SI-1'],
    ['scan_sessions', 'sess-1'],
    ['rate_limits', ALICE],
    ['stamps', 'alice-card'],
  ];

  it.each(cases)('%s: owner can read', async (col, id) => {
    await assertSucceeds(getDoc(doc(asAlice(), col, id)));
  });

  it.each(cases)('%s: owner CANNOT write', async (col, id) => {
    await assertFails(setDoc(doc(asAlice(), col, id), { owner_ID: ALICE, tampered: true }));
  });

  it.each(cases)('%s: other user cannot read', async (col, id) => {
    await assertFails(getDoc(doc(asBob(), col, id)));
  });

  it('a client cannot forge a brand-new receipt', async () => {
    await assertFails(
      setDoc(doc(asAlice(), 'receipts', '999__FAKE-1'), { owner_ID: ALICE, accn: '999' }),
    );
  });

  it('a client cannot raise its own rate limit', async () => {
    await assertFails(updateDoc(doc(asAlice(), 'rate_limits', ALICE), { count: 0 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('users', () => {
  it('owner may create and update their own profile', async () => {
    await assertSucceeds(setDoc(doc(asAlice(), 'users', ALICE), { username: 'alice2' }));
  });

  it('a user cannot write another user’s profile', async () => {
    await assertFails(setDoc(doc(asAlice(), 'users', BOB), { username: 'pwned' }));
  });

  it('nobody may delete a profile', async () => {
    await assertFails(deleteDoc(doc(asAlice(), 'users', ALICE)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('merchants — the accreditation whitelist', () => {
  it('any signed-in user may read it', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'merchants', '116')));
  });

  it('no client may write it', async () => {
    await assertFails(setDoc(doc(asAlice(), 'merchants', '999'), { name: 'Fake', active: true }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('unauthenticated access', () => {
  it.each([
    ['users', ALICE],
    ['stamps', 'alice-card'],
    ['receipts', '116__SI-1'],
    ['scan_sessions', 'sess-1'],
    ['rate_limits', ALICE],
    ['merchants', '116'],
  ])('cannot read %s', async (col, id) => {
    await assertFails(getDoc(doc(asAnon(), col, id)));
  });

  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(asAnon(), 'users', ALICE), { username: 'x' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('unknown collections are denied by default', () => {
  it('a collection nobody has thought about yet is not readable or writable', async () => {
    await assertFails(getDoc(doc(asAlice(), 'some_future_collection', 'x')));
    await assertFails(setDoc(doc(asAlice(), 'some_future_collection', 'x'), { a: 1 }));
  });
});
