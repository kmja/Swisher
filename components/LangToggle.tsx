"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { LOCALES, localeFor } from "@/lib/locales";

/** Dropdown that opens to the supported European languages. Replaces
 *  the old SV/EN pill — same `lang` + `onChange` contract so every
 *  call site picks up the new UI for free. Closed state shows just
 *  the active flag + 2-letter abbreviation; open state lists every
 *  supported locale as a flag + abbreviation + autonym row. */
export default function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = localeFor(lang);

  // Close on outside click + Escape so the menu doesn't strand if the
  // user taps elsewhere on the page.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={active.name}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-semibold text-gray-700 active:bg-gray-100"
      >
        <span aria-hidden className="text-xl leading-none">{active.flag}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full z-50 mt-1 max-h-[60vh] w-44 overflow-y-auto rounded-xl bg-white py-1 text-sm font-medium shadow-xl ring-1 ring-black/10"
        >
          {LOCALES.map((l) => {
            const selected = l.code === lang;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                    selected ? "bg-swish/10 text-swish-dark" : "text-gray-700 active:bg-gray-100"
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">{l.flag}</span>
                  <span className="w-7 shrink-0 tabular-nums">{l.abbr}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{l.name}</span>
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-swish-dark" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
