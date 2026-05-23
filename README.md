# Swisher

Mobile-first receipt splitter for Sweden. Photograph a restaurant receipt, tap who
ate what, and get a **locked Swish QR code + `swish://` link per person** so each diner
pays the bill-payer directly.

## The constraint that shapes everything

The app **never touches money**. It only generates payment *instructions*; funds flow
diner → bill-payer on Swish's own rails. That is what keeps it license-free (no PSD2 /
Finansinspektionen money-remittance obligations). There is therefore no auto-fire — each
person scans their QR (or taps the link) and confirms with BankID. One tap per person.

## Flow

1. **Foto** — photograph the receipt (or pick from gallery).
2. **Rader** — Claude vision OCR extracts line items + total; review and correct them,
   then add the bill-payer (their Swish number) and the other diners.
3. **Fördela** — tap each diner onto the items they shared. Shared items split equally.
4. **Betala** — optional dricks (tip) %, then a locked Swish QR + link per person.

All Swish fields (payee, amount, message) are **non-editable**, so no one can change the
amount or recipient before confirming.

## Swedish specifics

- Prices are **VAT-inclusive** (moms baked in), so shares are just the sum of each
  person's items — no proportional tax distribution.
- Amounts are handled in **öre (integers)** end-to-end; per-item splits are distributed
  öre-by-öre so each person's share sums back exactly to the line total.
- Input accepts comma decimals and space thousands separators (`1 234,50`).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind v4** — one deploy serves the
  mobile UI and the server routes.
- `app/api/ocr` — Claude vision (server-side, key never reaches the client).
- `app/api/qr` — proxies the public getSwish prefilled-QR generator
  (`mpc.getswish.net/qrg-swish/api/v1/prefilled`); if that endpoint is unreachable it
  falls back to generating a QR of the locked `swish://` deep link locally (still
  scannable cross-device).

This uses only the **public** prefilled-QR generator — no Företagsswish, no merchant
agreement, no money routed through a business account.

## Run

```bash
cp .env.example .env.local      # add ANTHROPIC_API_KEY (optional — OCR falls back to manual entry)
npm install
npm run dev                     # http://localhost:3000
```

Open it on your phone (same network, or deploy it) for the camera capture flow.

### Scripts

| command | what |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cf:preview` | build + run on the Cloudflare runtime (workerd) locally |
| `npm run cf:deploy` | build + deploy to Cloudflare Workers |

## Configuration

| env var | default | purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | enables receipt OCR; without it, use manual entry |
| `OCR_MODEL` | `claude-sonnet-4-6` | model used for OCR |

For local Cloudflare-runtime testing, put these in a `.dev.vars` file (see
`.dev.vars.example`). In production they are Worker secrets, not env vars.

## Deploy to Cloudflare

The app runs on **Cloudflare Workers** via the [OpenNext](https://opennext.js.org/cloudflare)
adapter. `wrangler.jsonc` enables `nodejs_compat`, points at the generated
`.open-next/worker.js`, and binds static assets — so both API routes (OCR and QR)
run server-side on the Workers runtime.

### Option A — Git integration (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**, pick
   this repo.
2. Set the **deploy command** to `npm run cf:deploy` (and, if asked for a separate
   build command, `npm run cf:build`).
3. After the first deploy, add the secret under the Worker's **Settings → Variables
   and Secrets**: `ANTHROPIC_API_KEY` (and optionally `OCR_MODEL`).
4. Every push to the production branch redeploys.

### Option B — From your machine

```bash
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key
npm run cf:deploy
```

The Worker comes up at `https://swisher.<your-subdomain>.workers.dev`. Unlike a
local sandbox, Cloudflare's network can reach `mpc.getswish.net`, so QR codes use
the official getSwish generator (with the local `swish://` QR kept as a fallback).
