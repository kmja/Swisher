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

## Configuration

| env var | default | purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | enables receipt OCR; without it, use manual entry |
| `OCR_MODEL` | `claude-sonnet-4-6` | model used for OCR |
