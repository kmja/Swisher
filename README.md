# Swisher

Mobile-first receipt splitter. Photograph a restaurant receipt, tap who ate what, and
get a **locked payment QR + link per person** so each diner pays the bill-payer directly.
Built Sweden-first (Swish), with euro-area receipts handled too.

## The constraint that shapes everything

The app **never touches money**. It only generates payment *instructions*; funds flow
diner → bill-payer on the payment provider's own rails (Swish, or a SEPA bank transfer).
That is what keeps it license-free (no PSD2 / Finansinspektionen money-remittance
obligations). There is no auto-fire — each person scans their QR (or taps the link) and
confirms in their own banking/Swish app. One tap per person.

This principle is also why only **open, account-to-account** rails are supported. Swish
exposes a consumer `swish://` deep link and the euro **EPC/Girocode QR** encodes a direct
SEPA transfer to the payee's IBAN — both point straight at the payee. Wallets like
Vipps/MobilePay/Bizum only prefill payments through a *merchant* API that routes money
through a business account, which would break the constraint, so they're deliberately out.

## Flow

1. **Foto** — photograph the receipt (or pick from gallery). OCR runs automatically.
2. **Rader** — the model extracts line items, total, tip and the receipt's currency;
   review and correct them. For a foreign receipt the currency is auto-detected and
   amounts are converted to SEK (the host can correct the currency). Then the bill-payer
   adds how they want to be paid.
3. **Fördela** — tap each diner onto the items they shared, or split everything evenly.
   Shared items (a bottle, a platter) split across the whole group.
4. **Betala** — a locked payment QR + link per person.

All payment fields (payee, amount, message) are **non-editable**, so no one can change
the amount or recipient before confirming.

## Payment rails

- **Swish (SEK)** — the default. A locked `swish://payment` deep link + the official
  getSwish prefilled QR. Any Swedish phone with Swish opens it straight to a locked payment.
- **SEPA / EPC "Girocode" (EUR)** — offered for euro receipts. The host enters an IBAN
  (remembered after the first time, validated by ISO 7064 mod-97); each diner gets a
  standard EPC069-12 QR that European banking apps scan and prefill (name, IBAN, amount,
  reference). If the host also supplies a Swish number, payers who have Swish can pay the
  kronor amount instead from the same card.

## Currencies

A foreign receipt is converted to SEK using the exchange rate **on the day it was
printed** (what the diners actually paid): historical ECB rates via Frankfurter, with
open.er-api as a latest-rate fallback and a small static table as a last resort
(flagged as estimated). Both the original currency and SEK are shown everywhere amounts
appear. EPC payouts settle in EUR; everything else settles in SEK.

## Live rooms

Instead of assigning items yourself, create a **room**: everyone opens the link (or scans
the join QR) on their own phone, types their name, and taps the items they had. Shared
items are pre-claimed for the whole group. The host sees each person's total and can mark
shares **paid/unpaid** (bookkeeping only — still no money moves). Rooms are backed by a
Cloudflare **Durable Object**, so concurrent claims can't race.

## History

Past splits (rooms you hosted or joined) are listed under **/history** with a live
summary of what's still outstanding, plus a button to start a new receipt. Stored locally
in the browser; the rooms themselves live server-side, keyed by code.

## Swedish / money specifics

- Prices are **VAT-inclusive** (moms baked in), so shares are just the sum of each
  person's items — no proportional tax distribution.
- Amounts are handled in **öre (integers)** end-to-end; per-item splits are distributed
  öre-by-öre so each person's share sums back exactly to the line total.
- Tip is detected from a printed tip line, or inferred when the card was charged more than
  the itemised total, and split equally.
- Input accepts comma decimals and space thousands separators (`1 234,50`).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind v4** — one deploy serves the mobile UI
  and the server routes.
- `app/api/ocr` — receipt OCR. Uses **Claude (Sonnet 4.6) via the Anthropic API** when
  `ANTHROPIC_API_KEY` is set (it reads faint thermal receipts far better), falling back to
  **Cloudflare Workers AI** vision (Llama 4 Scout → Mistral Small 3.1 → LLaVA) via the
  keyless `AI` binding. Returns the detected items, totals, currency and country.
- `app/api/fx` — looks up a currency's SEK rate for a given date (used when the host
  corrects a mis-detected currency).
- `app/api/qr` — Swish QR via the public getSwish generator (local `swish://` QR as
  fallback), and EPC/Girocode QR generated locally for SEPA.
- `app/api/room/*` + `lib/room-do.ts` — the live-room Durable Object (join, claim, paid).

Item glyphs are matched from a keyword/brand table, with hand-drawn SVG icons for dishes
that lack a good emoji (see the gallery at **/debug/icons**).

No merchant agreement and no money routed through a business account — only public,
account-to-account payment instructions.

## Run

```bash
npm install
npm run dev                     # http://localhost:3000
npm test                        # unit tests (money, IBAN, FX, currency, categories)
```

OCR needs either an `ANTHROPIC_API_KEY` (Claude) or the Cloudflare Workers AI binding
(only available once deployed, or under `npm run cf:preview`); during plain
`next dev`/`next start` without a key the OCR call returns 503 and the UI falls back to
manual entry. Everything else works locally. Open it on your phone (same network, or
deploy it) for the camera capture flow.

### Scripts

| command | what |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm test` | unit tests for the pure logic |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cf:preview` | build + run on the Cloudflare runtime (workerd) locally |
| `npm run cf:deploy` | build + deploy to Cloudflare Workers |

## Deploy to Cloudflare

The app runs on **Cloudflare Workers** via the [OpenNext](https://opennext.js.org/cloudflare)
adapter. `wrangler.jsonc` enables `nodejs_compat`, binds static assets, the **`AI`**
binding (OCR fallback) and the **`ROOM`** Durable Object namespace, and points at the
generated `.open-next/worker.js`. Set `ANTHROPIC_API_KEY` as a secret to use Claude for OCR.

### Option A — Git integration (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**, pick this repo.
2. Set the **deploy command** to `npm run cf:deploy` (build command `npm run cf:build`).
3. Every push to the production branch redeploys. Bindings come from `wrangler.jsonc`.

### Option B — From your machine

```bash
npx wrangler login
npm run cf:deploy
```

Unlike a local sandbox, Cloudflare's network can reach `mpc.getswish.net` and the FX/AI
endpoints, so QR codes use the official getSwish generator and OCR/currency conversion work.
