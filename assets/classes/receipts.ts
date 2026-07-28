

/** Which POS terminal issued the receipt, plus what it said. */
export interface ReceiptFields {
    invoice_no: string;
    /** BIR Machine Identification Number — one per POS terminal. First half of the uniqueness key. */
    min: string;
    /** Milliseconds since epoch, resolved in Asia/Manila. */
    receipt_date_ms: number;
    /** POS vendor's Acknowledgement Certificate Control Number. Corroboration, not identity. */
    accn?: string;
    /** Business VAT registration TIN, used for the accreditation whitelist. */
    tin?: string;
}

export type ReceiptFieldName = 'invoice_no' | 'min' | 'accn' | 'tin' | 'receipt_date';

/** Where a proposed value came from. Useful for support, and shown as a hint in review. */
export type CandidateSource = 'inline' | 'below' | 'pattern-scan';


export interface FieldCandidate {
    value: string;
    /** Exactly as OCR read it, before normalization. */
    raw: string;
    /** 0..1 positional plausibility. Not an OCR confidence. */
    score: number;
    /** 0..1 OCR confidence of the underlying words. */
    confidence: number;
    source: CandidateSource;
    lineIndex: number;
}

export interface FieldCandidates {
    invoice_no: FieldCandidate[];
    min: FieldCandidate[];
    accn: FieldCandidate[];
    tin: FieldCandidate[];
    receipt_date: FieldCandidate[];
}

/** Every rejection carries one of these. The UI switches on the code, never on the message. */
export type RejectCode =
    | 'INVOICE_MISSING' | 'INVOICE_MALFORMED' | 'INVOICE_DUPLICATE'
    | 'DATE_MISSING' | 'DATE_UNPARSEABLE' | 'DATE_FUTURE' | 'DATE_EXPIRED'
    | 'MIN_MISSING' | 'MIN_MALFORMED'
    | 'ACCN_MISSING' | 'ACCN_MALFORMED' | 'ACCN_NOT_ACCREDITED'
    | 'MERCHANT_NOT_ACCREDITED'
    | 'OCR_NO_TEXT' | 'NOT_A_RECEIPT'
    | 'RATE_LIMITED' | 'SESSION_EXPIRED' | 'CORRECTION_NOT_IN_OCR'
    | 'RECEIPT_KEY_INVALID';

/** What `scanReceipt` returns. The session id is what `claimReceipt` needs. */
export interface ScanResult {
    sessionId: string;
    status: 'valid' | 'needs_review';
    fields: Partial<ReceiptFields>;
    candidates: FieldCandidates;
    confidence: number;
    /** Why review is needed. Empty with status 'needs_review' means "fine, but read weakly". */
    softRejects: RejectCode[];
}

/** What `claimReceipt` returns on success. */
export interface ClaimResult {
    receiptId: string;
    stampCardId: string;
    stampCount: number;
    stampTotal: number;
    rewardReached: boolean;
}

/** A claimed receipt, as read back from Firestore for history. */
export interface ReceiptRecord {
    id: string;
    owner_ID: string;
    min: string;
    invoice_no: string;
    receipt_date: Date;
    claimed_at: Date;
    stamp_card_ID: string;
    accn?: string;
    tin?: string;
    ocr_confidence: number;
    was_manually_corrected: boolean;
    corrected_fields?: string[];
}


export interface ReceiptError {
    code: RejectCode | null;
    message: string;
    /** True when the call failed for connectivity reasons rather than being refused. */
    offline: boolean;
}
