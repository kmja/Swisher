/**
 * Receipt-date display formatting. Two regimes:
 *
 *  - Same calendar year as today → natural-language form with weekday +
 *    ordinal day, in the viewer's locale ("Friday, March 6th" /
 *    "fredag den 6:e mars"). The weekday tells you whether it was the
 *    Friday dinner or the Saturday one without effort.
 *  - Earlier years → fall back to ISO (YYYY-MM-DD). The natural form for a
 *    six-month-old receipt reads as "now-ish" and would be misleading;
 *    ISO is unambiguous and matches the editable date input's own format.
 *
 *  Invalid / empty input is passed through untouched so callers can use
 *  this anywhere a receipt date might be.
 */
import type { Lang } from "./i18n";

// BCP 47 tag per supported UI language, used for Intl date formatting.
const LOCALE_TAG: Record<Lang, string> = {
  sv: "sv-SE", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
  nl: "nl-NL", da: "da-DK", no: "nb-NO", fi: "fi-FI", pl: "pl-PL", pt: "pt-PT",
};

export function formatReceiptDate(iso: string, lang: Lang): string {
  if (!iso) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const thisYear = new Date().getFullYear();
  if (d.getFullYear() !== thisYear) return iso;

  const day = d.getDate();
  if (lang === "sv") {
    // Swedish wants an ordinal suffix and the article "den" — Intl
    // doesn't emit those, so build the string by hand.
    const weekday = new Intl.DateTimeFormat("sv-SE", { weekday: "long" }).format(d);
    const month = new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(d);
    return `${weekday} den ${day}${swedishOrdinalSuffix(day)} ${month}`;
  }
  if (lang === "en") {
    // English convention: ordinal day ("Sunday, March 15th").
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
    return `${weekday}, ${month} ${day}${englishOrdinalSuffix(day)}`;
  }
  // Everyone else: let Intl pick the locale's own ordering and separators
  // (e.g. "Sonntag, 15. März", "dimanche 15 mars", "niedziela, 15 marca").
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

function englishOrdinalSuffix(n: number): string {
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function swedishOrdinalSuffix(n: number): string {
  // Swedish ordinals: 1:a, 2:a, 3:e, 4:e … with 11:e / 12:e the usual
  // teens exception. Only the 1/2 endings take ":a"; everything else ":e".
  const last2 = n % 100;
  if (last2 === 11 || last2 === 12) return ":e";
  const last1 = n % 10;
  if (last1 === 1 || last1 === 2) return ":a";
  return ":e";
}
