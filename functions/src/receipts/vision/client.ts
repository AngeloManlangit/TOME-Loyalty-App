import type { VisionResponse } from '../core/types';


export interface VisionClient {
  /** Run DOCUMENT_TEXT_DETECTION over a base64-encoded image. */
  documentTextDetection(imageBase64: string): Promise<VisionResponse>;
}


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
