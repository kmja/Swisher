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
2. **Rader** — Workers AI vision OCR extracts line items + total; review and correct
   them, then add the bill-payer (their Swish number) and the other diners.
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
- `app/api/ocr` — **Cloudflare Workers AI** vision (Llama 3.2 Vision) via the `AI`
  binding. Keyless: no API key, billed against the account's free daily Neuron
  allocation. Without the binding (e.g. plain `next start`) it returns 503 and the UI
  falls back to manual entry.
- `app/api/qr` — proxies the public getSwish prefilled-QR generator
  (`mpc.getswish.net/qrg-swish/api/v1/prefilled`); if that endpoint is unreachable it
  falls back to generating a QR of the locked `swish://` deep link locally (still
  scannable cross-device).

This uses only the **public** prefilled-QR generator — no Företagsswish, no merchant
agreement, no money routed through a business account.

## Run

```bash
npm install
npm run dev                     # http://localhost:3000
```

No API keys are needed. OCR runs on Cloudflare Workers AI, which is only available
once deployed (or under `npm run cf:preview` with `wrangler login`); during plain
`next dev`/`next start` the OCR call returns 503 and the UI falls back to manual
entry. Everything else works locally. Open it on your phone (same network, or deploy
it) for the camera capture flow.

### Scripts

| command | what |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cf:preview` | build + run on the Cloudflare runtime (workerd) locally |
| `npm run cf:deploy` | build + deploy to Cloudflare Workers |

## Deploy to Cloudflare

The app runs on **Cloudflare Workers** via the [OpenNext](https://opennext.js.org/cloudflare)
adapter. `wrangler.jsonc` enables `nodejs_compat`, binds static assets and the **`AI`**
binding (for OCR), and points at the generated `.open-next/worker.js` — so both API
routes (OCR and QR) run server-side on the Workers runtime. **No secrets required.**

### Option A — Git integration (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**, pick
   this repo.
2. Set the **deploy command** to `npm run cf:deploy` (and, if asked for a separate
   build command, `npm run cf:build`).
3. Every push to the production branch redeploys. The Workers AI binding is created
   automatically from `wrangler.jsonc` — nothing to configure.

### Option B — From your machine

```bash
npx wrangler login
npm run cf:deploy
```

The Worker comes up at `https://swisher.<your-subdomain>.workers.dev`. Unlike a
local sandbox, Cloudflare's network can reach `mpc.getswish.net`, so QR codes use
the official getSwish generator (with the local `swish://` QR kept as a fallback),
and Workers AI powers the OCR.
