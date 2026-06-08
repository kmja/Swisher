/**
 * The set of UI languages the language picker can offer. We only ship
 * full translations for sv + en today; the rest of the codes here let
 * the dropdown display the right flag + abbreviation while the
 * underlying copy falls back to en via lib/i18n.ts. Adding real
 * translations is a content-only change — wire them into `translations`
 * and they light up everywhere.
 */

import type { Lang } from "./i18n";

export type Locale = {
  code: Lang;
  /** Country flag emoji shown in the picker. */
  flag: string;
  /** Two-letter code surfaced on the closed dropdown / chip. */
  abbr: string;
  /** Native autonym shown next to the flag in the open list. */
  name: string;
};

export const LOCALES: Locale[] = [
  { code: "sv", flag: "🇸🇪", abbr: "SV", name: "Svenska" },
  { code: "en", flag: "🇬🇧", abbr: "EN", name: "English" },
  { code: "de", flag: "🇩🇪", abbr: "DE", name: "Deutsch" },
  { code: "fr", flag: "🇫🇷", abbr: "FR", name: "Français" },
  { code: "es", flag: "🇪🇸", abbr: "ES", name: "Español" },
  { code: "it", flag: "🇮🇹", abbr: "IT", name: "Italiano" },
  { code: "nl", flag: "🇳🇱", abbr: "NL", name: "Nederlands" },
  { code: "da", flag: "🇩🇰", abbr: "DA", name: "Dansk" },
  { code: "no", flag: "🇳🇴", abbr: "NO", name: "Norsk" },
  { code: "fi", flag: "🇫🇮", abbr: "FI", name: "Suomi" },
  { code: "pl", flag: "🇵🇱", abbr: "PL", name: "Polski" },
  { code: "pt", flag: "🇵🇹", abbr: "PT", name: "Português" },
];

export const SUPPORTED_CODES = new Set<Lang>(LOCALES.map((l) => l.code));

export function localeFor(code: Lang): Locale {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[1]; /* en fallback */
}

/** Best-effort ISO 3166-1 alpha-2 country guess. Reads the region tag
 *  off navigator.language first (e.g. "sv-SE" → "SE"), then falls back
 *  to the timezone returned by Intl.DateTimeFormat (e.g.
 *  "Europe/Stockholm" → "SE"). Returns null when neither signal lands
 *  on a known country. */
export function detectCountry(): string | null {
  if (typeof window === "undefined") return null;
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  const parts = nav.split("-");
  if (parts.length > 1) {
    const region = parts[parts.length - 1].toUpperCase();
    if (/^[A-Z]{2}$/.test(region)) return region;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const city = tz.split("/").pop()?.toLowerCase() ?? "";
    // Mapping is intentionally short — just the timezones whose city
    // pin uniquely identifies a country we care about (Sweden vs the
    // rest of Europe, for the Swish-vs-SEPA default).
    if (city === "stockholm") return "SE";
    if (city === "copenhagen") return "DK";
    if (city === "oslo") return "NO";
    if (city === "helsinki") return "FI";
    if (city === "berlin") return "DE";
    if (city === "paris") return "FR";
    if (city === "madrid") return "ES";
    if (city === "rome") return "IT";
    if (city === "amsterdam") return "NL";
    if (city === "warsaw") return "PL";
    if (city === "lisbon") return "PT";
    if (city === "london") return "GB";
  } catch {
    /* Intl unavailable */
  }
  return null;
}

/** Default payout rail for a freshly-opened items page. Swish for
 *  Swedish users, SEPA for everyone else (which is also what the OCR
 *  currency-based override picks once the receipt is parsed). */
export function detectDefaultMethod(): "swish" | "sepa" {
  return detectCountry() === "SE" ? "swish" : "sepa";
}

/** Try to read a previously-pinned language from localStorage; falls
 *  through to navigator.language when there's nothing stored, finally
 *  to "sv" when even that's unavailable. */
export function detectDefaultLang(): Lang {
  if (typeof window === "undefined") return "sv";
  try {
    const stored = localStorage.getItem("swisher-lang");
    if (stored && SUPPORTED_CODES.has(stored as Lang)) return stored as Lang;
  } catch {
    /* storage unavailable */
  }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  const base = nav.toLowerCase().split("-")[0] as Lang;
  if (SUPPORTED_CODES.has(base)) return base;
  return "sv"; /* app is Swedish-first by intent */
}
