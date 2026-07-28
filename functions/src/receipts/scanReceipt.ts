import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { activeRules, MAX_IMAGE_BYTES, MAX_OCR_WORDS, RUNTIME_OPTS } from '../config';
import { checkRateLimit } from './data/rateLimitRepo';
import { createSession } from './data/sessionRepo';
import { rejectionError, requireAuth } from './errors';
import { validateReceipt } from './core/validate';
import { visionToOcrDocument } from './core/visionAdapter';
import type { ReceiptFields } from './core/types';
import type { VisionClient } from './vision/client';
import { createVisionClient } from './vision/client';



/**
 * A confident, complete read. There is no partial variant: scanned values are not editable, so a
 * field the OCR could not read confidently has no path to becoming correct and the scan is rejected
 * with a code telling the user what to fix about the photo.
 */
export interface ScanResponse {
  sessionId: string;
  fields: ReceiptFields;
  confidence: number;
}

/** Exported for tests: the handler without the onCall wrapper, Vision client injected. */
export async function handleScanReceipt(
  request: Pick<CallableRequest<{ imageBase64?: unknown }>, 'auth' | 'data'>,
  deps: { vision: VisionClient; nowMs: number },
): Promise<ScanResponse> {
  const uid = requireAuth(request.auth);
  const rules = activeRules();

  const imageBase64 = request.data?.imageBase64;
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    throw new HttpsError('invalid-argument', 'No image was supplied.');
  }

  // Rough decoded size (3 bytes per 4 chars), checked before Vision so an oversized upload is free.
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'That image is too large. Try again.');
  }

  const rate = await checkRateLimit(
    uid,
    rules.limits.scansPerUserPerDay,
    deps.nowMs,
    rules.date.utcOffsetMinutes,
  );
  if (!rate.allowed) throw rejectionError('RATE_LIMITED');

  let visionResponse;
  try {
    visionResponse = await deps.vision.documentTextDetection(imageBase64);
  } catch {
    // Infrastructure problem, not the user's. Nothing was written, so the receipt is not burned.
    throw new HttpsError('unavailable', 'We could not read the receipt just now. Please try again.');
  }

  const doc = visionToOcrDocument(visionResponse);
  if (doc.words.length > MAX_OCR_WORDS) {
    throw new HttpsError('invalid-argument', 'That image contains too much text to be a receipt.');
  }

  const outcome = validateReceipt({ doc, rules, nowMs: deps.nowMs });
  if (outcome.status !== 'valid') throw rejectionError(outcome.reject);

  const sessionId = await createSession({
    ownerId: uid,
    ocrText: doc.text,
    candidates: outcome.candidates,
    nowMs: deps.nowMs,
  });

  return {
    sessionId,
    fields: outcome.fields,
    confidence: outcome.confidence,
  };
}

export const scanReceipt = onCall(RUNTIME_OPTS, (request) =>
  handleScanReceipt(request, { vision: createVisionClient(), nowMs: Date.now() }),
);
