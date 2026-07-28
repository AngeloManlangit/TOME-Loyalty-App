import type { ClaimResult, ReceiptError, ScanResult } from '@/assets/classes/receipts';
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



const VALID_SCAN: ScanResult = {
  sessionId: 'session-1',
  fields: {
    invoice_no: '00021838',
    min: '26013009560086199',
    receipt_date_ms: Date.UTC(2026, 6, 21, 16, 0, 0), // 22 Jul 2026 in Manila
  },
  confidence: 0.95,
};

const CLAIM: ClaimResult = {
  receiptId: '26013009560086199__00021838',
  stampCardId: 'card-1',
  balance: 4,
  stampCount: 0,
  stampTotal: 10,
};

function stubService(
  overrides: Partial<{
    scanReceipt: (uri: string) => Promise<ScanResult>;
    claimReceipt: (sessionId: string) => Promise<ClaimResult>;
  }> = {},
) {
  return {
    scanReceipt: overrides.scanReceipt ?? (async () => VALID_SCAN),
    claimReceipt: overrides.claimReceipt ?? (async () => CLAIM),
    prepareImage: async () => 'base64',
    fetchStampBalance: async () => 0,
    fetchReceiptHistory: async () => [],
  } as never;
}

const rejection = (code: ReceiptError['code'], offline = false): ReceiptError => ({
  code,
  message: 'nope',
  offline,
});

describe('useScanner — the state machine', () => {
  it('starts idle', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));
    expect(result.current.state.phase).toBe('idle');
  });

  it('goes idle → processing → confirm on a good scan', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });

    await waitFor(() => expect(result.current.state.phase).toBe('confirm'));
  });

  it('goes confirm → submitting → success on a claim', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('success'));
    if (result.current.state.phase !== 'success') return;
    expect(result.current.state.result.balance).toBe(4);
  });

  it('reports the wallet balance, not the card progress, on success', async () => {
    // A claim fills the wallet; the card is advanced later by the "stamp this card" press.
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('success'));
    if (result.current.state.phase !== 'success') return;
    expect(result.current.state.result.balance).toBe(4);
    expect(result.current.state.result.stampCount).toBe(0);
  });

  it('notifies the caller once a claim succeeds, so the balance can refresh', async () => {
    const onClaimed = jest.fn();
    const { result } = await renderHook(() => useScanner(stubService(), onClaimed));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(onClaimed).toHaveBeenCalledTimes(1));
  });

  it('resets back to idle', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    // Must be an AWAITED async act. A sync act() here leaves React mid-transition and every later
    // test in the file then renders with a null hook result.
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.state.phase).toBe('idle');
  });

  it('ignores submit outside the confirm phase', async () => {
    const claimReceipt = jest.fn(async () => CLAIM);
    const { result } = await renderHook(() => useScanner(stubService({ claimReceipt })));

    await act(async () => {
      await result.current.submit();
    });

    expect(claimReceipt).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('idle');
  });
});

describe('useScanner — values are shown, never edited', () => {
  it('exposes no way to change a scanned value', async () => {
    // The guarantee this whole design rests on. If a setter ever reappears here, the server's
    // "derived entirely from the stored OCR text" property has a hole in it.
    const { result } = await renderHook(() => useScanner(stubService()));
    expect('setField' in result.current).toBe(false);
    expect('edits' in result.current).toBe(false);
  });

  it('displays the server’s values verbatim', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });

    expect(result.current.valueOf('invoice_no')).toBe('00021838');
    expect(result.current.valueOf('min')).toBe('26013009560086199');
  });

  it('renders the date on the receipt’s calendar day, not the device’s', async () => {
    // 22 Jul 2026 00:00 Manila is 21 Jul 16:00 UTC. A naive toISOString would show the 21st.
    const { result } = await renderHook(() => useScanner(stubService()));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });

    expect(result.current.valueOf('receipt_date')).toBe('2026-07-22');
  });

  it('shows nothing before a scan has happened', async () => {
    const { result } = await renderHook(() => useScanner(stubService()));
    expect(result.current.valueOf('invoice_no')).toBe('');
  });

  it('sends only the session id when claiming', async () => {
    const claimReceipt = jest.fn(async () => CLAIM);
    const { result } = await renderHook(() => useScanner(stubService({ claimReceipt })));

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(claimReceipt).toHaveBeenCalledWith('session-1');
  });
});

describe('useScanner — failures', () => {
  it('surfaces a scan rejection with its code', async () => {
    const { result } = await renderHook(() =>
      useScanner(
        stubService({
          scanReceipt: async () => {
            throw rejection('LOW_CONFIDENCE');
          },
        }),
      ),
    );

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });

    await waitFor(() => expect(result.current.state.phase).toBe('rejected'));
    if (result.current.state.phase !== 'rejected') return;
    expect(result.current.state.error.code).toBe('LOW_CONFIDENCE');
  });

  it.each(['LOW_CONFIDENCE', 'AMBIGUOUS_FIELD', 'IMAGE_UNCLEAR', 'NOT_A_RECEIPT'] as const)(
    'routes %s to the rejected screen, which asks for a retake',
    async (code) => {
      const { result } = await renderHook(() =>
        useScanner(
          stubService({
            scanReceipt: async () => {
              throw rejection(code);
            },
          }),
        ),
      );

      await act(async () => {
        await result.current.capture('file:///photo.jpg');
      });

      await waitFor(() => expect(result.current.state.phase).toBe('rejected'));
      if (result.current.state.phase !== 'rejected') return;
      expect(result.current.state.error.code).toBe(code);
    },
  );

  it('routes an offline scan to the offline screen, not a rejection', async () => {
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
      await result.current.capture('file:///photo.jpg');
    });

    await waitFor(() => expect(result.current.state.phase).toBe('offline'));
  });

  it('surfaces a duplicate claim distinctly', async () => {
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
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('rejected'));
    if (result.current.state.phase !== 'rejected') return;
    expect(result.current.state.error.code).toBe('INVOICE_DUPLICATE');
  });

  it('goes offline rather than rejecting when the claim cannot reach the server', async () => {
    // Nothing was claimed and the session is still valid, so the receipt is not burned.
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
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('offline'));
  });

  it('does not report a claim as successful when it failed', async () => {
    const onClaimed = jest.fn();
    const { result } = await renderHook(() =>
      useScanner(
        stubService({
          claimReceipt: async () => {
            throw rejection('SESSION_EXPIRED');
          },
        }),
        onClaimed,
      ),
    );

    await act(async () => {
      await result.current.capture('file:///photo.jpg');
    });
    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('rejected'));
    expect(onClaimed).not.toHaveBeenCalled();
  });
});
