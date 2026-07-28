/**
 * Core types. PURE — no Firebase, no SDK imports (design decision D3, enforced by eslint.config.js).
 *
 * The Vision* interfaces hand-mirror the subset of DOCUMENT_TEXT_DETECTION we consume rather than
 * importing @google-cloud/vision: it keeps core dependency-free, and copying the protobuf types'
 * all-optional/nullable shape forces the adapter to handle the missing geometry and confidence that
 * degraded receipts actually produce. The real SDK response is structurally assignable to
 * VisionResponse.
 */

// --- Vision wire shape (structural mirror) --------------------------------------------------------

export interface VisionVertex {
  x?: number | null;
  y?: number | null;
}

export interface VisionBoundingPoly {
  vertices?: VisionVertex[] | null;
}

/** Vision's break types. We only care whether a break ends a line. */
export type VisionBreakType =
  | 'UNKNOWN'
  | 'SPACE'
  | 'SURE_SPACE'
  | 'EOL_SURE_SPACE'
  | 'HYPHEN'
  | 'LINE_BREAK';

export interface VisionTextProperty {
  detectedBreak?: { type?: VisionBreakType | number | null } | null;
}

export interface VisionSymbol {
  text?: string | null;
  confidence?: number | null;
  boundingBox?: VisionBoundingPoly | null;
  property?: VisionTextProperty | null;
}

export interface VisionWord {
  symbols?: VisionSymbol[] | null;
  confidence?: number | null;
  boundingBox?: VisionBoundingPoly | null;
  property?: VisionTextProperty | null;
}

export interface VisionParagraph {
  words?: VisionWord[] | null;
  confidence?: number | null;
  boundingBox?: VisionBoundingPoly | null;
}

export interface VisionBlock {
  paragraphs?: VisionParagraph[] | null;
  confidence?: number | null;
  boundingBox?: VisionBoundingPoly | null;
}

export interface VisionPage {
  blocks?: VisionBlock[] | null;
  width?: number | null;
  height?: number | null;
  confidence?: number | null;
}

export interface VisionFullTextAnnotation {
  text?: string | null;
  pages?: VisionPage[] | null;
}

export interface VisionResponse {
  fullTextAnnotation?: VisionFullTextAnnotation | null;
}

// --- Engine-agnostic OCR document -----------------------------------------------------------------

/** Axis-aligned bounding box. x grows right, y grows down (Vision's convention). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  box: Box;
  /** 0..1. Vision omits this on some words; the adapter substitutes 0 rather than guessing high. */
  confidence: number;
}

export interface OcrLine {
  /** Words joined by a single space, in left-to-right order. */
  text: string;
  box: Box;
  /** Mean of the line's word confidences. */
  confidence: number;
  words: OcrWord[];
  /** Position in reading order, top to bottom. Stable across a document. */
  index: number;
}

/**
 * What every downstream extractor consumes. Nothing past here knows Vision exists, so swapping OCR
 * provider means rewriting visionAdapter.ts and nothing else.
 */
export interface OcrDocument {
  lines: OcrLine[];
  words: OcrWord[];
  /** Lines joined by newline. This is what claimReceipt checks corrections against. */
  text: string;
  /** Mean word confidence across the document. 0 when there are no words. */
  meanConfidence: number;
}

// --- Extraction results ---------------------------------------------------------------------------

/** Where a candidate came from. The most useful debugging signal there is. */
export type CandidateSource = 'inline' | 'below' | 'pattern-scan';

export interface FieldCandidate {
  /** Normalized value — what gets stored and compared. */
  value: string;
  /** Exactly as OCR read it, before normalization. Shown in the UI so corrections make sense. */
  raw: string;
  /** 0..1 positional plausibility, from the source. Not an OCR confidence. */
  score: number;
  /** 0..1 OCR confidence of the underlying words. */
  confidence: number;
  source: CandidateSource;
  /** Index of the line the value was taken from. */
  lineIndex: number;
}

export type ReceiptFieldName = 'invoice_no' | 'min' | 'accn' | 'tin' | 'receipt_date';

export interface FieldCandidates {
  invoice_no: FieldCandidate[];
  min: FieldCandidate[];
  accn: FieldCandidate[];
  tin: FieldCandidate[];
  receipt_date: FieldCandidate[];
}

// --- Reject codes ---------------------------------------------------------------------------------

/** Every rejection carries one of these — no bare booleans in the validation path. */
export type RejectCode =
  // criterion 1 — invoice
  | 'INVOICE_MISSING'
  | 'INVOICE_MALFORMED'
  | 'INVOICE_DUPLICATE'
  // criterion 2 — date
  | 'DATE_MISSING'
  | 'DATE_UNPARSEABLE'
  | 'DATE_FUTURE'
  | 'DATE_EXPIRED'
  // criterion 3 — MIN, the terminal identity and first half of the uniqueness key
  | 'MIN_MISSING'
  | 'MIN_MALFORMED'
  // corroboration and accreditation
  | 'ACCN_MISSING'
  | 'ACCN_MALFORMED'
  | 'ACCN_NOT_ACCREDITED'
  | 'MERCHANT_NOT_ACCREDITED'
  // OCR / input
  | 'OCR_NO_TEXT'
  | 'NOT_A_RECEIPT'
  // the OCR was not sure enough to answer — the user retakes the photo
  | 'LOW_CONFIDENCE'
  | 'AMBIGUOUS_FIELD'
  | 'IMAGE_UNCLEAR'
  // flow / abuse
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  // key safety
  | 'RECEIPT_KEY_INVALID';

// --- Validation outcome ---------------------------------------------------------------------------

export interface ReceiptFields {
  invoice_no: string;
  /** BIR Machine Identification Number. First half of the uniqueness key. */
  min: string;
  /** Milliseconds since epoch for the receipt's local wall-clock instant, resolved in Asia/Manila. */
  receipt_date_ms: number;
  /** POS vendor's Acknowledgement Certificate Control Number. Corroborating evidence, not identity. */
  accn?: string;
  /** Business VAT registration TIN, for the accreditation whitelist. */
  tin?: string;
}

/**
 * Validation has no modes.
 *
 * There used to be a `scan` mode that proposed partial results for the user to fix and a strict
 * `claim` mode that decided. Scanned values are not editable now, so a partial read is of no use to
 * anyone: both calls run the same strict rules, and `claimReceipt` re-deriving the same answer from
 * the stored OCR text is what makes the server the authority.
 */
export type ValidationOutcome =
  | {
      status: 'valid';
      fields: ReceiptFields;
      /** The {min}__{invoice_no} uniqueness key. Firestore-safe by construction. */
      key: string;
      candidates: FieldCandidates;
      confidence: number;
    }
  | {
      status: 'rejected';
      reject: RejectCode;
      candidates: FieldCandidates;
      confidence: number;
    };
