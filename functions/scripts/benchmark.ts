

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
  /** Half of the uniqueness key — measured, because a wrong MIN is a wrong receipt identity. */
  min: string | null;
  accn: string | null;
  /** Identifies the business for the accreditation whitelist. */
  tin: string | null;
  receipt_date: string | null;
  expectReject?: string;
  notes?: string;
}

/** Every field the benchmark scores. MIN and TIN were absent and are the two that gate a claim. */
const MEASURED: ReceiptFieldName[] = ['invoice_no', 'min', 'accn', 'tin', 'receipt_date'];

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

/**
 * Noon Manila on the most recent day any fixture was issued, so every fixture sits inside the claim
 * window regardless of when the benchmark runs. Deterministic: the same corpus always scores the
 * same, and a drop is always a real regression.
 */
function corpusClock(corpus: Array<{ expected: Expected }>): number {
  const days = corpus
    .map((c) => c.expected.receipt_date)
    .filter((d): d is string => typeof d === 'string' && d.length >= 10)
    .map((d) => d.slice(0, 10))
    .sort();

  const latest = days[days.length - 1];
  if (latest === undefined) return Date.now();

  const [year, month, day] = latest.split('-').map(Number) as [number, number, number];
  // 12:00 Manila is 04:00 UTC — the offset is fixed, PH has had no DST since 1978.
  return Date.UTC(year, month - 1, day, 12 - receiptRules.date.utcOffsetMinutes / 60, 0, 0);
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

  /**
   * How many good receipts the confidence gates accept versus bounce back for a retake.
   *
   * This is the number to watch when tuning rules.config.confidence. Accuracy alone cannot tell you
   * whether the thresholds are set sensibly: gates strict enough to reject everything score a
   * perfect 0 wrong answers while being useless in a shop.
   */
  const outcomes = new Map<string, { accepted: number; retake: number; retakeCodes: string[] }>();

  // Clock derived from the corpus, NOT Date.now(). With a wall clock, every fixture eventually
  // falls out of the 7-day claim window and the benchmark starts failing on the calendar rather
  // than on a regression — which says nothing about whether extraction still works.
  const nowMs = corpusClock(corpus);

  for (const { name, vision, expected } of corpus) {
    const doc = visionToOcrDocument(vision);
    const outcome = validateReceipt({ doc, rules: receiptRules, nowMs });

    if (expected.label === 'negative') {
      negativesTotal++;
      if (outcome.status === 'rejected') negativesCorrect++;
      else {
        silentlyWrong++;
        console.log(`  ✗ ${name}: expected rejection, got '${outcome.status}'`);
      }
      continue;
    }

    if (!tallies.has(expected.label)) {
      tallies.set(expected.label, new Map(MEASURED.map((f) => [f, newTally()])));
      outcomes.set(expected.label, { accepted: 0, retake: 0, retakeCodes: [] });
    }
    const byField = tallies.get(expected.label)!;
    const split = outcomes.get(expected.label)!;

    if (outcome.status === 'valid') {
      split.accepted++;
    } else {
      split.retake++;
      split.retakeCodes.push(`${name}: ${outcome.reject}`);
    }

    const resolved: Record<ReceiptFieldName, string | null> = {
      invoice_no: null,
      min: null,
      accn: null,
      tin: null,
      receipt_date: null,
    };

    if (outcome.status !== 'rejected') {
      resolved.invoice_no = outcome.fields.invoice_no ?? null;
      resolved.min = outcome.fields.min ?? null;
      resolved.accn = outcome.fields.accn ?? null;
      resolved.tin = outcome.fields.tin ?? null;
      resolved.receipt_date =
        outcome.fields.receipt_date_ms !== undefined
          ? new Date(outcome.fields.receipt_date_ms + receiptRules.date.utcOffsetMinutes * 60_000)
              .toISOString()
              .slice(0, 10)
          : null;
    }

    for (const field of MEASURED) {
      const want = expected[field];
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

  // ── accept / retake split ───────────────────────────────────────────────────────────────────────
  // A good receipt bounced here is a real user asked to take the photo again. Zero wrong stamps is
  // the requirement; this is what it costs.
  console.log('── accept / retake split ──');
  for (const [label, split] of outcomes) {
    const total = split.accepted + split.retake;
    if (total === 0) continue;
    const rate = ((split.accepted / total) * 100).toFixed(1);
    console.log(`  ${label.padEnd(10)} ${split.accepted}/${total} accepted first try (${rate}%)`);
    for (const code of split.retakeCodes) {
      console.log(`      retake → ${code}`);
    }
  }
  console.log('');

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
