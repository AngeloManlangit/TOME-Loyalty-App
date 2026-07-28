# OCR Receipt Validation — Implementation Plan

**Status:** approved architecture, awaiting receipt samples before Phase 2
**Stack:** Google Cloud Vision `DOCUMENT_TEXT_DETECTION` → Firebase callable Cloud Function → Firestore
**Prerequisite:** Firebase Blaze plan ✅ confirmed

---

## 1. What we're building

The scanner tab ([src/app/(tabs)/scanner.tsx](../src/app/(tabs)/scanner.tsx), currently a placeholder)
becomes a receipt scanner. The user photographs a receipt; the app awards a stamp if the receipt is valid
and has never been claimed before.

### Acceptance criteria

A receipt is valid **only if all three** hold:

| # | Criterion | Enforced |
|---|---|---|
| 1 | **Invoice number** — present, well-formed, and never claimed before (globally unique) | Server, transactionally |
| 2 | **Date** — present, parseable, a real calendar date, not in the future, within the claim window | Server, against server clock |
| 3 | **ACCN** — present, well-formed, belonging to an accredited merchant | Server |

---

## 2. On "0 errors" — what is and isn't achievable

Two distinct claims are bundled in "0 errors", and only one of them can be guaranteed:

| Layer | 0-error? | Why |
|---|---|---|
| Validation, uniqueness, stamp award | **Yes** | Deterministic TypeScript, server-side, transaction-enforced. Exhaustively tested (§9). |
| OCR reading text off a photo | **No** | Cloud Vision is probabilistic. Faded thermal paper, glare, creases, and skew will misread characters some percentage of the time. No OCR engine on the market is exempt. |

The design therefore makes OCR errors **safe rather than absent**:

- OCR only **proposes** the three fields; a **review screen** lets the user correct them before submitting.
- The **server** is the sole authority on uniqueness — no client can double-claim, whatever OCR read.
- Every rejection returns a **machine-readable reason code** (§Appendix B), so failures are diagnosable.
- An **accuracy benchmark** (§9.2) measures per-field extraction against a fixture corpus and fails CI
  below an agreed threshold.
- Anything OCR gets wrong lands in **review or rejection**, never in a silently-wrong stamp.

Where "0 errors" *is* achievable — the fraud and award path — the plan tests it exhaustively (§9.3).

---

## 3. Architecture

```
CLIENT                                     SERVER  (asia-southeast1, Node 22)
──────                                     ────────────────────────────────────
camera → downscale → base64
    │
    ├── scanReceipt({ imageBase64 }) ────► 1. auth guard
    │                                      2. rate limit  ← BEFORE Vision, so abuse costs $0
    │                                      3. Cloud Vision DOCUMENT_TEXT_DETECTION
    │                                      4. normalize → extract → validate
    │                                      5. stash scan_sessions/{id}  (OCR text + candidates, TTL 15m)
    │   ◄──── { sessionId, fields, candidates, confidence, softRejects }
    │
    ├── review screen  (user may correct low-confidence fields)
    │
    └── claimReceipt({ sessionId, corrections? }) ──► 1. auth guard
                                                      2. load session (owner + TTL checked)
                                                      3. corrections ⊆ stored OCR text
                                                      4. runTransaction:
                                                           assert receipts/{key} absent
                                                           create receipt
                                                           stamp_count += 1, append history
                                                           bump rate limit
        ◄──── verdict
```

Clients have **zero write access** to `receipts`, `stamps`, `scan_sessions`, and `rate_limits`. The
function writes with Admin SDK privileges, bypassing rules entirely.

---

## 4. Design decisions

### D1 — Cloud Vision `DOCUMENT_TEXT_DETECTION`

Google's dense-text/document OCR path, the documented choice for receipts. (`TEXT_DETECTION` is tuned for
sparse text in scene photos and is the wrong fit.)

The response supplies everything the parser needs:

| Field | Use |
|---|---|
| `fullTextAnnotation.text` | whole receipt as one string |
| `pages → blocks → paragraphs → words → symbols` | structural hierarchy |
| `boundingBox.vertices` (every level) | geometry-aware extraction — "the value *right of* the ACCN label" |
| `confidence` (per block/word/symbol) | drives which fields get flagged for review |

### D2 — Cloud Vision + our own extraction, not Document AI

"Our own parser" means **extraction code written in Phase 2** — not a third-party product. Vision returns
raw text; something must decide which line is the invoice number. That something is §Phase 2.

| Option | Who extracts fields | Cost | Gets ACCN? |
|---|---|---|---|
| **Cloud Vision + Phase 2 code** ✅ chosen | our code | $1.50/1k, first 1k/mo free | ✅ |
| Document AI Expense Parser | Google pretrained model | $10/1k, **no free tier** | ❌ |

Document AI returns labeled receipt entities directly, which sounds strictly better, but it is trained on
generic receipts and has **no concept of ACCN** — a Philippines-BIR-specific field absent from its schema.
It therefore cannot satisfy criterion 3, we would have to hand-write ACCN extraction anyway, and it costs
~6.7× more. Revisit only if Q7 turns into amount-based rewards, where its reliable `total_amount` and line
items would start to earn their keep.

### D3 — Parsing runs server-side, and the core is pure

`functions/src/receipts/core/` imports nothing from `firebase-admin`, `firebase-functions`, or the Vision
client. Vision JSON in, plain result object out. Three consequences, all valuable:

1. **The client cannot forge fields.** Even a fully compromised app can only submit an image.
2. **The parser ships without an app release.** New merchant receipt format → deploy a function, no app
   store round-trip. For regexes that *will* need real-world tuning, this is worth a great deal.
3. **Tests are fast and hermetic.** Plain Node Jest — no emulator, no device, no network.

### D4 — Two-call flow, so manual correction stays safe

Manual correction is necessary (OCR *will* misread) but naively re-opens the forgery hole D3 closed. The
two-call flow keeps both properties:

`scanReceipt` stashes the OCR text server-side in `scan_sessions/{id}` (owner-scoped, 15-minute Firestore
TTL). `claimReceipt` accepts a session ID plus optional corrections, and **validates that every corrected
value appears somewhere in the stored OCR text.**

So a user can fix `1NV0ICE` → `INVOICE`, but cannot invent a receipt that was never photographed.

Cost: one extra Firestore write + read per scan. Rate limiting sits on `scanReceipt` — the call that
actually spends money.

### D5 — Uniqueness key: `{accn}__{invoice_no}`

Keyed on **both** fields, because two different stores can legitimately both issue `INV-0001`. Invoice
number alone would produce false duplicates across merchants.

The doc ID is a **readable composite, not a hash** — support debugging is vastly easier, and the uniqueness
constraint is self-evident from the Firestore console.

### D6 — App Check: a real gap, with a specific bridge to test

Every scan costs money, so abuse is a billing concern rather than just hygiene.

**Finding:** this project uses the Firebase **web** SDK on React Native (see CLAUDE.md), and web-SDK App
Check is reCAPTCHA-based — **browser-only, it does not work here.** Worse, simply adding
`@react-native-firebase/app-check` does not fix it: App Check tokens are attached by the SDK making the
call, so a token obtained via RNFirebase would never ride along on web-SDK callable requests.

**The bridge that should work:** the web SDK's `firebase/app-check` exports `CustomProvider`, which exists
precisely to supply tokens from elsewhere. Construct one whose `getToken()` calls into
`@react-native-firebase/app-check` for a native Play Integrity / DeviceCheck token, and hand it to the web
SDK, which then attaches it to callable requests.

**This is unverified end-to-end**, so it is a **timeboxed ½-day spike in Phase 1**, not an assumption.

**v1 protection regardless of the spike outcome:**

- Function **requires an authenticated user** — no anonymous access.
- **Per-UID daily rate limit**, checked *before* the Vision call, so abuse costs nothing.
- **Hard Vision API quota cap** in the GCP console — a ceiling no bug or attack can exceed.
- **Billing budget alert.**

The last two are configured in Phase 1 **before any Vision-calling code exists.**

### D7 — Network is on the critical path

Cloud OCR cannot work offline. The scanner needs an **explicit offline state**, never a silent failure.

Deliberately **not** building an offline queue for v1: queuing collides with the date window, defers
duplicate feedback to a confusing moment, and its failure mode (a queued receipt silently expiring) is
worse than "you need a signal to scan".

### D8 — No native module for OCR

Cloud OCR means no `expo-mlkit-ocr`, no `expo-build-properties`, no iOS 16.0 deployment target, no
`useFrameworks: static`, no `prebuild --clean` cycle. `expo-camera` ~57.0.3 is already installed with the
Android `CAMERA` permission declared in [app.json](../app.json), so **iOS support comes free**.

The D6 spike, if adopted, reintroduces one native module — the only thing that would change this.

---

## 5. Data model

### `receipts/{accn}__{invoice_no}` — new, server-write only

```ts
{
  owner_ID: string;              // == auth.uid
  accn: string;                  // normalized
  invoice_no: string;            // normalized
  receipt_date: Timestamp;       // parsed from the receipt
  claimed_at: Timestamp;         // server timestamp
  stamp_card_ID: string;
  merchant_ID?: string;
  amount?: number;
  ocr_confidence: number;
  was_manually_corrected: boolean;
  corrected_fields?: string[];   // audit: which fields the user edited
  image_path?: string;           // Storage path, if Q4 = retain
  vision_json_path?: string;     // Storage path, if Q4 = retain
}
```

Create-once. Never updated, never deleted.

### `merchants/{accn}` — new, accreditation whitelist (per Q2)

```ts
{ name: string; brand_id?: number; active: boolean; }
```

Existence of the document *is* the accreditation check. Read-only to clients.

### `scan_sessions/{sessionId}` — new, server-write only, TTL 15 min

```ts
{
  owner_ID: string;
  ocr_text: string;              // the D4 correction check reads this
  candidates: FieldCandidates;
  created_at: Timestamp;
  expires_at: Timestamp;         // Firestore TTL policy configured on this field
}
```

### `rate_limits/{uid}` — new, server-write only

```ts
{ day_key: number;               // YYYYMMDD as int, e.g. 20260727
  count: number;
  updated_at: Timestamp; }
```

### `stamps/{id}` — existing, additive only

`stamp_count` +1; `history` gains `{ receipt_ID, time_stamped }`, matching the existing `StampHistory`
interface at [assets/classes/stamps.ts:8-11](../assets/classes/stamps.ts#L8-L11). **No breaking change.**

### `assets/classes/receipts.ts` — new

Domain interfaces, placed alongside `users.ts` / `stamps.ts` / `maps.ts` per the existing (unusual but
consistent) repo convention.

### Security rules

The repo has **no committed rules today**, so this is also the moment to lock the project down:

| Collection | Read | Write |
|---|---|---|
| `receipts` | owner only | **denied** (server writes bypass rules) |
| `scan_sessions` | owner only | **denied** |
| `rate_limits` | owner only | **denied** |
| `stamps` | owner only | **denied** |
| `users` | owner only | owner only |
| `merchants` | any authenticated | **denied** |

Existing read paths are regression-tested against the emulator **before** deploying (§9.4), so nothing
currently working breaks.

---

## 6. Repository layout

```
functions/                                  # NEW — Cloud Functions package
├── package.json                            # firebase-functions v7, firebase-admin v14, Node 22
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── index.ts                            # exports scanReceipt, claimReceipt
│   ├── config.ts                           # region, limits, window — env-overridable
│   └── receipts/
│       ├── scanReceipt.ts                  # callable #1
│       ├── claimReceipt.ts                 # callable #2
│       ├── errors.ts                        # RejectCode → HttpsError mapping
│       ├── vision/
│       │   ├── client.ts                   # INJECTABLE — tests substitute a fake
│       │   └── types.ts
│       ├── core/                           # PURE — no firebase, no vision, no I/O
│       │   ├── visionAdapter.ts
│       │   ├── normalize.ts
│       │   ├── levenshtein.ts
│       │   ├── anchors.ts
│       │   ├── extractInvoice.ts
│       │   ├── extractAccn.ts
│       │   ├── extractDate.ts
│       │   ├── validate.ts
│       │   ├── rules.config.ts             # formats/aliases/windows as DATA
│       │   └── types.ts
│       └── data/
│           ├── receiptRepo.ts              # the claim + award transaction
│           ├── sessionRepo.ts
│           ├── rateLimitRepo.ts
│           └── merchantRepo.ts
├── __fixtures__/receipts/*.json            # cached Vision JSON + expected fields
└── __tests__/
    ├── core/                               # pure unit tests
    ├── functions/                          # firebase-functions-test + emulator
    └── benchmark.ts                        # accuracy harness

src/
├── features/receipts/
│   ├── types.ts                            # shared with functions/ via path alias
│   └── useScanner.ts                       # the state machine hook
├── services/receiptService.ts              # NEW — matches existing service conventions
├── contexts/stampContext.tsx               # NEW — fixes the stamp refresh gap
├── components/scannerPage/
│   ├── cameraCapture.tsx
│   ├── receiptGuideOverlay.tsx
│   ├── reviewFields.tsx
│   ├── resultSuccess.tsx
│   └── resultRejected.tsx
└── app/(tabs)/scanner.tsx                  # REWRITTEN

assets/classes/receipts.ts                  # NEW — domain interfaces
firebase.json                               # NEW
firestore.rules                             # NEW
storage.rules                               # NEW
firestore.indexes.json                      # NEW
```

---

## 7. Phases

### Phase 0 — Decisions & fixture corpus  🔴 *blocked on Q1*

- [ ] Resolve open questions (§11).
- [ ] Collect **15–30 real receipt photos** spanning the merchant mix, **plus deliberately bad ones**:
      faded, creased, glare, partial, angled, non-receipt, photo-of-a-screen.
- [ ] Run each through Vision **once** via a script; cache the **raw Vision JSON** into
      `functions/__fixtures__/receipts/*.json`.
- [ ] Hand-label expected `{ invoice_no, receipt_date, accn }` per fixture.

**Why this is Phase 0:** the corpus *is* the acceptance criteria. Without it the extraction regexes are
guesswork. Caching the JSON also makes every downstream test hermetic, offline, and free — no Vision calls
in CI. One-time cost fits inside the 1,000-unit free tier.

**Exit:** corpus committed; `rules.config.ts` populated with real formats.

---

### Phase 1 — Backend foundations

- [ ] Enable the Cloud Vision API on the Firebase project.
- [ ] **Set the hard Vision quota cap and billing budget alert — before any calling code exists.**
- [ ] `firebase init functions` → TypeScript, **Node 22**, `firebase-functions` v7, `firebase-admin` v14.
- [ ] Region **`asia-southeast1`** (Singapore — lowest latency for PH users).
- [ ] Vision client behind an **injectable** interface so tests never hit the network.
- [ ] Shared types between the app and `functions/` via path alias.
- [ ] Configure the Firestore **TTL policy** on `scan_sessions.expires_at`.
- [ ] **Timeboxed App Check spike (½ day)** per D6 — does the `CustomProvider` → RNFirebase token bridge
      actually attach to web-SDK callables? Decision point: adopt now, or ship with layered mitigations and
      revisit in Phase 8.

**Exit:** stub `scanReceipt` deployed and reachable from the app via `httpsCallable`; auth guard verified;
quota cap and budget alert live; App Check question answered either way.

---

### Phase 2 — Parsing & validation core  ← **the correctness centrepiece**  🔴 *needs Phase 0*

All files pure TypeScript, lint-enforced to import nothing from `firebase-admin` / `firebase-functions` /
Vision.

| File | Responsibility |
|---|---|
| `visionAdapter.ts` | Vision `fullTextAnnotation` → engine-agnostic `{ lines[], words[], boxes, confidences }`. The **only** file that knows Vision's shape; changing OCR provider touches this alone. |
| `normalize.ts` | Uppercase, collapse whitespace, strip noise, build line array. **Field-scoped** OCR-confusion repair (`O→0`, `I/l→1`, `S→5`, `B→8`, `Z→2`, `G→6`) applied **only** to numeric-only field candidates — a global substitution would corrupt merchant names. |
| `levenshtein.ts` | Bounded edit distance (early-exit), for label matching. |
| `anchors.ts` | Locate label lines by alias list with bounded Levenshtein (≤1 for short labels, ≤2 for long) — Vision mangles labels too, not just values. |
| `extractInvoice.ts` | Candidates from the anchor line (right of label), then the next line, then geometry (nearest box right/below). Returns **ranked candidates with scores**, not one answer. |
| `extractAccn.ts` | Same shape, ACCN-specific format rules. |
| `extractDate.ts` | `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, `MM-DD-YY`, `Jul 27, 2026`, `27-JUL-26`, ± trailing time. `day > 12` disambiguates; otherwise the configured locale order (PH POS is predominantly `MM/DD/YYYY`). Rejects impossible calendar dates (Feb 30, month 13). |
| `validate.ts` | Composes the above; applies date window and format rules; emits the result union. |
| `rules.config.ts` | Formats, aliases, and windows as **data, not code** — a new merchant format is a config entry, not a refactor. |

Label aliases to support (extend from the corpus):

- **Invoice:** `INVOICE NO`, `INVOICE #`, `INV#`, `SI NO`, `SALES INVOICE`, `OR NO`, `OFFICIAL RECEIPT`,
  `TRANS NO`, `RECEIPT NO`
- **ACCN:** `ACCN`, `ACC NO`, `ACKNOWLEDGEMENT CERTIFICATE`, `ACK CERT`
- **Date:** `DATE`, `TRANSACTION DATE`, `TRANS DATE`

Ranked candidates matter: they become the tap-to-pick chips on the review screen, which is how a
low-confidence misread gets fixed in one tap instead of by typing.

**Exit:** **100% branch coverage** on `core/`; whole corpus passes; zero forbidden imports (lint rule).

---

### Phase 3 — The two callables + rules

**`scanReceipt`** — auth guard → rate-limit check (**before** Vision) → decode image → Vision → adapter →
extract → validate → stash session → return `{ sessionId, fields, candidates, confidence, softRejects }`.

**`claimReceipt`** — auth guard → load session (owner + TTL checked) → validate corrections against the
stored OCR text (D4) → one `runTransaction`:

1. assert `receipts/{accn}__{invoice_no}` absent, else `INVOICE_DUPLICATE`
2. create the receipt doc
3. `stamp_count += 1`, append the `history` entry
4. bump the rate-limit counter

Any failure rolls back all of it — a crash mid-flow can neither award a free stamp nor burn a receipt.

- [ ] `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json` (none exist today)
- [ ] Seed `merchants/` from the accredited list (per Q2)

**Exit:** the full adversarial suite (§9.3) and rules suite (§9.4) green. **This is the gate that matters
most.**

---

### Phase 4 — Client service layer

`src/services/receiptService.ts`, matching the existing service conventions exactly — `auth.currentUser`
guard, `null`/`[]` when signed out, `Timestamp → Date`, `... as unknown as T` cast:

```ts
scanReceipt(imageUri: string): Promise<ScanResult>
claimReceipt(sessionId: string, corrections?: Partial<ReceiptFields>): Promise<Verdict>
fetchReceiptHistory(): Promise<ReceiptRecord[]>      // direct Firestore read, owner-scoped
```

Preprocess with `expo-image-manipulator`: downscale to ~1600px on the long edge, JPEG q0.8 → typically
300–700 KB (~400–900 KB as base64, comfortably within callable limits). Cuts upload time and bandwidth with
no measurable accuracy loss at receipt text sizes.

**Exit:** unit-tested against a mocked callable; integration-tested against the emulator.

---

### Phase 5 — Scanner UI

Replaces [src/app/(tabs)/scanner.tsx](../src/app/(tabs)/scanner.tsx). The tabs layout already hides the
header on the `scanner` route ([_layout.tsx:27](../src/app/(tabs)/_layout.tsx#L27) and
[header.tsx:20](../src/components/header.tsx#L20) both compute it), so a full-bleed camera needs **no
layout change**.

Explicit state machine — no ad-hoc booleans:

```
permission → idle → capturing → uploading → processing → review → submitting
                                                → success | rejected | offline | error
```

- `useCameraPermissions()`, plus a denied state with a Settings deep link.
- `CameraView` with `autofocus="on"`, a receipt-shaped guide overlay,
  `takePictureAsync({ quality: 0.8 })`.
- **Review screen** — the three fields, each editable, low-confidence ones flagged, server-supplied
  alternate candidates as tap-to-pick chips.
- **Offline state** (D7) — explicit, with retry.
- Result screens per `RejectCode`, plain-language copy, retry path. **Duplicate gets distinct treatment** —
  it is both the fraud case and the most common honest confusion ("I already scanned this").

Styling per repo convention: `StyleSheet.create` at the bottom of each file, colors and fonts from
[theme.ts](../src/constants/theme.ts), purple accent (`Colors.outlets.purple`) to match the scanner tab.

**Note:** `reactCompiler` is enabled in [app.json](../app.json) — components are auto-memoized, so no
manual `useMemo`/`useCallback`, and no mutation of values during render.

---

### Phase 6 — Stamp integration

- [ ] History entry matching the existing `StampHistory` shape.
- [ ] **Fix the refresh gap.** [stampSection.tsx:16-29](../src/components/homePage/stampSection.tsx#L16-L29)
      fetches on mount only, so a newly-earned stamp will not appear after a scan. Fix with a
      `StampProvider` mirroring [userContext.tsx](../src/contexts/userContext.tsx) — which has the same
      never-refetches limitation already flagged in CLAUDE.md.
- [ ] Success animation on the newly-earned stamp.
- [ ] Reward-milestone handling when `stamp_count` reaches a `stamp_reward_index` entry.

---

### Phase 7 — Testing, hardening, docs

Full matrix per §9, then update [CLAUDE.md](../CLAUDE.md) with: the `functions/` package, the rules files,
the region choice, the receipts service, and the new test/benchmark commands.

---

### Phase 8 — Optional follow-ups

- App Check, if the Phase 1 spike deferred it.
- On-device ML Kit **pre-flight quality gate** — reject obviously-textless photos before spending a Vision
  call. Saves cost and latency; costs one native module.
- Document AI, if amount-based rewards land (Q7).
- Audit script flagging anomalous claim patterns.

---

## 8. Cost model

| Item | Free tier | Beyond |
|---|---|---|
| Cloud Vision `DOCUMENT_TEXT_DETECTION` | 1,000 units/month | $1.50 / 1,000 (to 5M), then $0.60 / 1,000 |
| Cloud Functions invocations | 2M/month | negligible at this scale |
| Firestore | 50k reads / 20k writes per day | negligible |
| Cloud Storage (if Q4 = retain) | 5 GB | negligible |

Worked examples: **5,000 scans/month ≈ $6**. **100,000 scans/month ≈ $148.**

One scan = one Vision unit. The two-call flow does **not** double this — Vision is called only in
`scanReceipt`.

---

## 9. Testing & validation strategy

Setup:

```bash
# app
npx expo install jest-expo jest @types/jest "--" --dev
npx expo install @testing-library/react-native --dev   # react-test-renderer does not support React 19

# functions/ uses plain Jest — server-side TS needs no RN transform
```

Two Jest projects in the app (`node` for pure code, `jest-expo` for components); one in `functions/`.

### 9.1 Unit — parsing core

- Table-driven per extractor: every label alias, every date format, every OCR-confusion variant.
- Fed **real cached Vision JSON**, not hand-written strings — so tests exercise the true response shape,
  including geometry and confidence.
- **Boundary cases:** date exactly at the window edge ±1s; min/max invoice length; ACCN with and without
  separators; leap-year Feb 29.
- **Timezone — a specific trap.** The function runs in **UTC**; receipt dates are wall-clock local. An
  implicit-local-timezone bug would silently shift every receipt date by 8 hours, quietly breaking the
  window check near midnight. Dates are parsed in **Asia/Manila explicitly**, never via
  `new Date(string)`, and tests pin this.
- **Negative cases:** empty OCR output, a menu photo, a business card, a receipt with the invoice line
  torn off.
- **100% branch coverage on `core/`**, enforced by a coverage threshold.

### 9.2 Accuracy benchmark

`npm run receipts:benchmark` replays the cached corpus and prints per-field precision/recall plus a
confusion table of near-misses. Fails below threshold.

**Proposed threshold:** ≥95% exact-match per field on clean receipts, ≥80% on degraded ones, with **100%
of the remainder landing in review or rejection** rather than being silently wrong.

Hermetic, offline, free. This is the number that actually answers "is the OCR good enough", and it is a
regression guard on every future regex tweak.

### 9.3 Function + emulator adversarial suite ← **the anti-fraud proof**

`firebase-functions-test` + Firestore emulator (**requires Java 11+**), Vision client faked:

| Attack / failure case | Must |
|---|---|
| Same receipt claimed twice, same user | 2nd rejected `INVOICE_DUPLICATE` |
| Same receipt claimed twice, different users | 2nd rejected |
| Two concurrent claims of the same receipt | exactly one succeeds, exactly one stamp awarded |
| Unauthenticated call to either function | rejected |
| Rate limit exceeded | rejected `RATE_LIMITED`, **and no Vision call made** |
| Correction not present in the stored OCR text | rejected `CORRECTION_NOT_IN_OCR` |
| Claim using another user's session ID | rejected |
| Claim with an expired session | rejected `SESSION_EXPIRED` |
| Same session replayed twice | 2nd rejected |
| Vision returns no text | rejected `OCR_NO_TEXT`, no writes |
| Vision throws / times out | clean error, no writes, receipt **not burned** |
| Transaction fails after Vision succeeded | no stamp, no receipt doc |
| Future-dated receipt | rejected `DATE_FUTURE` |
| Receipt older than the window | rejected `DATE_EXPIRED` |
| Device clock rolled forward | irrelevant — server uses its own clock |
| ACCN absent from `merchants/` (per Q2) | rejected `ACCN_NOT_ACCREDITED` |
| Claim against another user's stamp card | rejected |
| `stamp_count` / `history` desync | impossible — same transaction; asserted |

### 9.4 Security rules tests

`@firebase/rules-unit-testing`:

- Client writes to `receipts`, `stamps`, `scan_sessions`, `rate_limits` → **all denied**.
- Cross-user reads → denied.
- **Regression:** existing `users` and `stamps` read paths still work. Important — the project has no rules
  deployed today, so this is the suite that proves we don't break the running app.

### 9.5 Component tests

`@testing-library/react-native` over the scanner state machine with a mocked service: permission denied,
offline, each reject code, the correction flow, network failure mid-upload, slow response, and **session
expiring while the user sits on the review screen**.

### 9.6 Manual device matrix

Real device, real paper:

| Axis | Cases |
|---|---|
| Light | good / dim / direct glare / flash on |
| Paper | flat / creased / curled / partially folded |
| Angle | straight-on / 15° / 30° |
| Print | fresh thermal / faded |
| Format | every merchant format in the corpus |

Plus: airplane mode before submit (offline state, receipt not burned); **connection dropped mid-upload**
(not burned); app killed mid-request (no award, not burned); same receipt scanned simultaneously by two
accounts on two phones (**exactly one stamp**).

### 9.7 Pre-merge gate

```bash
npm run lint && npx tsc --noEmit && npm test && npm run receipts:benchmark   # app
cd functions && npm run lint && npx tsc --noEmit && npm test                 # functions
```

All green in both packages, rules + function suites green, device matrix signed off.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Vision cost runaway from abuse | Rate limit checked *before* Vision; hard GCP quota cap; billing budget alert; auth required. All live before any calling code (Phase 1). |
| App Check unavailable on the web SDK on RN | D6 — timeboxed spike with a specific bridge; layered mitigations regardless of outcome. |
| Latency (upload + OCR ≈ 1–3 s) | Downscale before upload; honest progress UI; `asia-southeast1` region. |
| Privacy — images/text leave the device | Receipts are purchase history. Needs a retention policy and privacy-notice wording (Q4). |
| Receipt formats vary more than expected | `rules.config.ts` is data-driven, and D3 means fixes deploy without an app release. |
| UTC vs Asia/Manila date bugs | Explicit timezone handling, pinned by tests (§9.1). Silent 8-hour shifts are the classic failure mode here. |
| `expo-camera` capture quality on low-end devices | Guide overlay + review screen + benchmark corpus including degraded samples. |
| Photo-of-a-photo / screenshot fraud | Uniqueness kills replay. Beyond that needs image forensics or a per-receipt QR — **out of scope**, flagged for a later phase. |
| Deploying rules to a project that currently has none | Regression-test existing reads first (§9.4). |

---

## 11. Open questions

### 🔴 Blocking Phase 2

**Q1 — Receipt samples.** 5–10 real receipts (photos are fine), covering the merchant mix. Specifically:

- **ACCN** — is it BIR's Acknowledgement Certificate Control Number? Fixed length? Dash-grouped? Does the
  format vary by merchant?
- **Invoice number** — letter prefixes? Fixed width? Sequential per store, or sparse? Different schemes per
  tenant?

*The extraction code is only as accurate as the patterns it's written against; this cannot be guessed.*

**Q2 — Date window.** Same-day only? 7 days? 30? And is a future-dated receipt an outright rejection, or a
"check your phone clock" warning?

### 🟡 Needed before Phase 3

**Q3 — ACCN whitelist.** Can you supply the accredited merchant/ACCN list? Recommended: it rejects receipts
from non-participating stores outright. Wired behind a config flag either way, so an empty list blocks
nothing.

**Q4 — Retain the receipt image and/or raw Vision JSON?** Valuable for dispute resolution and for improving
the parser; costs Storage and needs a retention period plus privacy-notice wording.
*Recommendation: Vision JSON 90 days; image only if you want dispute evidence.*

**Q5 — Does a `receipts` collection or any deployed Firestore rules already exist?** Only client code is
visible from here.

**Q6 — Rate limit.** Max scans per user per day? *Suggest 20.* This is a billing control now, not just
hygiene.

### 🟢 Product decisions, defaults available

**Q7 — Always exactly 1 stamp per receipt, or scaled by amount spent with a minimum purchase?** If amount
matters, that's a 4th field to extract and validate — and the case where Document AI starts to pay off.

**Q8 — Expected monthly scan volume?** Sets the quota cap and sharpens the cost estimate.

**Q9 — Which stamp card does a receipt credit** when a user holds several?
[stampSection.tsx:14](../src/components/homePage/stampSection.tsx#L14) currently just takes `stamps[0]`.
Merchant-matched, user-chosen, or single-card for now?

**Q10 — Confirm uniqueness scope** is `accn + invoice_no`, not invoice alone (D5).

### Defaults assumed if unanswered

7-day claim window · future dates rejected · 1 stamp per receipt · Vision JSON retained 90 days, image not
retained · 20 scans/user/day · corrections constrained to appear in the OCR text · global uniqueness on
`accn + invoice_no` · ACCN whitelist wired but empty · single stamp card.

---

## 12. Execution order

Phases 0 and 1 need only Q3–Q6. **Q1 and Q2 block Phase 2's extractors specifically, and nothing
earlier.** So work can begin immediately on:

- `functions/` scaffold, region, runtime
- Vision quota cap + billing budget alert
- corpus tooling (the script that OCRs samples and caches JSON)
- the Vision adapter and the pure-TS core skeleton with its test harness
- the App Check spike (D6)

— while receipt samples are gathered in parallel.

---

## Appendix A — `rules.config.ts` shape

```ts
export const receiptRules = {
  invoice: {
    labels: ['INVOICE NO', 'INVOICE #', 'INV#', 'SI NO', 'SALES INVOICE',
             'OR NO', 'OFFICIAL RECEIPT', 'TRANS NO', 'RECEIPT NO'],
    pattern: /^[A-Z0-9-]{4,20}$/,        // ← TBD from Q1 samples
    numericOnly: false,                   // ← TBD; enables digit-confusion repair
  },
  accn: {
    labels: ['ACCN', 'ACC NO', 'ACKNOWLEDGEMENT CERTIFICATE', 'ACK CERT'],
    pattern: /^[0-9-]{10,32}$/,           // ← TBD from Q1 samples
    numericOnly: true,
  },
  date: {
    labels: ['DATE', 'TRANSACTION DATE', 'TRANS DATE'],
    localeOrder: 'MDY',                   // PH POS default; DMY disambiguated when day > 12
    timezone: 'Asia/Manila',
  },
  window: {
    maxAgeDays: 7,                        // Q2
    futureToleranceSeconds: 300,          // clock skew only
  },
  limits: { scansPerUserPerDay: 20 },     // Q6
  accreditation: { enforceWhitelist: true },  // Q3 — safe to enable with an empty list off
} as const;
```

## Appendix B — Reject codes

```ts
type RejectCode =
  // criterion 1 — invoice
  | 'INVOICE_MISSING' | 'INVOICE_MALFORMED' | 'INVOICE_DUPLICATE'
  // criterion 2 — date
  | 'DATE_MISSING'    | 'DATE_UNPARSEABLE'  | 'DATE_FUTURE'  | 'DATE_EXPIRED'
  // criterion 3 — ACCN
  | 'ACCN_MISSING'    | 'ACCN_MALFORMED'    | 'ACCN_NOT_ACCREDITED'
  // OCR / input
  | 'OCR_NO_TEXT'     | 'NOT_A_RECEIPT'
  // flow / abuse
  | 'RATE_LIMITED'    | 'SESSION_EXPIRED'   | 'CORRECTION_NOT_IN_OCR';
```

Every rejection carries one of these. No bare booleans anywhere in the validation path — this is what makes
the test suite assertable and the UI copy specific.
