/**
 * Receipt formats, label aliases and windows as DATA, not code.
 *
 * A new merchant receipt format should be a config entry, not a refactor — and because parsing runs
 * server-side (D3), changing anything here ships by deploying a function, with no app-store round trip.
 *
 * Patterns below are derived from the real fixture corpus in __fixtures__/receipts/, not guessed.
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
  /**
   * Whether a value found with NO nearby label may be accepted outright.
   *
   * This is a judgement about how discriminating the field's pattern is. A 17-digit MIN or a 22-digit
   * ACCN can only plausibly be that field, so finding one anywhere on the receipt is strong evidence.
   * An invoice number matching "4-20 alphanumerics" is not — half the words on a receipt match it, so
   * accepting an unlabelled one would let a receipt with a torn invoice label silently claim a random
   * word as its number.
   *
   * When false, unlabelled matches are still returned as review candidates; they just cannot become
   * the answer on their own.
   */
  readonly allowUnlabelled: boolean;
  /**
   * Break ties toward the value printed EARLIEST on the receipt.
   *
   * Needed for TIN. A receipt carries two of them: the merchant's near the top, and the POS vendor's
   * in the support footer. Both carry a "VAT REG TIN" label, so they tie on every other signal, and
   * without this the footer's can win and the accreditation lookup checks the wrong business.
   */
  readonly preferEarliest?: boolean;
}

export interface DateRule {
  readonly labels: readonly string[];
  /**
   * How to read an ambiguous numeric date like 07/08/2026. Only consulted when neither component
   * exceeds 12; a value above 12 identifies the day on its own.
   */
  readonly localeOrder: 'MDY' | 'DMY';
  /**
   * Dates are accepted without a label. The corpus receipts print "Jul 22 2026 (Wed)" on its own
   * line with no DATE: prefix at all, and a token that parses as a real calendar date is already a
   * far stronger signal than any regex the other fields use.
   */
  readonly allowUnlabelled: boolean;
  /**
   * Fixed offset of the receipt's wall-clock timezone, in minutes east of UTC.
   *
   * Asia/Manila is UTC+08:00 and has observed no DST since 1978, so a constant is not an
   * approximation here — it is exact, and it keeps the core free of any timezone database.
   */
  readonly utcOffsetMinutes: number;
}

export interface ReceiptRules {
  /** Sequential number the terminal printed. Second half of the uniqueness key. */
  readonly invoice: FieldRule;
  /**
   * BIR Machine Identification Number — one per POS terminal. FIRST HALF OF THE UNIQUENESS KEY.
   *
   * This replaced ACCN after the fixture corpus showed ACCN cannot do the job; see `accn` below.
   */
  readonly min: FieldRule;
  /**
   * BIR Acknowledgement Certificate Control Number.
   *
   * ⚠️ This does NOT identify the merchant. In the corpus, Harbour City Dimsum House and Cozy Hour
   * Cafe — unrelated businesses — both print `ACCN#: 0810107191682022121668`, because the ACCN belongs
   * to CodeLikeUs Technologies Inc., the ZenPOS software vendor whose footer appears on both receipts.
   * Keying uniqueness on it would have produced false duplicates the moment two merchants' independent
   * invoice counters overlapped, which is inevitable — both use 8-digit per-terminal sequences.
   *
   * It is kept as a corroborating check: evidence the receipt came from an accredited POS system.
   */
  readonly accn: FieldRule;
  /** VAT registration TIN — identifies the BUSINESS. Used for the accreditation whitelist. */
  readonly tin: FieldRule;
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
    /**
     * Require a well-formed ACCN to be present.
     *
     * ⚠️ Turning this on rejects receipts whose ACCN did not survive OCR. It is printed in small text
     * in the vendor footer, which is the first thing lost to a fold, a crop or a faded edge — the
     * Robinsons fixture is exactly that case. Measure with the benchmark before enabling in production.
     */
    readonly requireAccn: boolean;
    /**
     * ACCNs of accredited POS vendors. Empty means "any well-formed ACCN passes", so this can be
     * enabled safely before the list is known.
     */
    readonly allowedVendorAccns: readonly string[];
  };
  readonly review: {
    /** Below this OCR confidence a field is flagged for the user to confirm. */
    readonly minFieldConfidence: number;
  };
}

export const receiptRules: ReceiptRules = {
  invoice: {
    // Corpus: `INV#00021838` (ZenPOS, 8 digits, label glued to value) and `SI No: 0000074565`
    // (Robinsons, 10 digits, spaced label).
    labels: [
      // ZenPOS prints "INV#00021838"; Robinsons prints "SI No: 0000074565". "SI" also covers the
      // "S.I.#" styling, since matching is on alphanumeric-only forms.
      'INV',
      'INV NO',
      'INVOICE NO',
      'INVOICE NUMBER',
      'SI',
      'SI NO',
    ],
    // DELIBERATELY NARROW. Everything below was removed because it anchors on things that are not
    // invoice numbers, and a receipt is full of labelled numbers:
    //
    //   'INVOICE'                    the document TITLE. "SALES INVOICE" appears on every receipt,
    //                                and anchoring on it takes whatever text follows the heading.
    //   'OR NO' / 'RECEIPT NO'       official-receipt numbering, a different document
    //   'TRANS NO' / 'TRANSACTION NO' the corpus prints "TM#0027" and "Order # 7" — terminal and
    //                                order numbers, both 4 digits, both indistinguishable from an
    //                                invoice number once anchored
    //   'REF NO'                     payment reference, not the invoice
    //
    // Adding one back needs a fixture showing a merchant that actually labels its invoice that way.
    // DIGITS ONLY. Every invoice number in the corpus is numeric — 00021838 and 00022492 (ZenPOS,
    // 8 digits) and 0000074565 (Robinsons, 10). The earlier placeholder allowed letters, and on a
    // blurry capture it accepted the word "SERVES" out of "THIS SERVES AS AN OFFICIAL SALES INVOICE"
    // as an invoice number. A word is never an invoice number; requiring digits rejects that whole
    // class of misread outright.
    //
    // If a merchant ever turns up using an alphanumeric scheme, this is a one-line config change —
    // but it should be made against a fixture that proves it, not in anticipation.
    pattern: /^[0-9]{4,20}$/,
    // Safe to repair digit confusions now that the field cannot legitimately contain letters:
    // a misread "0OO12126" becomes "00012126", while "SERVES" becomes "5ERVE5" and is rejected.
    numericOnly: true,
    // Still not trustworthy without a label — a receipt is full of numbers.
    allowUnlabelled: false,
  },

  min: {
    // Corpus: 26013009560086199, 25090417305924929, 25043019200674062 — 17 digits throughout.
    // Range kept slightly wider than observed, since one POS vendor is not the whole market.
    labels: ['MIN', 'MIN NO', 'MACHINE ID', 'MACHINE IDENTIFICATION NUMBER'],
    pattern: /^[0-9]{14,22}$/,
    numericOnly: true,
    allowUnlabelled: true,
  },

  accn: {
    // Corpus: 0810107191682022121668 — 22 digits.
    labels: [
      'ACCN',
      'ACCN NO',
      'ACKNOWLEDGEMENT CERTIFICATE',
      'ACKNOWLEDGMENT CERTIFICATE',
      'ACK CERT',
    ],
    pattern: /^[0-9]{18,26}$/,
    numericOnly: true,
    allowUnlabelled: true,
  },

  tin: {
    // Corpus: 003-583-915-00006, 666-910-241-000, 000-405-340-066.
    // Trailing branch-code group is 3-5 digits and sometimes absent.
    labels: ['VAT REG TIN', 'NON VAT REG TIN', 'VAT REG TIN NO', 'TIN'],
    pattern: /^[0-9]{3}-[0-9]{3}-[0-9]{3}(-[0-9]{3,5})?$/,
    numericOnly: false,
    allowUnlabelled: true,
    // The merchant prints its TIN at the top; the POS vendor's appears in the footer.
    preferEarliest: true,
  },

  date: {
    // Corpus: `Jul 22 2026 (Wed)`, with the time sometimes on a separate line (`12:16PM`).
    // 'ISSUED ON' is deliberately absent: on these receipts it labels the POS permit's issue date
    // (February 02, 2026), not the sale. Treating it as an anchor gave it a perfect score and got a
    // valid receipt rejected as DATE_EXPIRED.
    labels: ['DATE', 'TRANSACTION DATE', 'TRANS DATE', 'DATE TIME'],
    localeOrder: 'MDY', // PH point-of-sale is predominantly MM/DD/YYYY
    allowUnlabelled: true,
    utcOffsetMinutes: 480,
  },

  window: {
    maxAgeDays: 7,
    futureToleranceSeconds: 300,
  },

  limits: {
    scansPerUserPerDay: 20,
  },

  accreditation: {
    enforceWhitelist: true, // wired on; blocks nothing while merchants/ is empty
    requireAccn: false, // see the warning above — measure with the benchmark first
    allowedVendorAccns: [], // empty = any well-formed ACCN passes
  },

  review: {
    minFieldConfidence: 0.75,
  },
};
