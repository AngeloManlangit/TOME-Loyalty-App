import React, { createContext, useContext, useRef, useState } from 'react';

/**
 * Lets the tab-bar FAB act as the camera shutter.
 *
 * The button lives in the tab bar, which is rendered by the layout ABOVE the scanner screen, so it
 * has no way to reach the camera on its own. The screen registers its capture function here on
 * mount and the button calls it — the only route between the two.
 */

/** What the FAB is currently for, which decides both its appearance and what pressing it does. */
export type ShutterMode =
    /** Not on the scanner. Pressing navigates there. */
    | 'navigate'
    /** Camera is live. Pressing takes the photo. */
    | 'ready'
    /** A capture or upload is in flight. Pressing does nothing. */
    | 'busy'
    /** Confirming, or showing a result. The on-screen buttons are the actions now. */
    | 'inactive';

interface ScannerUiValue {
    mode: ShutterMode;
    setMode: (mode: ShutterMode) => void;
    /** Called by the scanner screen on mount. Pass null on unmount to avoid a stale handler. */
    registerShutter: (fn: (() => void) | null) => void;
    /** Fired by the tab-bar button. A no-op when nothing is registered. */
    fireShutter: () => void;
}

const ScannerUiContext = createContext<ScannerUiValue>({
    mode: 'navigate',
    setMode: () => {},
    registerShutter: () => {},
    fireShutter: () => {},
});

export const ScannerUiProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<ShutterMode>('navigate');
    // A ref, not state: replacing the handler must not re-render the whole tab tree, and the button
    // only ever reads it at press time.
    const shutter = useRef<(() => void) | null>(null);

    return (
        <ScannerUiContext.Provider
            value={{
                mode,
                setMode,
                registerShutter: (fn) => {
                    shutter.current = fn;
                },
                fireShutter: () => {
                    // Guarded rather than assumed: the button exists on every tab, and a press that
                    // lands between unmounting the scanner and updating the mode must do nothing.
                    if (mode === 'ready') shutter.current?.();
                },
            }}
        >
            {children}
        </ScannerUiContext.Provider>
    );
};

export const useScannerUi = () => useContext(ScannerUiContext);
