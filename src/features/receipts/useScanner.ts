import type {
    ClaimResult,
    ReceiptError,
    ReceiptFieldName,
    ScanResult,
} from "@/assets/classes/receipts";
import { receiptService } from "@src/services/receiptService";
import { useState } from "react";



/** The three fields that gate a claim and are therefore correctable in review. */
export const REVIEWABLE_FIELDS: readonly ReceiptFieldName[] = ['invoice_no', 'min', 'receipt_date'];

export const FIELD_LABELS: Record<ReceiptFieldName, string> = {
    invoice_no: 'Invoice number',
    min: 'Machine number (MIN)',
    receipt_date: 'Date',
    accn: 'ACCN',
    tin: 'TIN',
};

export type ScannerPhase =
    | { phase: 'idle' }
    | { phase: 'capturing' }
    | { phase: 'processing' }
    | { phase: 'review'; scan: ScanResult }
    | { phase: 'submitting'; scan: ScanResult }
    | { phase: 'success'; result: ClaimResult }
    | { phase: 'rejected'; error: ReceiptError }
    | { phase: 'offline' };

export interface ScannerApi {
    state: ScannerPhase;
    /** User edits, keyed by field. Empty until they change something. */
    edits: Partial<Record<ReceiptFieldName, string>>;
    /** The value to show for a field: the user's edit if any, else what the server proposed. */
    valueOf: (field: ReceiptFieldName) => string;
    /** True when the server flagged this field as the reason review is needed. */
    isFlagged: (field: ReceiptFieldName) => boolean;
    capture: (imageUri: string) => Promise<void>;
    setField: (field: ReceiptFieldName, value: string) => void;
    submit: () => Promise<void>;
    reset: () => void;
}

/** Reject codes that point at a specific field, so review can flag it. */
const FIELD_OF_REJECT: Partial<Record<string, ReceiptFieldName>> = {
    INVOICE_MISSING: 'invoice_no',
    INVOICE_MALFORMED: 'invoice_no',
    MIN_MISSING: 'min',
    MIN_MALFORMED: 'min',
    DATE_MISSING: 'receipt_date',
    DATE_UNPARSEABLE: 'receipt_date',
    DATE_FUTURE: 'receipt_date',
    DATE_EXPIRED: 'receipt_date',
    ACCN_MISSING: 'accn',
    ACCN_MALFORMED: 'accn',
};

/** Format the server's epoch-ms date back to the YYYY-MM-DD form corrections are submitted in. */
function formatDate(ms: number): string {
    // The server resolved this in Asia/Manila; shift back before slicing so the calendar day matches
    // what is printed on the receipt rather than the device's timezone.
    return new Date(ms + 480 * 60_000).toISOString().slice(0, 10);
}

export function useScanner(service: typeof receiptService = receiptService): ScannerApi {
    const [state, setState] = useState<ScannerPhase>({ phase: 'idle' });
    const [edits, setEdits] = useState<Partial<Record<ReceiptFieldName, string>>>({});

    const scan = state.phase === 'review' || state.phase === 'submitting' ? state.scan : null;

    const proposedValue = (field: ReceiptFieldName): string => {
        if (!scan) return '';

        if (field === 'receipt_date') {
            if (scan.fields.receipt_date_ms !== undefined) return formatDate(scan.fields.receipt_date_ms);
            return scan.candidates.receipt_date[0]?.value ?? '';
        }

        const fromFields = scan.fields[field as 'invoice_no' | 'min' | 'accn' | 'tin'];
        if (typeof fromFields === 'string') return fromFields;

        return scan.candidates[field][0]?.value ?? '';
    };

    return {
        state,
        edits,

        valueOf: (field) => edits[field] ?? proposedValue(field),

        isFlagged: (field) => {
            if (!scan) return false;
            // Explicitly flagged by a reject code...
            if (scan.softRejects.some((code) => FIELD_OF_REJECT[code] === field)) return true;
            // ...or nothing was proposed at all, which the user has to supply.
            return proposedValue(field).length === 0;
        },

        async capture(imageUri) {
            setEdits({});
            setState({ phase: 'processing' });

            try {
                const result = await service.scanReceipt(imageUri);
                setState({ phase: 'review', scan: result });
            } catch (error) {
                const receiptError = error as ReceiptError;
                setState(receiptError.offline ? { phase: 'offline' } : { phase: 'rejected', error: receiptError });
            }
        },

        setField(field, value) {
            setEdits((current) => ({ ...current, [field]: value }));
        },

        async submit() {
            if (state.phase !== 'review') return;
            const current = state.scan;
            setState({ phase: 'submitting', scan: current });

            try {
                // Only send fields the user actually changed. Sending everything would mark every
                // claim as manually corrected and lose the audit signal.
                const corrections = Object.keys(edits).length > 0 ? edits : undefined;
                const result = await service.claimReceipt(current.sessionId, corrections);
                setState({ phase: 'success', result });
            } catch (error) {
                const receiptError = error as ReceiptError;
                if (receiptError.offline) {
                    // Nothing was claimed, so the session is still good — go back to review rather
                    // than making the user re-photograph the receipt.
                    setState({ phase: 'offline' });
                    return;
                }
                setState({ phase: 'rejected', error: receiptError });
            }
        },

        reset() {
            setEdits({});
            setState({ phase: 'idle' });
        },
    };
}
