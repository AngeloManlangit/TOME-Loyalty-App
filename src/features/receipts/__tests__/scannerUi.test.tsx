import { act, render, renderHook, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ScannerUiProvider, useScannerUi } from '../scannerUiContext';

/**
 * The FAB/shutter contract.
 *
 * The button lives in the tab bar and the camera lives in the screen below it, so this context is
 * the only thing connecting them. If it breaks, the shutter silently stops taking photos — pressing
 * it just looks like nothing happened, which is exactly the kind of failure a test should catch.
 */

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ScannerUiProvider>{children}</ScannerUiProvider>
);

describe('scanner UI context — the shutter wiring', () => {
    it('starts in navigate mode, so the FAB opens the scanner', async () => {
        const { result } = await renderHook(() => useScannerUi(), { wrapper });
        expect(result.current.mode).toBe('navigate');
    });

    it('fires the registered handler when ready', async () => {
        const capture = jest.fn();
        const { result } = await renderHook(() => useScannerUi(), { wrapper });

        await act(async () => {
            result.current.registerShutter(capture);
            result.current.setMode('ready');
        });
        await act(async () => {
            result.current.fireShutter();
        });

        expect(capture).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire while busy, so a double tap cannot double-capture', async () => {
        const capture = jest.fn();
        const { result } = await renderHook(() => useScannerUi(), { wrapper });

        await act(async () => {
            result.current.registerShutter(capture);
            result.current.setMode('busy');
        });
        await act(async () => {
            result.current.fireShutter();
        });

        expect(capture).not.toHaveBeenCalled();
    });

    it('does NOT fire on the confirmation or result screens', async () => {
        const capture = jest.fn();
        const { result } = await renderHook(() => useScannerUi(), { wrapper });

        await act(async () => {
            result.current.registerShutter(capture);
            result.current.setMode('inactive');
        });
        await act(async () => {
            result.current.fireShutter();
        });

        expect(capture).not.toHaveBeenCalled();
    });

    it('does nothing when no handler is registered', async () => {
        const { result } = await renderHook(() => useScannerUi(), { wrapper });

        await act(async () => {
            result.current.setMode('ready');
        });

        // The button exists on every tab; a press with no camera mounted must not throw.
        expect(() => result.current.fireShutter()).not.toThrow();
    });

    it('drops a stale handler when the camera unregisters', async () => {
        const capture = jest.fn();
        const { result } = await renderHook(() => useScannerUi(), { wrapper });

        await act(async () => {
            result.current.registerShutter(capture);
            result.current.setMode('ready');
        });
        await act(async () => {
            result.current.registerShutter(null);
        });
        await act(async () => {
            result.current.fireShutter();
        });

        expect(capture).not.toHaveBeenCalled();
    });
});

describe('scanner UI context — consumers see mode changes', () => {
    function ModeProbe() {
        const { mode } = useScannerUi();
        return <Text>{`mode:${mode}`}</Text>;
    }

    function Controls() {
        const { setMode } = useScannerUi();
        return <Text onPress={() => setMode('ready')}>go-ready</Text>;
    }

    it('re-renders the FAB when the mode changes', async () => {
        const user = userEvent.setup();
        // Async, like renderHook, in @testing-library/react-native 14.
        await render(
            <ScannerUiProvider>
                <ModeProbe />
                <Controls />
            </ScannerUiProvider>,
        );

        expect(screen.getByText('mode:navigate')).toBeTruthy();

        await user.press(screen.getByText('go-ready'));

        expect(screen.getByText('mode:ready')).toBeTruthy();
    });
});
