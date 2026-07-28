# OCR Receipt Validation — Execution Plan

Companion to [ocr-receipt-validation-plan.md](./ocr-receipt-validation-plan.md) (the *architecture* doc).
That doc says **what** and **why**. This doc says **in what order, producing which files, gated by which
tests**.

**Status:** Phases A (configs) · B · C · D.1 · D.2 **complete and green** — see §6.
Next gate: Phase E. D.3 waits on receipt photos.

---

## 1. Ground truth — verified against the repo, not assumed

Everything below was checked directly before planning. ✅ = architecture doc was right; ⚠️ = needs a
correction the architecture doc does not account for.

| Claim in the architecture doc | Reality |
|---|---|
| `functions/` does not exist | ✅ absent |
| No `firebase.json` / `firestore.rules` / `storage.rules` / `firestore.indexes.json` | ✅ all absent — **also no `.firebaserc`** |
| Scanner tab is a placeholder | ✅ [scanner.tsx](../src/app/(tabs)/scanner.tsx) renders a cat GIF |
| Header hidden on `scanner` in two places | ✅ [_layout.tsx:27](../src/app/(tabs)/_layout.tsx#L27) + [header.tsx:20](../src/components/header.tsx#L20) |
| `expo-camera` installed, `CAMERA` permission declared | ✅ `~57.0.3`, [app.json:21-23](../app.json#L21-L23) |
| Firestore access confined to `src/services/` | ✅ [userService.ts](../src/services/userService.ts), [stampService.ts](../src/services/stampService.ts) |
| `StampHistory` shape `{ receipt_ID, time_stamped }` | ✅ [stamps.ts:8-11](../assets/classes/stamps.ts#L8-L11) |
| Emulator needs Java 11+ | ✅ **Java 17.0.18 present** |
| Node 22 runtime | ✅ **local Node v22.14.0**, npm 11.4.2 |
| — | ✅ **gcloud SDK 562.0.0 present** — can enable APIs and set quotas from here |
| Firebase CLI available | ⚠️ **`firebase` is NOT installed.** Hard prerequisite for deploy, emulators, and rules tests. |
| `bgTransparency` is the string `'10'` | ⚠️ it is the **number** `10` ([theme.ts:9](../src/constants/theme.ts#L9)). Template-literal result is identical; no code change, just don't "fix" it. |
| `expo-image-manipulator` for downscaling | ⚠️ **not installed**, and `manipulateAsync` is **deprecated** in SDK 57. Must use the contextual API: `manipulate(uri).resize({width}) → renderAsync() → saveAsync({format: JPEG, compress, base64: true})`. |
| `CameraView autofocus="on"` | ⚠️ `autofocus` is **iOS-only** in SDK 57. Harmless on Android, but it is not the Android focus story — the guide overlay + tap-to-focus + the review screen carry that load. |
| `firebase-functions` v7 | ⚠️ v7 **removed `functions.config()`**. `config.ts` must use the params module (`defineString` / `defineInt` / `defineSecret`), not the legacy config API. |
| Uniqueness doc ID `{accn}__{invoice_no}` | ⚠️ workable, but Firestore reserves IDs matching `__.*__`, forbids `/`, `.`, `..`, and caps IDs at 1500 bytes. Needs an explicit `buildReceiptKey()` guard (Phase D). Not a design change — a missing validation. |
| `firebaseConfig.ts` is ready for callables | ⚠️ it exports `app`, `auth`, `db` only ([firebaseConfig.ts](../firebase/firebaseConfig.ts)). Needs a `functions` export bound to `asia-southeast1`. |
| D6 App Check spike is "one native module" | ⚠️ **understated.** There is no `google-services.json` in `android/app/`, and `@react-native-firebase/app` (the required peer of `@react-native-firebase/auth`, which is installed but unused) is absent. The spike therefore costs: add `@react-native-firebase/app` + `@react-native-firebase/app-check`, obtain and commit `google-services.json`, add the Google Services Gradle plugin, and `prebuild --clean`. Budget accordingly, or defer to Phase 8 as the architecture doc allows. |
| — | ⚠️ **No ESLint config exists.** `npm run lint` scaffolds one on first run. The "core/ imports nothing from firebase" lint rule needs a config we control, so we create `eslint.config.js` explicitly rather than letting the scaffold decide. |
| — | ⚠️ [stampService.ts:35](../src/services/stampService.ts#L35) writes `id: doc.id` (a **string**) into `StampCardDetails.id?: number`. The `as unknown as` cast hides it. Phase H needs the real doc ID to award a stamp — this gets fixed to `string` there. |

**Net effect on the plan:** no phase is invalidated. Phase A gains the Firebase CLI install, Phase D gains
`buildReceiptKey`, Phase F gains an `expo-image-manipulator` install and the new API, and D6's cost estimate
goes up.

---

## 2. What "0 errors" means here

Restating §2 of the architecture doc, because it governs every exit gate below and I don't want it to get
lost:

- **Guaranteed 0 errors:** validation logic, uniqueness, and the stamp-award transaction. Deterministic,
  server-side, transaction-enforced, exhaustively tested. Phases D and E are gated on 100% branch coverage
  and a green adversarial suite.
- **Not guaranteed:** OCR reading characters correctly off a photo. Cloud Vision is probabilistic. Faded
  thermal paper and glare will produce misreads.

The design makes OCR errors *safe*: they land in the review screen or in a coded rejection, never in a
silently-wrong stamp. Where I write "0 errors" in an exit gate below, I mean the first bullet.

---

## 3. Phases

Each phase lists **goal → deliverables → tests → exit gate**. A phase does not start until the previous
one's exit gate is green.

### Phase A — Access, prerequisites, cost guardrails
*Blocked on: §5 Q-A (project access). Mostly your actions, not mine.*

| # | Task | Who |
|---|---|---|
| A1 | `npm i -D firebase-tools` (pinned, local — not global, so CI matches) | me |
| A2 | `firebase login` | **you** |
| A3 | Confirm Blaze plan is active on the project, and that the account in A2 has **Editor or Owner** | **you** |
| A4 | `.firebaserc` with a `default` project alias | me |
| A5 | `gcloud services enable vision.googleapis.com` | me (needs A3) |
| A6 | **Hard Vision quota cap** — set `DOCUMENT_TEXT_DETECTION` requests/day in the GCP console to the Q8 volume × 3 | me + your confirm |
| A7 | **Billing budget alert** at a threshold you name | **you** (needs billing-account role I likely don't have) |
| A8 | Firestore **TTL policy** on `scan_sessions.expires_at` | me (`gcloud firestore fields ttls update`) |

**Why A6/A7 come before any Vision-calling code exists:** they are the only ceiling that a bug or an attack
cannot exceed. Every other mitigation is code, and code can have bugs.

**Exit:** `npx firebase projects:list` resolves the project · Vision API enabled · quota cap and budget
alert live and screenshotted · TTL policy shows `ACTIVE`.

---

### Phase B — Scaffolding, zero behaviour
*Blocked on: A. Nothing here can award a stamp or spend a cent.*

```
.firebaserc                          firebase.json
firestore.rules                      firestore.indexes.json
storage.rules
eslint.config.js                     # root, flat config, eslint-config-expo
jest.config.js                       # root, TWO projects: 'node' + 'jest-expo'
functions/
├── package.json                     # firebase-functions ^7, firebase-admin ^14,
│                                    # @google-cloud/vision ^5, engines.node 22
├── tsconfig.json                    # strict, rootDir src, outDir lib
├── eslint.config.js                 # + no-restricted-imports rule scoped to core/
├── jest.config.js                   # ts-jest, coverageThreshold 100% on core/
└── src/index.ts                     # empty export, compiles
```

Root test deps (per architecture doc §9, versions confirmed against SDK 57):

```bash
npx expo install jest-expo jest @types/jest -- --dev
npx expo install @testing-library/react-native --dev   # v13+; react-test-renderer is dead on React 19
```

**B1 — the forbidden-import lint rule.** This is what mechanically enforces D3 (a pure core). ESLint flat
config, scoped to `functions/src/receipts/core/**`:

```js
'no-restricted-imports': ['error', { patterns: [
  'firebase-admin*', 'firebase-functions*', '@google-cloud/*', '../../vision/*', '../../data/*'
]}]
```

Without this the purity claim is a comment, and comments rot.

**B2 — the shared-types decision.** The architecture doc says "shared types between the app and `functions/`
via path alias" (§Phase 1). I looked at this concretely and **recommend against a cross-package alias**: the
app and `functions/` have separate `tsconfig.json`s and separate builds, `functions` compiles with
`rootDir: src` (widening it relocates the emit tree and breaks `main`), and Metro resolving into a server
package invites accidentally bundling `firebase-admin` into the app.

**Instead:** the wire contract lives in `assets/classes/receipts.ts` (canonical, app-side, matching the
existing `users.ts` / `stamps.ts` / `maps.ts` convention). `functions/src/receipts/core/types.ts` declares
the same shapes independently, and `functions/__tests__/contract.test.ts` asserts **mutual assignability in
both directions** at compile time. Drift then fails the build with a type error naming the field, which is
the property we actually want. Both packages stay independently buildable.

**Exit:** `npx tsc --noEmit` green in both packages · `npm run lint` green in both · `npm test` runs and
reports 0 tests · **no Firebase resources deployed yet**.

---

### Phase C — Corpus tooling and the synthetic-fixture generator
*Blocked on: B. **This is the phase that unblocks everything else while receipt samples are gathered.***

| Deliverable | Purpose |
|---|---|
| `functions/scripts/buildCorpus.ts` | Reads `__fixtures__/receipts/raw/*.{jpg,png}`, calls Vision **once each**, writes `<name>.vision.json` + a stub `<name>.expected.json` for hand-labelling. One-time cost, fits the 1,000-unit free tier. |
| `functions/__fixtures__/synth/makeVisionResponse.ts` | **The unblocker.** Builds a *structurally faithful* Vision `fullTextAnnotation` — pages → blocks → paragraphs → words → symbols, real `boundingBox.vertices`, per-level `confidence`, `detectedBreak` — from a plain text-layout spec. |
| `functions/__fixtures__/synth/*.spec.ts` | Layout specs: two-column label/value, value-below-label, skewed baselines, torn line, glare-dropped characters, non-receipt. |
| `npm run receipts:benchmark` | Replays every cached fixture, prints per-field precision/recall + a near-miss confusion table, exits non-zero below threshold. |

**Why the synthetic generator matters:** the architecture doc marks Phase 2 🔴 *blocked on real receipts*.
That is true for the **regex constants** but not for the **extraction machinery**. A faithful synthetic
Vision response lets me build and 100%-cover the adapter, anchor matching, geometry search, date parsing,
and validation now — and then real receipts become fixture files plus `rules.config.ts` entries, not a
rewrite. That is exactly the leverage `rules.config.ts` was designed for.

Synthetic fixtures **never** count toward the accuracy benchmark (§9.2). They prove the code is correct;
only real receipts prove it is *accurate*. The benchmark counts real fixtures only and reports the split.

**Exit:** `makeVisionResponse` output validates against the `@google-cloud/vision` response type ·
`buildCorpus.ts` runs end-to-end on ≥1 real image · benchmark harness runs (trivially, on an empty real
corpus) and prints the split.

---

### Phase D — The pure validation core ← **the correctness centrepiece**
*D.1–D.2 blocked on: C. D.3 blocked on: real receipt samples (§5 Q-B).*

Every file below is pure TypeScript. No `firebase-admin`, no `firebase-functions`, no Vision client, no
I/O, no `Date.now()` — the clock is **injected**, so window tests are deterministic.

#### D.1 — Infrastructure

| File | Responsibility | Test focus |
|---|---|---|
| `core/types.ts` | `OcrDocument`, `OcrLine`, `OcrWord`, `Box`, `FieldCandidate`, `ValidationResult` union, `RejectCode` | contract test vs `assets/classes/receipts.ts` |
| `core/visionAdapter.ts` | Vision JSON → `OcrDocument`. **The only file that knows Vision's shape.** Reconstructs lines by *geometry* (vertical-overlap grouping, x-sort) rather than trusting `\n`, so skewed photos still yield correct lines. | skew, multi-column, empty response, missing `confidence`, missing `boundingBox` |
| `core/levenshtein.ts` | Bounded edit distance, early-exit above `max` | exhaustive small-string table; early-exit correctness |
| `core/normalize.ts` | Uppercase, collapse whitespace, strip noise. **Field-scoped** confusion repair (`O→0 I/l→1 S→5 B→8 Z→2 G→6`) applied *only* to numeric-only candidates | proves a global substitution would corrupt `SUBTOTAL` → asserted as a negative test |

#### D.2 — Extraction

| File | Responsibility |
|---|---|
| `core/anchors.ts` | Find label lines by alias list with bounded Levenshtein (≤1 short labels, ≤2 long) — Vision mangles *labels* too, not just values |
| `core/extractInvoice.ts` | Ranked candidates: right-of-label → next line → nearest box right/below. Returns **scored candidates**, never one answer |
| `core/extractAccn.ts` | Same shape, ACCN format rules |
| `core/dateParse.ts` | See D.2a |
| `core/extractDate.ts` | Candidate dates + ranking |
| `core/receiptKey.ts` | `buildReceiptKey(accn, invoice)` → Firestore-safe composite. **Rejects** `/`, leading/trailing `.`, the reserved `__…__` pattern, empty components, and >1500 bytes. Returns a `RejectCode`, never throws |
| `core/validate.ts` | Composes all of the above; applies window + format rules; emits the result union |
| `core/rules.config.ts` | Formats, aliases, windows, limits — **data, not code** |

**D.2a — the timezone trap, handled explicitly.** The architecture doc flags this (§9.1) and it is the single
most likely silent bug in the feature. Cloud Functions run in **UTC**; receipt dates are Asia/Manila
wall-clock. `new Date("07/28/2026")` would parse as UTC midnight and shift every receipt 8 hours, breaking
the window check for every evening transaction.

**Implementation:** parse to `{year, month, day, hour, minute}` parts with an explicit format table, then
build the instant as `Date.UTC(...) - 8h`. **The Philippines has observed no DST since 1978 and has a fixed
UTC+08:00 offset**, so a constant offset is not an approximation — it is exact, and it means zero timezone
dependencies. Locked by a test that pins a 23:30 Manila receipt to the correct UTC instant.

Formats: `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, `MM-DD-YY`, `Jul 28, 2026`, `28-JUL-26`, each ± trailing
time. `day > 12` disambiguates; otherwise `rules.config.localeOrder` (`'MDY'` for PH POS). Impossible
calendar dates (Feb 30, month 13, Feb 29 on a non-leap year) are rejected, not clamped.

#### D.3 — Real-format tuning *(gated on receipt samples)*
Populate `rules.config.ts` patterns and label aliases from the real corpus; add real fixtures; run the
benchmark for the first meaningful number.

**Exit gate for D:**
- **100% branch coverage on `core/`**, enforced by `coverageThreshold`, not by inspection
- Forbidden-import lint rule green
- Every synthetic fixture passes
- Benchmark ≥95% exact-match per field on clean real receipts, ≥80% on degraded, **and 100% of the
  remainder landing in review or rejection rather than being silently wrong** — the last clause is the one
  that matters
- Negative corpus (menu photo, business card, blank, torn invoice line) → correct `RejectCode`, never a
  false positive

---

### Phase E — Callables, data layer, security rules ← **the anti-fraud gate**
*Blocked on: D.2 (D.3 not required — the callables don't care what the regexes are).*

```
functions/src/
├── config.ts                   # params module (defineInt/defineString) — NOT functions.config()
├── receipts/
│   ├── scanReceipt.ts          # callable #1
│   ├── claimReceipt.ts         # callable #2
│   ├── errors.ts               # RejectCode → HttpsError
│   ├── vision/client.ts        # INJECTABLE interface; tests substitute a fake
│   └── data/
│       ├── receiptRepo.ts      # the claim + award transaction
│       ├── sessionRepo.ts  rateLimitRepo.ts  merchantRepo.ts
└── scripts/seedMerchants.ts
```

**`scanReceipt`** — auth guard → **rate-limit check before Vision** → decode → Vision → adapter → extract →
validate → stash `scan_sessions/{id}` (TTL 15m) → return `{ sessionId, fields, candidates, confidence, softRejects }`.

**`claimReceipt`** — auth guard → load session (owner + TTL checked server-side) → **verify every corrected
value appears in the stored OCR text** (D4) → one `runTransaction`:

1. `transaction.create(receipts/{key})` — **`create`, not `set`**, so "already exists" is a *precondition
   failure* enforced by Firestore rather than a read-then-write race we hand-roll
2. `stamp_count += 1`, append `history`
3. bump the rate-limit counter
4. mark the session consumed (replay defence)

All four in one transaction: a crash mid-flow can neither award a free stamp nor burn a receipt.

**Security rules** — the repo has none deployed today, so this locks the project down for the first time:

| Collection | Read | Write |
|---|---|---|
| `receipts` `scan_sessions` `rate_limits` `stamps` | owner only | **denied** (Admin SDK bypasses rules) |
| `users` | owner only | owner only |
| `merchants` | any authenticated | **denied** |

**Exit gate — the full adversarial suite (§9.3) green, plus:**

| Case | Must |
|---|---|
| Same receipt twice, same user / different users | 2nd → `INVOICE_DUPLICATE` |
| **Two concurrent claims, same receipt** | **exactly one succeeds, exactly one stamp** |
| Unauthenticated call, either function | rejected |
| Rate limit exceeded | `RATE_LIMITED` **and the Vision fake records zero calls** |
| Correction absent from stored OCR text | `CORRECTION_NOT_IN_OCR` |
| Another user's session ID / expired session / replayed session | rejected |
| Vision returns no text / throws / times out | clean error, **no writes, receipt not burned** |
| Transaction fails after Vision succeeded | no stamp, no receipt doc |
| Future-dated / older than window | `DATE_FUTURE` / `DATE_EXPIRED` |
| Device clock rolled forward | irrelevant — server clock only; asserted |
| ACCN absent from `merchants/` | `ACCN_NOT_ACCREDITED` |
| Claim against another user's stamp card | rejected |
| `stamp_count` / `history` desync | impossible — same transaction; asserted |

Plus the rules suite (§9.4) — client writes to all four server-owned collections denied, cross-user reads
denied, and a **regression test that existing `users` and `stamps` read paths still work**. That last one is
the one that protects the running app, since it currently runs with no rules at all.

---

### Phase F — Client service layer
*Blocked on: E.*

- `firebase/firebaseConfig.ts` — add `export const functions = getFunctions(app, 'asia-southeast1')`
- `npx expo install expo-image-manipulator`
- `src/services/receiptService.ts` — matching the existing service conventions exactly (`auth.currentUser`
  guard, `null`/`[]` when signed out, `Timestamp → Date`, `as unknown as T`):
  ```ts
  scanReceipt(imageUri: string): Promise<ScanResult>
  claimReceipt(sessionId: string, corrections?: Partial<ReceiptFields>): Promise<Verdict>
  fetchReceiptHistory(): Promise<ReceiptRecord[]>
  ```
- Preprocessing with the **SDK 57 contextual API** (not deprecated `manipulateAsync`): resize to 1600px long
  edge, JPEG `compress: 0.8`, `base64: true` → ~300–700 KB, comfortably inside callable limits.

**Exit:** unit-tested against a mocked callable · integration-tested against the emulator · a deliberate
oversized-image test proving the downscale keeps us under the limit.

---

### Phase G — Scanner UI
*Blocked on: F.*

Replaces [scanner.tsx](../src/app/(tabs)/scanner.tsx). The header is already hidden on this route in both
places, so **no layout change is needed** for a full-bleed camera.

Explicit state machine in `src/features/receipts/useScanner.ts` — no ad-hoc booleans:

```
permission → idle → capturing → uploading → processing → review → submitting
                                              → success | rejected | offline | error
```

Components: `cameraCapture.tsx`, `receiptGuideOverlay.tsx`, `reviewFields.tsx`, `resultSuccess.tsx`,
`resultRejected.tsx`. Review screen shows the three fields editable, low-confidence ones flagged, and
server-supplied alternates as **tap-to-pick chips** — a misread fixed in one tap instead of by typing.
Explicit offline state (D7) with retry. Duplicate gets its own screen: it is both the fraud case and the
most common honest confusion.

Styling per repo convention — `StyleSheet.create` at the bottom of each file, `Colors.outlets.purple`
accent, `LinearGradient` `#fff` → `${Colors.outlets.purple}${bgTransparency}` matching
[collection.tsx](../src/app/(tabs)/collection.tsx). `reactCompiler` is on: **no manual `useMemo`/
`useCallback`**, no mutation during render.

**Exit:** §9.5 component tests green — permission denied, offline, every reject code, the correction flow,
network failure mid-upload, and **session expiring while the user sits on the review screen**.

---

### Phase H — Stamp integration
*Blocked on: G.*

- `src/contexts/stampContext.tsx` — `StampProvider` mirroring [userContext.tsx](../src/contexts/userContext.tsx),
  **with the `refresh()` that userContext lacks**. This fixes the gap at
  [stampSection.tsx:16-29](../src/components/homePage/stampSection.tsx#L16-L29): it fetches on mount only, so
  a stamp earned by a scan would not appear until an app restart.
- Fix `StampCardDetails.id` to `string` (see §1) so the award transaction can address the right card.
- Success animation on the newly-earned stamp; reward-milestone handling at `stamp_reward_index`.

---

### Phase I — Full validation, hardening, docs
*Blocked on: H.*

Pre-merge gate, both packages:

```bash
npm run lint && npx tsc --noEmit && npm test && npm run receipts:benchmark
cd functions && npm run lint && npx tsc --noEmit && npm test
```

Then the **manual device matrix (§9.6)** — this cannot be automated and is the only thing that validates the
OCR half of the feature: light (good/dim/glare/flash), paper (flat/creased/curled/folded), angle (0°/15°/30°),
print (fresh/faded), every merchant format. Plus airplane mode before submit, connection dropped mid-upload,
app killed mid-request (**receipt not burned** in all three), and the same receipt scanned simultaneously on
two phones (**exactly one stamp**).

Finally, update [CLAUDE.md](../CLAUDE.md): the `functions/` package, the rules files, the region, the
receipts service, the stamp context, and the new test/benchmark commands.

---

## 4. Dependency graph — what can start right now

```
A (access, guardrails)  ──►  B (scaffold)  ──►  C (corpus tooling + synthetic fixtures)
                                                     │
                                                     ├──►  D.1  ──►  D.2  ──┬──►  D.3 ◄── REAL RECEIPTS
                                                     │                      │
                                                     │                      └──►  E  ──► F ──► G ──► H ──► I
                                                     │
                                              (D6 App Check spike — optional, parallel)
```

**Startable with zero further input:** A1, A4, B, C, D.1, D.2.
**Gated on your answers:** A2/A3/A5–A8 (§5 Q-A), D.3 (§5 Q-B), E's award semantics (§5 Q-C).

Because `rules.config.ts` is data and D3 keeps parsing server-side, receipt samples arriving late costs a
config edit and a fixture add — **not a rewrite**. That is the whole reason the phases are ordered this way.

---

## 5. Decisions — resolved 2026-07-28

| # | Question | Decision |
|---|---|---|
| **Q-A** | Firebase project access | **You run the cloud steps; I write every config file plus an exact runbook.** I produce `.firebaserc`, `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` and [ocr-phase-a-runbook.md](./ocr-phase-a-runbook.md). You run login, enable Vision, set the quota cap and the budget alert. **Confirm Blaze is active** — Vision fails closed without it. |
| **Q-B** | Receipt samples | **You'll drop photos in.** I create `functions/__fixtures__/receipts/raw/` with a README, and build D.1/D.2 against synthetic fixtures meanwhile. When photos land I run the corpus script and tune the real patterns in **D.3**. |
| **Q-C** | Award semantics | **Exactly 1 stamp per valid receipt, credited to the user's single (first) stamp card.** No amount extraction — no 4th field, no Document AI. Matches today's [stampSection.tsx:14](../src/components/homePage/stampSection.tsx#L14) behaviour. |
| **Q-D** | App Check | **Deferred to Phase 8**, per the recommendation in §1. v1 ships on layered mitigations: auth required, per-UID rate limit checked *before* Vision, hard GCP quota cap, billing budget alert. |
| **Q-E** | Remaining defaults | **Taken as documented.** 7-day claim window · future dates rejected · Vision JSON retained 90 days, image not retained · 20 scans/user/day · corrections must appear in the stored OCR text · global uniqueness on `accn + invoice_no` · ACCN whitelist wired but empty (blocks nothing) · single stamp card. Each is one line in `rules.config.ts`. |
| **Q-F** | Review checkpoints | **Two gates: end of Phase D and end of Phase E.** D proves the core correct at 100% branch coverage; E proves the fraud path. Those are where a wrong assumption is cheapest to correct. |

### Consequences for the build order

- Phase A becomes **config + runbook only** on my side; nothing is provisioned by me.
- D.3 is deferred but not blocking — `rules.config.ts` ships with permissive placeholder patterns that are
  *safe* (bad reads land in review; the server still enforces uniqueness) and tighten when photos arrive.
- Phase E's transaction is simplified: `stamp_count += 1` on `stamps[0]`, no amount branch.
- No native modules are added in v1 — `expo-image-manipulator` (Phase F) is the only new dependency touching
  the app bundle, and it needs no prebuild.

---

## 6. Progress log — Phase D checkpoint

### Gate results

```
functions/  lint       clean (incl. the core-purity rule)
            typecheck  clean
            build      lib/ emitted
            tests      276 passed
            coverage   100% statements · 100% branches · 100% functions · 100% lines  (src/receipts/core/)
app/        typecheck  clean
```

Coverage is enforced by `coverageThreshold`, not by inspection: `npm test` in `functions/` fails if
any branch in `core/` goes uncovered.

The purity rule was verified by injecting `import * as admin from 'firebase-admin'` into
`core/validate.ts` and confirming ESLint rejected it, then reverting. It is a real gate, not a comment.

### Delivered

| Area | Files |
|---|---|
| Firebase config | `.firebaserc` · `firebase.json` · `firestore.rules` · `storage.rules` · `firestore.indexes.json` |
| Runbook | [ocr-phase-a-runbook.md](./ocr-phase-a-runbook.md) — the cloud steps for you |
| Package | `functions/` — firebase-functions 7.3.0, firebase-admin 14.2.0, @google-cloud/vision 5.3.7, Node 22 |
| Pure core | `types` `geometry` `deskew` `levenshtein` `normalize` `visionAdapter` `anchors` `extractField` `extractDate` `dateParse` `receiptKey` `validate` `rules.config` |
| Vision seam | `vision/client.ts` — injectable, with a call-counting fake for Phase E |
| Fixtures | `__fixtures__/synth/makeVisionResponse.ts` — structurally faithful Vision responses from a layout spec |
| Tooling | `scripts/buildCorpus.ts` · `scripts/benchmark.ts` · `__fixtures__/receipts/raw/README.md` |

### Deviations from the architecture doc, and why

**1. `firebase-functions-test` dropped.** Its latest release (3.5.0) peer-depends on `firebase-admin`
`<=13`, and we are on 14.2.0. Forcing an unsupported combination into the anti-fraud test path is a
poor trade for what it provides: for a v2 `onCall`, `wrap()` essentially just builds a
`CallableRequest` and invokes the handler. Phase E will construct that object directly (~10 lines, in
`__tests__/helpers/`), which also gives exact control over `auth` and App Check context. The Firestore
emulator — which is what actually provides real transaction semantics for the concurrency test — is
unaffected.

**2. Projection-profile deskew added** (`core/deskew.ts`), which the architecture doc does not mention.
It turned out to be necessary rather than optional: row grouping compares vertical overlap of
axis-aligned boxes, and once a photo is tilted enough that a label and its value 350px apart drift
vertically by about a line height, "same row, skewed" and "different rows" are indistinguishable in y
alone. Without deskew, every angled two-column receipt failed to reunite label and value. The core now
reconstructs rows correctly at up to ~11° of skew, which the manual device matrix (§9.6) explicitly
tests for.

The first implementation used a fixed-grid histogram and was subtly wrong — its score depended on where
bin boundaries happened to fall, saturating across a plateau of angles and *dipping at the exact angle
that levels the page*. Measured on an 8-row fixture it scored 200 across 4.00–6.00° but only 188 at the
true 5.00°. Replaced with a grid-free kernel density score, which is offset-invariant and continuous.

**3. The `right-geometry` candidate source removed.** The architecture doc lists a geometry fallback
that hunts for a value box to the right of the label on another line. It is unreachable as designed:
`visionAdapter` already merges lines sharing a visual row at a 0.5 overlap threshold, so any line the
fallback could find has by then been merged into the anchor's own line. It never executed once across
276 tests. Removed rather than kept as an untested branch in the file that has to be provably correct;
it returns with a real fixture if one ever demonstrates the need.

---

## 6a. Phase D.3 — real-format tuning ✅ *(4 receipts, 2026-07-28)*

```
functions/  lint clean · typecheck clean · build ok
            311 tests passed
            coverage 100% statements · branches · functions · lines
            benchmark  invoice 100% · MIN 100% · date 100%   (clean 3/3, degraded 1/1)
                       0 silently-wrong results
app/        typecheck clean
```

### 🔴 The corpus disproved design decision D5

`ACCN#: 0810107191682022121668` appears **identically** on Harbour City Dimsum House and Cozy Hour
Cafe — unrelated businesses — because the ACCN belongs to **CodeLikeUs Technologies Inc.**, the ZenPOS
software vendor whose support footer prints on both receipts.

D5 chose `{accn}__{invoice_no}` precisely so two stores could both issue `INV-0001`. But every ZenPOS
merchant shares one ACCN, and both merchants use 8-digit per-terminal sequences — Harbour City at
`00021838`, Cozy Hour at `00012126`. When Cozy Hour's counter reaches 21838 the keys collide and a
legitimate receipt is rejected as `INVOICE_DUPLICATE`. Guaranteed false duplicates, merely deferred.

**Resolution (decision Q-C-2):** key on **`{MIN}__{invoice_no}`** — the BIR Machine Identification
Number, one per POS terminal, and a terminal emits each invoice number exactly once. All three corpus
MINs are distinct. ACCN is retained as corroboration; **TIN** identifies the business for accreditation.

### Real formats found

| Field | Observed | Note |
|---|---|---|
| MIN | 17 digits | `MIN: 26013009560086199` |
| Invoice | `INV#` + 8 digits · `SI No: ` + 10 digits | label **glued** to value in the ZenPOS case |
| ACCN | 22 digits | vendor footer; absent entirely on the Robinsons fixture |
| TIN | `003-583-915-00006` | merchant's at top, **vendor's in the footer** |
| Date | `Jul 22 2026 (Wed)` | no `DATE:` label at all; time sometimes on its own line |

### Six defects the real corpus exposed

1. **Glued labels.** `INV#00021838` is one OCR token, so no alias matched it. Failed 3 of 4 receipts.
   Added `splitGluedLabel`, guarded so alias `INV` cannot decompose the word `INVOICE`.
2. **Row-merging had no horizontal constraint.** These photos contain a receipt *and* a keyboard *and*
   a loyalty card, so anything at the same height merged regardless of distance — splicing separate
   documents together and collapsing a 123-line receipt to 22 rows. Added a gap limit of 6× median
   line height.
3. **`inline` treated every trailing word as an equal candidate.** On a merged line, `0311` twenty
   tokens away outranked the real invoice number. Now limited to the 3 words after the label, with
   score decaying by distance.
4. **Anchor ties resolved to the LATER label.** `SALES INVOICE` in the title beat `SI NO` at position
   0, yielding the invoice number `TERMINAL`. Ties now prefer the earliest label on the line, and the
   document-title aliases were removed.
5. **Date ranking ignored plausibility.** `VALIDITY : 03/29/2023 - 03/28/2028` and
   `Issued on: February 02, 2026` outranked the transaction date and got valid receipts rejected as
   `DATE_EXPIRED`. Ranking now puts future dates last and prefers the most recent — a transaction
   cannot be in the future, and permit dates necessarily predate the sale.
6. **TIN picked the POS vendor's, not the merchant's.** Both carry a `VAT REG TIN` label. Added
   `preferEarliest`, since the merchant prints at the top and the vendor in the footer.

Also fixed: the benchmark used `Date.now()`, so the two 21 Jul fixtures would have silently fallen out
of the 7-day window and "failed" on the calendar rather than on a regression. It now derives its clock
from the corpus.

### Caveats on that 100%

- **Four fixtures.** 100% here means 4/4, not statistical confidence. At this size a single miss would
  read as 75%. More receipts — especially non-ZenPOS merchants — would make the number mean something.
- **Labels were derived from the OCR text, not from the physical receipts.** I cross-checked each
  against the raw Vision output independently of the extractor, but if OCR misread a character
  consistently, the label inherits it. Worth spot-checking against the photos.
- **`requireAccn` is off.** The Robinsons receipt has no readable ACCN, so enabling it rejects that
  receipt outright. The flag is wired and tested either way.

### One behavioural fix worth flagging

An unlabelled `pattern-scan` candidate was initially allowed to become a field's value outright. With
the permissive placeholder patterns, that meant a receipt whose invoice label was torn or unreadable
would silently claim `OUTLETS` as its invoice number — a wrong stamp, awarded with nothing flagged to
anyone, which is exactly what §2 of the architecture doc forbids. Such candidates are now offered as
review chips but cannot be auto-accepted (`MIN_AUTO_ACCEPT_SCORE` in `validate.ts`). This is the single
most important correctness change made during Phase D, and it was caught by a test asserting reject
precedence rather than by review.

### Still open, non-blocking

**Architecture doc Q5** — does a `receipts` collection or any deployed Firestore rules already exist on the
project? Only client code is visible from here. If rules *are* already deployed, Phase E must merge rather
than replace them. Worth a glance at the Firebase console before Phase E; it does not block A–D.
