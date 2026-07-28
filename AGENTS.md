# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

# TOME Loyalty — working notes

## Two packages, two toolchains

| | app (repo root) | `functions/` |
|---|---|---|
| Runtime | Expo SDK 57, React 19, expo-router | Node 22, Cloud Functions v2 |
| Firebase | **web** SDK (`firebase/*`) | **Admin** SDK (`firebase-admin`) |
| Tests | `npm test` (jest-expo) | `npm test` (ts-jest, 3 projects) |
| Typecheck | `npx tsc --noEmit` | `npm run typecheck` (includes tests) |

`functions/` is excluded from the app's tsconfig. Do not import across the boundary; the wire
contract is duplicated deliberately in `assets/classes/receipts.ts` and
`functions/src/receipts/core/types.ts`.

## Pre-merge gate

```bash
npm run lint && npx tsc --noEmit && npm test                                  # app
cd functions && npm run lint && npm run typecheck && npm test && npm run receipts:benchmark
```

**The emulator suites need the Firestore emulator running, and firebase-tools 15 refuses Java
below 21.** This machine has both 17 and 21 installed; JAVA_HOME points at 17, so start it with:

```bash
JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot" \
  npx firebase emulators:start --only firestore --project demo-tome
```

Without it, `--selectProjects functions` and `rules` hang rather than fail.

## The receipt scanner

**Flow.** camera → `scanReceipt` (Vision OCR, validate, stash session) → read-only confirmation →
`claimReceipt` (re-validate from the stored OCR text, award in one transaction).

**Three rules that the design rests on. Breaking any of them is a correctness regression, not a
style choice:**

1. **Scanned values are not editable.** `claimReceipt` takes a session id and *nothing else*, and
   re-derives every field server-side. If a corrections parameter ever reappears, the "a client
   cannot influence what is claimed" property is gone. Tested in
   `__tests__/functions/adversarial.test.ts`.

2. **`is_used` is money.** The stamp balance is `count(receipts where is_used == false)`. A client
   able to write it can mint unlimited stamps. `firestore.rules` denies all client writes to
   `receipts`; the future "Stamp this card" press must go through a Cloud Function, **not** a
   relaxed rule. `__tests__/rules/` fails loudly if it is loosened.

3. **Uniqueness keys on `{MIN}__{invoice_no}`, not ACCN.** The fixture corpus disproved the original
   ACCN design: unrelated merchants share an ACCN when they share a POS vendor, so it would collide
   once their independent invoice counters overlapped. See `core/receiptKey.ts`.

**Scanning fills the wallet, not the card.** A claim writes `is_used: false` and does *not* increment
`stamps/{id}.stamp_count`. The card is advanced later by the press flow (not built). Do not "fix"
this by incrementing both — that double-counts.

### Confidence gates

`core/rules.config.ts → confidence` decides when the OCR is sure enough to answer. Because values
cannot be corrected, anything below these becomes a retake, so they are the whole safety margin.

**Tune them against `npm run receipts:benchmark`, never by intuition.** It prints per-field accuracy
*and* an accept/retake split — accuracy alone cannot tell you whether a threshold is sane, since
gates strict enough to reject everything score zero wrong answers. Two mistakes already caught this
way, both of which rejected 100% or 25% of real receipts while looking reasonable in code:

- an ambiguity margin comparing raw scores, which overrode the extractors' domain ranking
  (date plausibility, `preferEarliest` for the merchant's TIN over the vendor's);
- a per-field floor of 0.85, which bounced a *correct* read of a faded receipt at 0.73 — and a faded
  receipt does not get sharper on the second attempt, so "retake the photo" was advice that could
  never work.

### The FAB is the shutter

`src/features/receipts/scannerUiContext.tsx` connects the tab-bar button to the camera, which cannot
otherwise reach each other (the button is rendered by the layout, above the screen). The camera
registers its capture function on mount and **unregisters on unmount** — dropping that leaves a
handler firing into a dead camera.

### Adding receipt fixtures

Drop photos in `functions/__fixtures__/receipts/raw/`, then `npm run receipts:corpus` and hand-label
the generated `*.expected.json`. The benchmark's clock is derived from the corpus, not `Date.now()`,
so fixtures do not age out of the claim window and start failing on the calendar.

## Conventions

- Firestore fields are `snake_case`; `_ID` only as an acronym suffix (`owner_ID`, `stamp_card_ID`).
- `StyleSheet.create` at the bottom of each component file; colours and fonts from
  `src/constants/theme.ts`.
- `reactCompiler` is on: no manual `useMemo`/`useCallback`, no mutation during render.
- Firestore access lives in `src/services/`; components read it through contexts.
- `StyleSheet.absoluteFill`, not `absoluteFillObject` (does not exist in this RN version).
- `@testing-library/react-native` v14: `render` and `renderHook` are **async**, and a sync `act()`
  leaves React mid-transition so every later test in the file gets a null hook result.

## Deploying

`firestore.indexes.json` carries a composite index on `(owner_ID, is_used)` that the balance query
needs. Deploy indexes before the functions, or the first balance read fails.

Run `npm run receipts:backfill -- --apply` in `functions/` once before shipping the wallet:
`where('is_used','==',false)` does not match documents lacking the field, so receipts claimed
earlier would be invisible and users would silently lose stamps they had earned.
