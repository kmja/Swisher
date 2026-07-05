/**
 * Foreign-exchange lookup → SEK, used to translate international receipts so the
 * split (and the Swish payment, which is SEK-only) works. We use the rate from
 * the day the receipt was printed when we can, since that's what the diners
 * actually paid; otherwise we fall back to the latest rate (flagged approximate).
 * Keyless public endpoints with a small static fallback so a blocked/slow API
 * never breaks a scan. `rate` is always "SEK per 1 unit of the source currency".
 */

// Last-resort approximations (≈ early 2026). Only used when the live providers
// fail; the UI flags these as estimated.
const STATIC_RATES_TO_SEK: Record<string, number> = {
  EUR: 11.4, USD: 10.5, GBP: 13.4, NOK: 0.95, DKK: 1.53, ISK: 0.075,
  CHF: 11.9, JPY: 0.067, CNY: 1.45, THB: 0.30, AUD: 6.8, CAD: 7.6,
  NZD: 6.3, PLN: 2.65, CZK: 0.46, HUF: 0.029, RON: 2.3, BGN: 5.85,
  TRY: 0.26, AED: 2.86, SAR: 2.8, INR: 0.125, IDR: 0.00065, MYR: 2.4,
  SGD: 7.9, HKD: 1.35, KRW: 0.0076, MXN: 0.55, BRL: 1.8, ZAR: 0.57,
  PHP: 0.18, VND: 0.00042, EGP: 0.21, MAD: 1.05, ILS: 2.9, QAR: 2.9,
};

export type FxRate = {
  /** SEK per 1 unit of the source currency. */
  rate: number;
  /** True when this isn't the receipt-date rate (latest or static fallback). */
  approx: boolean;
  /** The date the rate actually applies to, when known (YYYY-MM-DD). */
  date?: string;
};

type FrankfurterResp = { date?: string; rates?: { SEK?: number } };

// A blocked/slow provider must never stall a scan whose OCR already finished —
// the rate fetch runs inside the OCR response. Bound every call so we fall
// through to the next provider (and ultimately the static table) instead.
const FX_TIMEOUT_MS = 2500;

async function frankfurter(url: string): Promise<{ rate: number; date?: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
    if (!r.ok) return null;
    const j = (await r.json()) as FrankfurterResp;
    const sek = j?.rates?.SEK;
    if (typeof sek === "number" && sek > 0) return { rate: sek, date: j.date };
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param currency ISO 4217 code of the receipt's prices.
 * @param date receipt date (YYYY-MM-DD) — used to look up the historical rate.
 */
export async function fetchRateToSek(currency: string, date?: string | null): Promise<FxRate | null> {
  const cur = String(currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return null;
  if (cur === "SEK") return { rate: 1, approx: false };

  const dated = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  // Frankfurter's ECB series starts 1999-01-04; ignore dates outside
  // [that, today] (mis-read years, clock skew) and use the latest rate instead.
  const today = new Date().toISOString().slice(0, 10);
  const histDate = dated && dated >= "1999-01-04" && dated <= today ? dated : null;

  // 1) Frankfurter (ECB reference rates, keyless) on the receipt's date.
  if (histDate) {
    const hit = await frankfurter(`https://api.frankfurter.app/${histDate}?from=${cur}&to=SEK`);
    if (hit) return { rate: hit.rate, approx: false, date: hit.date ?? histDate };
  }

  // 2) Frankfurter latest (covers the same ~31 currencies).
  const latest = await frankfurter(`https://api.frankfurter.app/latest?from=${cur}&to=SEK`);
  if (latest) return { rate: latest.rate, approx: !!histDate, date: latest.date };

  // 3) open.er-api.com latest — keyless, ~160 currencies (no history).
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${cur}`, {
      signal: AbortSignal.timeout(FX_TIMEOUT_MS),
    });
    if (r.ok) {
      const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
      const sek = j?.rates?.SEK;
      if (j.result === "success" && typeof sek === "number" && sek > 0) return { rate: sek, approx: true };
    }
  } catch {
    /* fall through */
  }

  const fb = STATIC_RATES_TO_SEK[cur];
  return fb ? { rate: fb, approx: true } : null;
}
