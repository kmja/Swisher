"use client";

import type { Lang } from "@/lib/i18n";

/** SV/EN toggle pill; controlled by the parent's lang state.
 *  Outline lives on the CONTAINER now (ring-2 ring-gray-300) so it
 *  frames the whole pill as one shape. The inactive half no longer
 *  carries its own inset ring — that's what made the left edge of
 *  the inactive button look like a stray pinstripe meeting the pink
 *  active half. Active = pink fill; inactive = plain white inside
 *  the framed pill. */
export default function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-white text-sm font-semibold shadow-sm ring-2 ring-gray-300">
      {(["sv", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`px-3 py-2 ${
            lang === l
              ? "bg-swish text-white"
              : "text-gray-500 active:bg-gray-100"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Persist the choice so other views pick it up too. */
export function saveLang(lang: Lang) {
  try {
    localStorage.setItem("swisher-lang", lang);
  } catch {
    /* storage unavailable */
  }
}
