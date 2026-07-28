# Phase A Runbook — cloud steps for you to run

Per decision **Q-A** in [ocr-implementation-phases.md](./ocr-implementation-phases.md#5-decisions--resolved-2026-07-28):
I write the config, you run anything that touches the cloud.

**Project:** `tome-loyalty-web-app`
**Region for all functions:** `asia-southeast1` (Singapore — lowest latency for PH users)

Steps are ordered so that **the spend ceilings exist before any Vision-calling code does**. Please don't
reorder A5 ahead of A3/A4.

---

## A1 — Firebase CLI *(done — no action)*

Installed locally as a dev dependency rather than globally, so CI and your machine run the same version.
Invoke it as `npx firebase …` from the repo root.

## A2 — Log in

```bash
npx firebase login
npx firebase projects:list          # tome-loyalty-web-app must appear
```

If the list is empty or the project is missing, the logged-in Google account is not on the project. The
account needs **Editor** or **Owner**.

## A3 — Confirm the Blaze plan is active

https://console.firebase.google.com/project/tome-loyalty-web-app/usage/details

Cloud Vision and outbound network calls from Cloud Functions both **fail closed** on Spark. If this shows
Spark, everything downstream of here stops.

## A4 — Set the spend ceilings ⚠️ *do this before A5*

These are the only protections a bug or an attack cannot get past. Everything else is code, and code has
bugs.

**Billing budget alert** — https://console.cloud.google.com/billing/budgets?project=tome-loyalty-web-app
Create a budget with an amount you're comfortable with and alerts at 50 / 90 / 100 %.
*(This needs a Billing Account Administrator role, which is why it's yours rather than mine.)*

**Hard Vision quota cap** —
https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas?project=tome-loyalty-web-app

> ⚠️ **Correction to an earlier version of this runbook:** Cloud Vision exposes **no per-day quota**.
> Verified against the Service Usage API on 2026-07-28 — every relevant metric is per-minute, and the
> only `1/d/{project}` limit belongs to Product Search, which this project does not use. Do not go
> looking for a daily cap; it does not exist.

The adjustable limit that matters:

| Metric | Unit | Default |
|---|---|---|
| `Document text detection requests` | `1/min/{project}` | 1800 |
| `Requests` (aggregate) | `1/min/{project}` | 1800 |

**Set `Document text detection requests` to 10/min.** Steps: filter on the **Name** column for
`Document text detection`, tick the per-minute row (`Adjustable: Yes`), *Edit Quotas*, enter 10.

Why 10:

| Limit | Worst case/day | Cost/day | Users supported at 20 scans/day |
|---|---|---|---|
| 1800/min (default) | 2,592,000 | ~$3,888 | — |
| **10/min** | 14,400 | ~$22 | 720 |
| 5/min | 7,200 | ~$11 | 360 |

> Cost reference: Vision `DOCUMENT_TEXT_DETECTION` is free for the first 1,000 units/month, then
> $1.50/1,000. One scan = one unit; the two-call flow does **not** double it, since only `scanReceipt`
> touches Vision.

## A5 — Enable the Cloud Vision API

```bash
gcloud services enable vision.googleapis.com --project=tome-loyalty-web-app
gcloud services list --enabled --project=tome-loyalty-web-app | grep vision
```

Then go back and set the quota cap in A4 — the quota page only exists once the API is enabled.

## A6 — Firestore TTL policy on `scan_sessions` ✅ DONE

*Applied 2026-07-28. `ttlConfig.state: ACTIVE`.*

Makes Firestore clean up abandoned scan sessions so they do not accumulate.

```bash
gcloud firestore fields ttls update expires_at \
  --collection-group=scan_sessions \
  --enable-ttl \
  --project=tome-loyalty-web-app --quiet
```

Verify:

```bash
gcloud firestore fields ttls list --project=tome-loyalty-web-app
```

Reverse with `--disable-ttl` on the update command.

> ⚠️ **TTL is cleanup, not the security control.** Firestore deletes expired documents *within 24
> hours* of expiry, not at the instant. The 15-minute session window is enforced in `claimReceipt`,
> which compares `expires_at` against the server clock and rejects with `SESSION_EXPIRED` regardless of
> whether Firestore has reaped the row yet. Relying on TTL alone would leave a 24-hour replay window.
> The adversarial suite tests this directly.

Note: this works on a collection group with no documents yet — `scan_sessions` did not exist when the
policy was applied.

## A7 — Check for anything else already using this project ⚠️

**This is the one step with real regression risk**, and it maps to open question Q5 in the architecture doc.

The project is named `tome-loyalty-web-app`, and this repo is the mobile app. If a **web** client also talks
to this Firestore, deploying rules will lock it out the moment it does anything the rules don't cover.

- Check https://console.firebase.google.com/project/tome-loyalty-web-app/settings/general for registered apps
- Check https://console.firebase.google.com/project/tome-loyalty-web-app/firestore/rules for rules already
  deployed (the repo has none committed, but the console is the source of truth)
- Check whether a `receipts` collection already exists in Firestore

**Tell me what you find before A8.** If other clients or existing rules turn up, I merge rather than
replace.

For reference, here is everything *this* repo does against Firestore today — both reads, both covered:

| Operation | Source | Covered by |
|---|---|---|
| `getDoc(users/{uid})` | [userService.ts:17](../src/services/userService.ts#L17) | `match /users/{uid} … allow read: if isSelf(uid)` |
| `getDocs(stamps where owner_ID == uid)` | [stampService.ts:17](../src/services/stampService.ts#L17) | `match /stamps/{stampId} … allow read: if ownsResource()` |

The app performs **no writes at all** (signup does not create a `users/{uid}` doc — that's why
[header.tsx:47](../src/components/header.tsx#L47) has fallback values), so no write path can regress.

## A8 — Deploy rules and indexes

Dry-run against the emulator first — this is §9.4 of the architecture doc, and it runs offline and free:

```bash
cd functions && npm run test:rules
```

Then deploy:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

Functions are **not** deployed here. Nothing that spends money ships until Phase E's adversarial suite is
green.

---

## Exit checklist

- [x] `npx firebase projects:list` shows `tome-loyalty-web-app` — logged in as `senagangeorgekristan@gmail.com`
- [ ] Blaze plan confirmed active
- [ ] Billing budget alert live ← **only control that holds regardless of a code bug**
- [ ] Vision API enabled, per-day quota cap set ← **ditto**
- [x] `scan_sessions.expires_at` TTL state is `ACTIVE`
- [ ] A7 answered — other clients / existing rules / existing `receipts` collection?
- [ ] Rules + indexes deployed, and the app still loads the home screen with stamps

---

## What I'm doing meanwhile

Phases B, C and D.1/D.2 need none of the above — they're the `functions/` scaffold, the synthetic Vision
fixture generator, and the pure validation core, all of which run offline against the emulator and Jest.
I'll stop at the **end of Phase D** for your review, per decision Q-F.

Drop receipt photos into `functions/__fixtures__/receipts/raw/` whenever you have them (see the README
there) — that's what unblocks **D.3**, the real-format tuning.
