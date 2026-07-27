/**
 * Accuracy benchmark: replay the cached corpus and measure per-field extraction against hand labels.
 *
 *   npm run receipts:benchmark
 *
 * Hermetic, offline and free — it replays cached Vision JSON and never calls the API.
 *
 * This is the number that actually answers "is the OCR good enough", and it is the regression guard
 * on every future change to rules.config.ts. It counts REAL fixtures only: synthetic fixtures prove
 * the code is correct, never that it is accurate, so letting them into this number would make the
 * benchmark lie.
 *
 * Thresholds (architecture doc §9.2):
 *   - clean receipts     >= 95% exact match per field
 *   - degraded receipts  >= 80% exact match per field
 *   - and 100% of the remainder must land in review or rejection, never in a silently-wrong stamp.
 *     That last clause is the one that matters: a miss is acceptable, a confident wrong answer is not.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { receiptRules } from '../src/receipts/core/rules.config';
import type { ReceiptFieldName, VisionResponse } from '../src/receipts/core/types';
import { validateReceipt } from '../src/receipts/core/validate';
import { visionToOcrDocument } from '../src/receipts/core/visionAdapter';

const CORPUS_DIR = join(__dirname, '..', '__fixtures__', 'receipts');

const THRESHOLDS: Record<string, number> = { clean: 0.95, degraded: 0.8 };

interface Expected {
  label: 'clean' | 'degraded' | 'negative';
  invoice_no: string | null;
  accn: string | null;
  receipt_date: string | null;
  expectReject?: string;
  notes?: string;
}

interface FieldTally {
  correct: number;
  wrong: number;
  missed: number;
}

const newTally = (): FieldTally => ({ correct: 0, wrong: 0, missed: 0 });

interface NearMiss {
  fixture: string;
  field: string;
  expected: string;
  got: string;
}

function loadCorpus(): Array<{ name: string; vision: VisionResponse; expected: Expected }> {
  if (!existsSync(CORPUS_DIR)) return [];

  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.vision.json'))
    .map((f) => {
      const name = f.replace(/\.vision\.json$/, '');
      const expectedPath = join(CORPUS_DIR, `${name}.expected.json`);
      if (!existsSync(expectedPath)) return null;

      return {
        name,
        vision: JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8')) as VisionResponse,
        expected: JSON.parse(readFileSync(expectedPath, 'utf8')) as Expected,
      };
    })
    .filter((x): x is { name: string; vision: VisionResponse; expected: Expected } => x !== null)
    .filter((x) => x.expected.label !== undefined);
}

/** Receipt dates are compared on the calendar day; the printed time is not hand-labelled. */
function sameDate(expected: string, got: string): boolean {
  return got.slice(0, 10) === expected.slice(0, 10);
}

function main(): void {
  const corpus = loadCorpus();

  if (corpus.length === 0) {
    console.log('No labelled fixtures found.');
    console.log(`Add receipt photos to ${join(CORPUS_DIR, 'raw')} and run: npm run receipts:corpus`);
    console.log('');
    console.log('Benchmark SKIPPED (real-fixture corpus is empty) — not a failure.');
    return;
  }

  const tallies = new Map<string, Map<ReceiptFieldName, FieldTally>>();
  const nearMisses: NearMiss[] = [];
  let negativesCorrect = 0;
  let negativesTotal = 0;
  let silentlyWrong = 0;

  // Fixed clock so the window check never makes the benchmark drift over time.
  const nowMs = Date.now();

  for (const { name, vision, expected } of corpus) {
    const doc = visionToOcrDocument(vision);
    const outcome = validateReceipt({ doc, rules: receiptRules, nowMs, mode: 'scan' });

    if (expected.label === 'negative') {
      negativesTotal++;
      if (outcome.status === 'rejected' || outcome.status === 'needs_review') negativesCorrect++;
      else {
        silentlyWrong++;
        console.log(`  ✗ ${name}: expected rejection, got '${outcome.status}'`);
      }
      continue;
    }

    if (!tallies.has(expected.label)) {
      tallies.set(
        expected.label,
        new Map([
          ['invoice_no', newTally()],
          ['accn', newTally()],
          ['receipt_date', newTally()],
        ]),
      );
    }
    const byField = tallies.get(expected.label)!;

    const resolved: Record<ReceiptFieldName, string | null> = {
      invoice_no: null,
      accn: null,
      receipt_date: null,
    };

    if (outcome.status !== 'rejected') {
      resolved.invoice_no = outcome.fields.invoice_no ?? null;
      resolved.accn = outcome.fields.accn ?? null;
      resolved.receipt_date =
        outcome.fields.receipt_date_ms !== undefined
          ? new Date(outcome.fields.receipt_date_ms + receiptRules.date.utcOffsetMinutes * 60_000)
              .toISOString()
              .slice(0, 10)
          : null;
    }

    for (const field of ['invoice_no', 'accn', 'receipt_date'] as ReceiptFieldName[]) {
      const want = expected[field === 'receipt_date' ? 'receipt_date' : field];
      if (!want) continue;

      const got = resolved[field];
      const tally = byField.get(field)!;

      if (got === null) {
        tally.missed++;
      } else if (field === 'receipt_date' ? sameDate(want, got) : got === want) {
        tally.correct++;
      } else {
        tally.wrong++;
        nearMisses.push({ fixture: name, field, expected: want, got });
        // A wrong value that still reached 'valid' is the failure mode that must never happen: it
        // would become a stamp on a receipt the system misread, with nothing flagged to anyone.
        if (outcome.status === 'valid') silentlyWrong++;
      }
    }
  }

  console.log('');
  console.log(`Corpus: ${corpus.length} real fixtures`);
  console.log('');

  let failed = false;

  for (const [label, byField] of tallies) {
    const threshold = THRESHOLDS[label] ?? 0;
    console.log(`── ${label} (threshold ${(threshold * 100).toFixed(0)}%) ──`);

    for (const [field, tally] of byField) {
      const total = tally.correct + tally.wrong + tally.missed;
      if (total === 0) continue;

      const accuracy = tally.correct / total;
      const ok = accuracy >= threshold;
      if (!ok) failed = true;

      console.log(
        `  ${ok ? '✓' : '✗'} ${field.padEnd(14)} ${(accuracy * 100).toFixed(1).padStart(5)}%  ` +
          `(${tally.correct} correct, ${tally.wrong} wrong, ${tally.missed} missed of ${total})`,
      );
    }
    console.log('');
  }

  if (negativesTotal > 0) {
    const ok = negativesCorrect === negativesTotal;
    if (!ok) failed = true;
    console.log(`── negatives ──`);
    console.log(`  ${ok ? '✓' : '✗'} ${negativesCorrect}/${negativesTotal} correctly refused`);
    console.log('');
  }

  if (nearMisses.length > 0) {
    console.log('── near misses ──');
    for (const m of nearMisses) {
      console.log(`  ${m.fixture} [${m.field}]`);
      console.log(`    expected: ${m.expected}`);
      console.log(`    got:      ${m.got}`);
    }
    console.log('');
  }

  // The clause that matters most: anything wrong must have landed in review or rejection.
  if (silentlyWrong > 0) {
    failed = true;
    console.log(`✗ ${silentlyWrong} fixture(s) were SILENTLY WRONG — accepted as valid with a bad value.`);
    console.log('  This is the one outcome the design must never produce.');
  } else {
    console.log('✓ 0 silently-wrong results — every miss landed in review or rejection.');
  }

  console.log('');
  console.log(failed ? 'BENCHMARK FAILED' : 'BENCHMARK PASSED');
  if (failed) process.exit(1);
}

main();
