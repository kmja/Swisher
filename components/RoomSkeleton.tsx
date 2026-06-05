"use client";

import { useCallback, useEffect, useState } from "react";
import KvittLogo from "./KvittLogo";
import LangToggle from "./LangToggle";
import StepHeader, { type WizardStep } from "./StepHeader";
import { translations, type Lang } from "@/lib/i18n";

/**
 * Skeleton of the room page, shown the instant the host taps "Skapa
 * rum" (and again on the real room page while state is still being
 * fetched). Renders the *real* chrome — sticky nav with the
 * KvittLogo + +/history/lang controls, the wizard step strip — and
 * only swaps in placeholder bars for the live content (place name,
 * QR, items). That way the swap from skeleton → real room is just a
 * content fade-in, no header / step-bar flicker.
 *
 * The `play` flag enables the slide-from-right entry animation. It's
 * on when the items page mounts the skeleton as a wizard-step
 * overlay; it's off when the room page renders it as its own
 * initial-loading state (otherwise we'd double up with the page's
 * own playRoomEnter).
 */
export default function RoomSkeleton({ play = false }: { play?: boolean }) {
  // Mirror the items / room page's lang persistence so the skeleton's
  // SV/EN pill matches the user's choice instead of forcing "sv".
  const [lang, setLang] = useState<Lang>("sv");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("swisher-lang");
      if (stored === "sv" || stored === "en") setLang(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const t = translations[lang];

  // When the skeleton mounts because the items page is sliding into
  // the room (play=true), start the step strip at the previous pill
  // ("Verify") and flip to "Share" one frame later so the CSS color
  // transitions on StepHeader interpolate live alongside the slide.
  // Room-page loading-state mounts (play=false) just render "Share"
  // directly — there's no "from" step to animate from.
  const [pillStep, setPillStep] = useState<WizardStep>(play ? "verify" : "share");
  useEffect(() => {
    if (!play) return;
    const id = requestAnimationFrame(() => setPillStep("share"));
    return () => cancelAnimationFrame(id);
  }, [play]);

  const playEnter = useCallback(
    (el: HTMLElement | null) => {
      if (!play || !el || typeof el.animate !== "function") return;
      el.animate(
        [
          { opacity: 0, transform: "translateX(100%)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
      );
    },
    [play],
  );

  return (
    <main className="fixed inset-0 z-40 mx-auto flex min-h-dvh max-w-md flex-col gap-4 overflow-y-auto px-4 pb-32">
      {/* Real nav — three-col grid matching the room page so the swap
          when state loads doesn't redraw the header. */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex items-center gap-2 justify-self-start">
            <a
              href="/"
              aria-label={t.newReceipt}
              title={t.newReceipt}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-swish text-2xl font-semibold leading-none text-white shadow-sm active:bg-swish-dark"
            >
              +
            </a>
            <a
              href="/history"
              aria-label={t.history}
              title={t.history}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl text-swish-dark active:bg-gray-200"
            >
              🕘
            </a>
          </div>
          <KvittLogo className="justify-self-center" />
          <div className="justify-self-end">
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      {/* Real step strip — the host's "Share" pill is active.
          Wrapper carries an explicit page-bg colour so it occludes
          the outgoing items page's "Verify" step strip directly
          underneath (both render at the same y-position, and the
          skeleton's main is otherwise transparent so the exiting
          body content can slide out visibly). */}
      <div className="bg-[#f0f0f4]">
        <StepHeader step={pillStep} t={t} />
      </div>

      {/* Slide-in wrapper. Only the body (placeholder cards + item
          rows) slides in; the nav + step strip above stay anchored
          so the wizard chrome reads as continuous between steps. */}
      <div ref={playEnter} className="flex flex-col gap-4">

      {/* Top section — placeholder bars for place / date / QR / share
          buttons. Shape matches the live top section so the layout
          doesn't shift when real data lands. */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="skel-shimmer h-6 w-3/5 rounded" />
            <div className="skel-shimmer-light mt-2 h-4 w-2/5 rounded" />
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="skel-shimmer-light h-[88px] w-[88px] rounded-lg" />
            <div className="flex flex-col gap-2">
              <div className="skel-shimmer-light h-11 w-11 rounded-xl" />
              <div className="skel-shimmer-light h-11 w-11 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="skel-shimmer-light h-12 rounded-xl" />
          <div className="skel-shimmer-light h-12 rounded-xl" />
        </div>
        <div className="skel-shimmer-light mt-3 h-12 rounded-xl" />
      </section>

      {/* Items list placeholder — six rows of varying widths. */}
      <section className="flex flex-col gap-2">
        <div className="skel-shimmer h-5 w-24 rounded" />
        {[80, 65, 75, 60, 70, 55].map((w, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="skel-shimmer-light h-6 w-6 rounded-full" />
            <div className="skel-shimmer-light h-4 rounded" style={{ width: `${w}%` }} />
            <div className="skel-shimmer-light ml-auto h-4 w-14 rounded" />
          </div>
        ))}
      </section>
      </div>
    </main>
  );
}
