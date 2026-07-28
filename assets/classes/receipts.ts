

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
    | 'LOW_CONFIDENCE' | 'AMBIGUOUS_FIELD' | 'IMAGE_UNCLEAR'
    | 'RATE_LIMITED' | 'SESSION_EXPIRED'
    | 'RECEIPT_KEY_INVALID';

/**
 * What `scanReceipt` returns: a confident, complete read of the three fields that gate a claim.
 *
 * There is no partial or "needs review" variant. The values are shown to the user read-only for
 * confirmation, so a field the OCR could not read confidently has no route to becoming correct —
 * the scan is rejected with a code telling the user what to fix about the photo instead.
 */
export interface ScanResult {
    sessionId: string;
    fields: ReceiptFields;
    confidence: number;
}

/** What `claimReceipt` returns on success. */
export interface ClaimResult {
    receiptId: string;
    stampCardId: string;
    /** Unspent stamps the user now holds — the wallet balance, including the one just earned. */
    balance: number;
    /** The card's progress. A claim does not advance it; the future "stamp this card" press does. */
    stampCount: number;
    stampTotal: number;
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
    /** False while the stamp is unspent. The wallet balance counts these. Server-written only. */
    is_used: boolean;
    /** When the stamp was spent onto a card. Absent until the future press flow writes it. */
    used_at?: Date;
}


export interface ReceiptError {
    code: RejectCode | null;
    message: string;
    /** True when the call failed for connectivity reasons rather than being refused. */
    offline: boolean;
}
