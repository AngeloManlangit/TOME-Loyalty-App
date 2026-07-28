import type {
  ClaimResult,
  ReceiptError,
  ScanResult,
} from '@/assets/classes/receipts';
import { act, renderHook, waitFor } from '@testing-library/react-native';

// NOTE: @testing-library/react-native 14 made `renderHook` ASYNC — it returns a Promise, where v13
// returned the result directly. React 19's concurrent rendering requires an async act, and forgetting
// the await fails with a confusing "cannot read properties of undefined (reading 'current')".

// The hook imports receiptService only to default its parameter, and that module pulls in the
// Firebase web SDK, which ships ESM that Jest cannot parse. Every test injects its own stub, so the
// real module is never needed — mocking it keeps the entire Firebase chain out of the test runtime.
jest.mock('@src/services/receiptService', () => ({ receiptService: {} }));

// eslint-disable-next-line import/first
import { useScanner } from '../useScanner';



const CANDIDATES: ScanResult['candidates'] = {
  invoice_no: [
    { value: '00021838', raw: '00021838', score: 1, confidence: 0.95, source: 'inline', lineIndex: 3 },
    { value: '00021B38', raw: '00021B38', score: 0.25, confidence: 0.4, source: 'pattern-scan', lineIndex: 9 },
  ],
  min: [
    { value: '26013009560086199', raw: '26013009560086199', score: 1, confidence: 0.95, source: 'inline', lineIndex: 2 },
  ],
  accn: [],
  tin: [],
  receipt_date: [
    { value: '2026-07-22', raw: 'JUL 22 2026', score: 0.25, confidence: 0.9, source: 'pattern-scan', lineIndex: 4 },
  ],
};

const VALID_SCAN: ScanResult = {
  sessionId: 'session-1',
  status: 'valid',
  fields: {
    invoice_no: '00021838',
    min: '26013009560086199',
    receipt_date_ms: Date.UTC(2026, 6, 21, 16, 0, 0), // 22 Jul 2026 in Manila
  },
  candidates: CANDIDATES,
  confidence: 0.95,
  softRejects: [],
};

const CLAIM: ClaimResult = {
  receiptId: '26013009560086199__00021838',
  stampCardId: 'card-1',
  stampCount: 4,
  stampTotal: 10,
  rewardReached: false,
};

function stubService(overrides: Partial<{
  scanReceipt: (uri: string) => Promise<ScanResult>;
  claimReceipt: (sessionId: string, corrections?: unknown) => Promise<ClaimResult>;
}> = {}) {
  return {
    scanReceipt: overrides.scanReceipt ?? (async () => VALID_SCAN),
    claimReceipt: overrides.claimReceipt ?? (async () => CLAIM),
    prepareImage: async () => 'base64',
    fetchReceiptHistory: async () => [],
  } as never;
}

const rejection = (code: ReceiptError['code'], offline = false): ReceiptError => ({
  code,
  message: 'nope',
  offline,
});

describe('useScanner', () => {
  it('starts idle', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));
    expect(result.current.state.phase).toBe('idle');
  });

  it('goes idle -> processing -> review on a successful scan', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file://photo.jpg');
    });

    expect(result.current.state.phase).toBe('review');
  });

  it('reaches success after claiming', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file://photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('success'));
    if (result.current.state.phase !== 'success') return;
    expect(result.current.state.result.stampCount).toBe(4);
  });

  describe('field values', () => {
    it('shows what the server proposed', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));
      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.valueOf('invoice_no')).toBe('00021838');
      expect(result.current.valueOf('min')).toBe('26013009560086199');
    });

    it('formats the date back to the receipt calendar day, not the device timezone', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));
      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      // The instant is 21 Jul 16:00 UTC, which is 22 Jul in Manila. Showing 21 Jul would contradict
      // the paper the user is holding.
      expect(result.current.valueOf('receipt_date')).toBe('2026-07-22');
    });

    it('a user edit wins over the proposal', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));
      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      await act(async () => {
        result.current.setField('invoice_no', '00099999');
      });
      expect(result.current.valueOf('invoice_no')).toBe('00099999');
    });

    it('sends ONLY the fields the user changed', async () => {
      const seen: unknown[] = [];
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            claimReceipt: async (_id, corrections) => {
              seen.push(corrections);
              return CLAIM;
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        result.current.setField('invoice_no', '00099999');
      });
      await act(async () => {
        await result.current.submit();
      });

      // Sending every field would mark every claim as manually corrected and destroy the audit signal.
      expect(seen[0]).toEqual({ invoice_no: '00099999' });
    });

    it('sends no corrections at all when nothing was edited', async () => {
      const seen: unknown[] = [];
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            claimReceipt: async (_id, corrections) => {
              seen.push(corrections);
              return CLAIM;
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        await result.current.submit();
      });

      expect(seen[0]).toBeUndefined();
    });
  });

  describe('flagging', () => {
    it('flags a field named by a soft reject', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => ({
              ...VALID_SCAN,
              status: 'needs_review',
              softRejects: ['INVOICE_MALFORMED'],
            }),
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.isFlagged('invoice_no')).toBe(true);
      expect(result.current.isFlagged('min')).toBe(false);
    });

    it('flags a field with nothing proposed at all', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => ({
              ...VALID_SCAN,
              status: 'needs_review',
              fields: { min: '26013009560086199' },
              candidates: { ...CANDIDATES, invoice_no: [] },
              softRejects: [],
            }),
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.isFlagged('invoice_no')).toBe(true);
    });
  });

  describe('failures', () => {
    it('shows the offline screen when a scan cannot reach the server', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => {
              throw rejection(null, true);
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.state.phase).toBe('offline');
    });

    it('shows the rejection screen with the code for a refused scan', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => {
              throw rejection('NOT_A_RECEIPT');
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.state.phase).toBe('rejected');
      if (result.current.state.phase !== 'rejected') return;
      expect(result.current.state.error.code).toBe('NOT_A_RECEIPT');
    });

    it('surfaces a duplicate claim as a rejection', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            claimReceipt: async () => {
              throw rejection('INVOICE_DUPLICATE');
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.state.phase).toBe('rejected');
      if (result.current.state.phase !== 'rejected') return;
      expect(result.current.state.error.code).toBe('INVOICE_DUPLICATE');
    });

    it('handles a session expiring while the user sits on the review screen', async () => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            claimReceipt: async () => {
              throw rejection('SESSION_EXPIRED');
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.state.phase).toBe('rejected');
      if (result.current.state.phase !== 'rejected') return;
      expect(result.current.state.error.code).toBe('SESSION_EXPIRED');
    });

    it('goes offline rather than rejecting when the network drops mid-claim', async () => {
      // Nothing was claimed, so the receipt is not burned — the user retries, not re-photographs.
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            claimReceipt: async () => {
              throw rejection(null, true);
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.state.phase).toBe('offline');
    });

    it('a client-side failure is NOT reported as offline', async () => {
      // A broken native module, or any bug in our own code, must look like a bug. Reporting it as
      // "No connection" sends the user to check their wifi over something that is our fault.
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => {
              throw rejection(null, false);
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });

      expect(result.current.state.phase).toBe('rejected');
      if (result.current.state.phase !== 'rejected') return;
      expect(result.current.state.error.message).toBe('nope');
    });

    it('submit does nothing outside the review phase', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.state.phase).toBe('idle');
    });
  });

  describe('reset', () => {
    it('returns to idle and clears edits', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        result.current.setField('invoice_no', '00099999');
      });
      await act(async () => {
        result.current.reset();
      });

      expect(result.current.state.phase).toBe('idle');
      expect(result.current.edits).toEqual({});
    });

    it('clears stale edits when a new scan starts', async () => {
      const { result } = await renderHook(() => useScanner(stubService()));

      await act(async () => {
        await result.current.capture('file://photo.jpg');
      });
      await act(async () => {
        result.current.setField('invoice_no', '00099999');
      });
      await act(async () => {
        await result.current.capture('file://photo2.jpg');
      });

      // Carrying an edit from a previous receipt into a new one would claim the wrong number.
      expect(result.current.edits).toEqual({});
      expect(result.current.valueOf('invoice_no')).toBe('00021838');
    });
  });
});
