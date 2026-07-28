import type {
    ClaimResult,
    ReceiptError,
    ReceiptFieldName,
    ScanResult,
} from "@/assets/classes/receipts";
import { receiptService } from "@src/services/receiptService";
import { useState } from "react";



/**
 * The three fields shown on the confirmation screen.
 *
 * READ-ONLY. There is deliberately no setter anywhere in this hook: the user confirms what the OCR
 * read or retakes the photo, and cannot edit a value. Anything the server was not confident about
 * never reaches this screen — it comes back as a reject code and becomes a retake.
 */
export const CONFIRMED_FIELDS: readonly ReceiptFieldName[] = ['invoice_no', 'min', 'receipt_date'];

export const FIELD_LABELS: Record<ReceiptFieldName, string> = {
    invoice_no: 'Invoice number',
    min: 'Machine number (MIN)',
    receipt_date: 'Date',
    accn: 'ACCN',
    tin: 'TIN',
};

export type ScannerPhase =
    | { phase: 'idle' }
    | { phase: 'processing' }
    | { phase: 'confirm'; scan: ScanResult }
    | { phase: 'submitting'; scan: ScanResult }
    | { phase: 'success'; result: ClaimResult }
    | { phase: 'rejected'; error: ReceiptError }
    | { phase: 'offline' };

export interface ScannerApi {
    state: ScannerPhase;
    /** The value to display for a field. Never editable. */
    valueOf: (field: ReceiptFieldName) => string;
    capture: (imageUri: string) => Promise<void>;
    submit: () => Promise<void>;
    reset: () => void;
}

/** Format the server's epoch-ms date for display. */
function formatDate(ms: number): string {
    // The server resolved this in Asia/Manila; shift back before slicing so the calendar day matches
    // what is printed on the receipt rather than the device's timezone.
    return new Date(ms + 480 * 60_000).toISOString().slice(0, 10);
}

export function useScanner(
    service: typeof receiptService = receiptService,
    onClaimed?: () => void,
): ScannerApi {
    const [state, setState] = useState<ScannerPhase>({ phase: 'idle' });

    const scan = state.phase === 'confirm' || state.phase === 'submitting' ? state.scan : null;

    return {
        state,

        valueOf: (field) => {
            if (!scan) return '';
            if (field === 'receipt_date') return formatDate(scan.fields.receipt_date_ms);
            return scan.fields[field as 'invoice_no' | 'min' | 'accn' | 'tin'] ?? '';
        },

        async capture(imageUri) {
            setState({ phase: 'processing' });

            try {
                const result = await service.scanReceipt(imageUri);
                setState({ phase: 'confirm', scan: result });
            } catch (error) {
                const receiptError = error as ReceiptError;
                setState(receiptError.offline ? { phase: 'offline' } : { phase: 'rejected', error: receiptError });
            }
        },

        async submit() {
            if (state.phase !== 'confirm') return;
            const current = state.scan;
            setState({ phase: 'submitting', scan: current });

            try {
                // A session id is the only thing sent. There is nothing else the client could send:
                // the server re-derives every field from the OCR text it stored at scan time.
                const result = await service.claimReceipt(current.sessionId);
                setState({ phase: 'success', result });
                // Let the wallet balance refresh before the user navigates back to it.
                onClaimed?.();
            } catch (error) {
                const receiptError = error as ReceiptError;
                if (receiptError.offline) {
                    // Nothing was claimed and the session is still good, so the receipt is not burned.
                    setState({ phase: 'offline' });
                    return;
                }
                setState({ phase: 'rejected', error: receiptError });
            }
        },

        reset() {
            setState({ phase: 'idle' });
        },
    };
}
