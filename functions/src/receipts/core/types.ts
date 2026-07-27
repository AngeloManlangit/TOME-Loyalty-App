/**
 * Core types. PURE — no Firebase, no SDK imports (design decision D3, enforced by eslint.config.js).
 *
 * The Vision* interfaces below are a deliberate hand-written structural mirror of the subset of
 * Google Cloud Vision's DOCUMENT_TEXT_DETECTION response that we consume. They are NOT imported from
 * @google-cloud/vision, for two reasons:
 *
 *   1. It keeps core dependency-free, so the whole parser runs in a plain Node test with no SDK.
 *   2. The real protobuf-generated response type has every field optional and nullable. Mirroring that
 *      faithfully means the adapter is forced to handle missing geometry and missing confidence, which
 *      is exactly what real degraded receipts produce.
 *
 * The real SDK response is structurally assignable to VisionResponse.
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
 * What every downstream extractor consumes. Nothing below this point knows Vision exists —
 * swapping OCR provider means rewriting visionAdapter.ts and nothing else.
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

/** Where a candidate came from. Recorded because it is the single most useful debugging signal. */
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

export type ReceiptFieldName = 'invoice_no' | 'accn' | 'receipt_date';

export interface FieldCandidates {
  invoice_no: FieldCandidate[];
  accn: FieldCandidate[];
  receipt_date: FieldCandidate[];
}

// --- Reject codes ---------------------------------------------------------------------------------

/**
 * Every rejection carries one of these. No bare booleans anywhere in the validation path — that is
 * what makes the test suite assertable and the UI copy specific.
 */
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
  // criterion 3 — ACCN
  | 'ACCN_MISSING'
  | 'ACCN_MALFORMED'
  | 'ACCN_NOT_ACCREDITED'
  // OCR / input
  | 'OCR_NO_TEXT'
  | 'NOT_A_RECEIPT'
  // flow / abuse
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'CORRECTION_NOT_IN_OCR'
  // key safety
  | 'RECEIPT_KEY_INVALID';

// --- Validation outcome ---------------------------------------------------------------------------

export interface ReceiptFields {
  invoice_no: string;
  accn: string;
  /** Milliseconds since epoch for the receipt's local wall-clock instant, resolved in Asia/Manila. */
  receipt_date_ms: number;
}

/**
 * `scan` never hard-rejects on a field problem — a misread is the user's to fix on the review screen.
 * `claim` is the authority and rejects anything not fully valid.
 *
 * This split is why a faded receipt lands in review rather than in a false rejection, while a genuinely
 * expired one still cannot be claimed.
 */
export type ValidationMode = 'scan' | 'claim';

export type ValidationOutcome =
  | {
      status: 'valid';
      fields: ReceiptFields;
      /** The {accn}__{invoice_no} uniqueness key. Firestore-safe by construction. */
      key: string;
      candidates: FieldCandidates;
      confidence: number;
    }
  | {
      status: 'needs_review';
      /** Whatever could be resolved. Missing entries are what the user must supply. */
      fields: Partial<ReceiptFields>;
      candidates: FieldCandidates;
      /** Why review is needed. Drives the per-field flags in the UI. */
      softRejects: RejectCode[];
      confidence: number;
    }
  | {
      status: 'rejected';
      reject: RejectCode;
      candidates: FieldCandidates;
      confidence: number;
    };
