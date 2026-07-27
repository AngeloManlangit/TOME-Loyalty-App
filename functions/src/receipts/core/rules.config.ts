/**
 * Receipt formats, label aliases and windows as DATA, not code.
 *
 * Design decision: a new merchant receipt format should be a config entry, not a refactor — and
 * because parsing runs server-side (D3), changing anything here ships by deploying a function, with no
 * app-store round trip.
 *
 * ⚠️ THE PATTERNS BELOW ARE PLACEHOLDERS pending real receipt samples (open question Q-B).
 * They are deliberately PERMISSIVE. That is the safe direction to be wrong in: an over-permissive
 * pattern lets a malformed value reach the review screen where a human sees it, and the server still
 * enforces uniqueness, the date window and accreditation regardless. An over-strict pattern would
 * reject valid receipts outright, which is the failure users actually notice.
 *
 * Tighten these in Phase D.3 once fixtures exist.
 */

export interface FieldRule {
  /** Label texts to search for. Matched with bounded edit distance, so OCR may mangle them. */
  readonly labels: readonly string[];
  /** A normalized candidate must match this to be accepted. */
  readonly pattern: RegExp;
  /**
   * Enables OCR digit-confusion repair (O->0, I->1, S->5, ...) on candidates for THIS field only.
   * Never enable it for a field that can contain real letters — see normalize.ts.
   */
  readonly numericOnly: boolean;
}

export interface DateRule {
  readonly labels: readonly string[];
  /**
   * How to read an ambiguous numeric date like 07/08/2026. Only consulted when neither component
   * exceeds 12; a value above 12 identifies the day on its own.
   */
  readonly localeOrder: 'MDY' | 'DMY';
  /**
   * Fixed offset of the receipt's wall-clock timezone, in minutes east of UTC.
   *
   * Asia/Manila is UTC+08:00 and has observed no DST since 1978, so a constant is not an
   * approximation here — it is exact, and it keeps the core free of any timezone database.
   */
  readonly utcOffsetMinutes: number;
}

export interface ReceiptRules {
  readonly invoice: FieldRule;
  readonly accn: FieldRule;
  readonly date: DateRule;
  readonly window: {
    /** How old a receipt may be and still be claimable. */
    readonly maxAgeDays: number;
    /** Allowance for clock skew only — not a grace period for genuinely future receipts. */
    readonly futureToleranceSeconds: number;
  };
  readonly limits: {
    readonly scansPerUserPerDay: number;
  };
  readonly accreditation: {
    /** Safe to leave on with an empty merchants/ collection — see merchantRepo. */
    readonly enforceWhitelist: boolean;
  };
  readonly review: {
    /** Below this OCR confidence a field is flagged for the user to confirm. */
    readonly minFieldConfidence: number;
  };
}

export const receiptRules: ReceiptRules = {
  invoice: {
    labels: [
      'INVOICE NO',
      'INVOICE NUMBER',
      'INVOICE',
      'INV NO',
      'INV',
      'SI NO',
      'SALES INVOICE',
      'OR NO',
      'OFFICIAL RECEIPT',
      'TRANS NO',
      'TRANSACTION NO',
      'RECEIPT NO',
      'REF NO',
    ],
    // TBD from Q-B samples: letter prefixes? fixed width? per-tenant schemes?
    pattern: /^[A-Z0-9][A-Z0-9-]{2,19}$/,
    numericOnly: false,
  },

  accn: {
    labels: [
      'ACCN',
      'ACC NO',
      'ACKNOWLEDGEMENT CERTIFICATE',
      'ACKNOWLEDGMENT CERTIFICATE',
      'ACK CERT',
      'ACKNOWLEDGEMENT CERT NO',
    ],
    // TBD from Q-B samples: is this BIR's Acknowledgement Certificate Control Number?
    // Fixed length? Dash-grouped? Does the grouping vary by merchant?
    pattern: /^[0-9][0-9-]{7,31}$/,
    numericOnly: true,
  },

  date: {
    labels: ['DATE', 'TRANSACTION DATE', 'TRANS DATE', 'DATE TIME', 'ISSUED ON'],
    localeOrder: 'MDY', // PH point-of-sale is predominantly MM/DD/YYYY
    utcOffsetMinutes: 480,
  },

  window: {
    maxAgeDays: 7, // decision Q-E
    futureToleranceSeconds: 300,
  },

  limits: {
    scansPerUserPerDay: 20, // decision Q-E
  },

  accreditation: {
    enforceWhitelist: true, // decision Q-E — wired on, blocks nothing while merchants/ is empty
  },

  review: {
    minFieldConfidence: 0.75,
  },
};
