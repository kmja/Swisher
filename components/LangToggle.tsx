"use client";

import type { Lang } from "@/lib/i18n";

/** SV/EN toggle pill; controlled by the parent's lang state. */
export default function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-white text-xs font-semibold ring-1 ring-gray-200">
      {(["sv", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`px-3 py-1.5 ${lang === l ? "bg-swish text-white" : "text-gray-500 active:bg-gray-100"}`}
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
