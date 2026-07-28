# Drop receipt photos here

This folder is the input to the corpus builder. It is **gitignored** — receipt photos are purchase
history, so the images stay on your machine and only the derived Vision JSON is committed.

## What to collect

**5–30 photos**, covering the merchant mix. Please include deliberately bad ones — the degraded cases
are what set the realistic accuracy threshold, and a corpus of only clean receipts would give a
benchmark number that flatters the parser and predicts nothing.

| Axis | Include |
|---|---|
| Light | good · dim · direct glare · flash on |
| Paper | flat · creased · curled · partially folded |
| Angle | straight-on · ~15° · ~30° |
| Print | fresh thermal · faded |
| Format | every merchant format you have |
| Negatives | a menu, a business card, a photo of a screen, a receipt with the invoice line torn off |

Any filename is fine; `jpg`, `jpeg` and `png` are picked up. Use short descriptive names — they become
the fixture names, e.g. `outlets-faded-angled.jpg` → `outlets-faded-angled.vision.json`.

## Then run

```bash
cd functions
npm run receipts:corpus
```

This calls Cloud Vision **once per image** (one-time cost, comfortably inside the 1,000 units/month
free tier) and writes, next to this folder:

- `<name>.vision.json` — the cached raw Vision response. **Committed.** Every downstream test replays
  these, so the whole suite stays hermetic, offline and free — no Vision calls in CI.
- `<name>.expected.json` — a stub for you to hand-label.

## Then hand-label

Open each `<name>.expected.json` and fill in what the receipt *actually* says:

```jsonc
{
  "label": "clean",              // "clean" | "degraded"  — sets which accuracy threshold applies
  "invoice_no": "SI-004512",
  "accn": "116-000123456789",
  "receipt_date": "2026-07-28",  // YYYY-MM-DD, in Asia/Manila wall-clock
  "notes": ""
}
```

For a negative fixture (not a receipt, or unclaimable), set the expected rejection instead:

```jsonc
{ "label": "negative", "expectReject": "NOT_A_RECEIPT", "notes": "photo of a menu" }
```

The hand labels are the acceptance criteria. Getting them right matters more than getting many of them.

## Then measure

```bash
npm run receipts:benchmark
```

Prints per-field precision/recall plus a near-miss confusion table, and fails below threshold. This is
the number that actually answers "is the OCR good enough", and it guards every future regex tweak.
