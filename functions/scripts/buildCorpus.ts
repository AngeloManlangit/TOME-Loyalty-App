/**
 * Corpus builder: OCR every raw receipt photo ONCE and cache the raw Vision JSON.
 *
 *   npm run receipts:corpus
 *
 * Caching the response is what makes every downstream test hermetic, offline and free — no test ever
 * calls Vision. It also means the fixtures exercise the true response shape, geometry and confidence
 * values, which hand-written strings cannot.
 *
 * Already-processed images are skipped, so re-running after adding one photo costs exactly one Vision
 * unit. Pass --force to re-OCR everything.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { createVisionClient } from '../src/receipts/vision/client';

const RAW_DIR = join(__dirname, '..', '__fixtures__', 'receipts', 'raw');
const OUT_DIR = join(__dirname, '..', '__fixtures__', 'receipts');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface ExpectedStub {
  label: 'clean' | 'degraded' | 'negative';
  invoice_no: string | null;
  accn: string | null;
  receipt_date: string | null;
  expectReject?: string;
  notes: string;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
  }

  const images = readdirSync(RAW_DIR).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()));

  if (images.length === 0) {
    console.log(`No images in ${RAW_DIR}`);
    console.log('See the README there for what to collect. Nothing to do.');
    return;
  }

  const client = createVisionClient();
  let ocrCalls = 0;
  let skipped = 0;

  for (const file of images) {
    const name = basename(file, extname(file));
    const visionPath = join(OUT_DIR, `${name}.vision.json`);
    const expectedPath = join(OUT_DIR, `${name}.expected.json`);

    if (existsSync(visionPath) && !force) {
      skipped++;
      continue;
    }

    process.stdout.write(`OCR ${file} ... `);
    const imageBase64 = readFileSync(join(RAW_DIR, file)).toString('base64');

    try {
      const response = await client.documentTextDetection(imageBase64);
      writeFileSync(visionPath, `${JSON.stringify(response, null, 2)}\n`);
      ocrCalls++;

      const lineCount = response.fullTextAnnotation?.text?.split('\n').length ?? 0;
      console.log(`ok (${lineCount} lines)`);
    } catch (error) {
      console.log('FAILED');
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    // Only ever created, never overwritten — hand labels are precious.
    if (!existsSync(expectedPath)) {
      const stub: ExpectedStub = {
        label: 'clean',
        invoice_no: null,
        accn: null,
        receipt_date: null,
        notes: 'TODO: fill in what the receipt actually says, then set label to clean/degraded/negative',
      };
      writeFileSync(expectedPath, `${JSON.stringify(stub, null, 2)}\n`);
    }
  }

  console.log('');
  console.log(`Vision calls: ${ocrCalls}   skipped (already cached): ${skipped}`);
  if (ocrCalls > 0) {
    console.log(`Now hand-label the *.expected.json files in ${OUT_DIR}, then:`);
    console.log('  npm run receipts:benchmark');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
