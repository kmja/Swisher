/**
 * Display helpers for receipts read in a foreign currency. All money math stays
 * in SEK öre; these only reconstruct the original-currency amount for display.
 * `rate` = SEK per 1 unit of the native currency, so native = sekÖre/100 / rate.
 */

/** A detected foreign currency + its SEK rate, or null for plain SEK receipts. */
export type Fx = { currency: string; rate: number; approx?: boolean } | null;

/** Format SEK öre back into the receipt's own currency, e.g. 14375 → "€12,50".
 *  Returns null when there's nothing foreign to show. */
export function formatNative(ore: number, fx: Fx): string | null {
  if (!fx || !fx.currency || fx.currency === "SEK" || !fx.rate || fx.rate <= 0) return null;
  const major = ore / 100 / fx.rate;
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: fx.currency,
      currencyDisplay: "narrowSymbol",
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${fx.currency}`;
  }
}

/** Format euro cents as a euro string, e.g. 1250 → "12,50 €" (EPC QR is EUR-only). */
export function formatEur(cents: number): string {
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "EUR", currencyDisplay: "narrowSymbol" }).format(
      cents / 100,
    );
  } catch {
    return `€${(cents / 100).toFixed(2)}`;
  }
}

/** Regional-indicator flag for an ISO 3166-1 alpha-2 code, e.g. "IT" → 🇮🇹. */
export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Localised country name for an alpha-2 code, falling back to the code. */
export function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
