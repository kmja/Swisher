"use client";

import type { Lang } from "@/lib/i18n";

/** SV/EN toggle pill; controlled by the parent's lang state.
 *  The non-active half wears an inset ring so it reads as its own
 *  outlined button — without it the white toggle blends straight
 *  into the white header backdrop and only the pink active half
 *  is visible. (Container ring dropped; if we kept it the inactive
 *  half would render with a 2 px doubled outline at three of its
 *  edges where its ring met the container's.) */
export default function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-white text-sm font-semibold shadow-sm">
      {(["sv", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`px-3 py-2 ${
            lang === l
              ? "bg-swish text-black"
              : "text-gray-500 ring-1 ring-inset ring-gray-200 active:bg-gray-100"
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
