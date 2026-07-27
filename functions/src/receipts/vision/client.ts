import type { VisionResponse } from '../core/types';

/**
 * The Vision boundary, behind an injectable interface.
 *
 * Everything downstream depends on THIS type, never on @google-cloud/vision. That is what lets the
 * entire test suite — including the adversarial cases in Phase E — run with a fake that records how
 * many times it was called, offline, for free. "Rate limit exceeded makes no Vision call" is only
 * assertable because of this seam.
 */
export interface VisionClient {
  /** Run DOCUMENT_TEXT_DETECTION over a base64-encoded image. */
  documentTextDetection(imageBase64: string): Promise<VisionResponse>;
}

/**
 * The real client. Lazily constructed so that merely importing this module does not try to resolve
 * Google credentials — which matters in tests and at cold start.
 *
 * Uses DOCUMENT_TEXT_DETECTION rather than TEXT_DETECTION: the former is Google's dense-text/document
 * path and the documented choice for receipts, while the latter is tuned for sparse text in scene
 * photos (design decision D1).
 */
export function createVisionClient(): VisionClient {
  // Required lazily and typed loosely at the boundary; the response is validated structurally by the
  // adapter, which is the only thing that reads its shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = null;

  return {
    async documentTextDetection(imageBase64: string): Promise<VisionResponse> {
      if (!client) {
        const vision = await import('@google-cloud/vision');
        client = new vision.ImageAnnotatorClient();
      }

      const [result] = await client.documentTextDetection({
        image: { content: Buffer.from(imageBase64, 'base64') },
      });

      return result as VisionResponse;
    },
  };
}

/** A fake for tests: returns queued responses and records call count. */
export function createFakeVisionClient(responses: VisionResponse[] = []): VisionClient & {
  callCount: () => number;
} {
  const queue = [...responses];
  let calls = 0;

  return {
    async documentTextDetection(): Promise<VisionResponse> {
      calls++;
      return queue.shift() ?? {};
    },
    callCount: () => calls,
  };
}
