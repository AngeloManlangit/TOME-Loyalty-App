/**
 * One-time backfill: give every pre-existing receipt an `is_used` field.
 *
 * Why this is needed rather than optional: Firestore's `where('is_used','==',false)` does NOT match
 * documents that lack the field. Any receipt claimed before the wallet shipped would therefore be
 * invisible to the balance query — the user would silently lose stamps they had already earned.
 *
 * Idempotent: receipts that already carry the field are skipped, so re-running is harmless. Safe to
 * run against production before deploying the wallet, since a receipt with is_used: false is exactly
 * what the new code would have written.
 *
 *   npx tsx scripts/backfillIsUsed.ts            # report only, writes nothing
 *   npx tsx scripts/backfillIsUsed.ts --apply    # perform the writes
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../src/config';

/** Firestore caps a batch at 500 operations. */
const BATCH_SIZE = 400;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  if (getApps().length === 0) initializeApp();
  const db = getFirestore();

  const snapshot = await db.collection(COLLECTIONS.receipts).get();

  const missing = snapshot.docs.filter((doc) => doc.get('is_used') === undefined);

  console.log('');
  console.log(`receipts total:            ${snapshot.size}`);
  console.log(`already have is_used:      ${snapshot.size - missing.length}`);
  console.log(`missing is_used:           ${missing.length}`);
  console.log('');

  if (missing.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to perform the backfill.');
    return;
  }

  let written = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of missing.slice(i, i + BATCH_SIZE)) {
      // `update`, not `set`: a receipt that vanished between the read and here should fail loudly
      // rather than be silently recreated with only this one field.
      batch.update(doc.ref, { is_used: false });
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, missing.length - i);
    console.log(`  ${written}/${missing.length}`);
  }

  console.log('');
  console.log(`Backfilled ${written} receipt(s) with is_used: false.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
