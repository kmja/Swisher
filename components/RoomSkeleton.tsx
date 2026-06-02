"use client";

import { useCallback } from "react";
import KvittLogo from "./KvittLogo";

/**
 * Skeleton of the room page, shown the instant the host taps "Skapa rum"
 * (and again on the real room page while state is still being fetched).
 * Same chrome + section shapes as the real room so the eventual swap from
 * skeleton → real content doesn't shift layout.
 *
 * The `play` flag enables the slide-from-right entry animation. It's on
 * when the items page mounts the skeleton as an overlay, and off when the
 * room page renders it as its own initial-loading state (so the page's
 * own playRoomEnter doesn't double-fire with this one).
 */
export default function RoomSkeleton({ play = false }: { play?: boolean }) {
  const playEnter = useCallback(
    (el: HTMLElement | null) => {
      if (!play || !el || typeof el.animate !== "function") return;
      el.animate(
        [
          { opacity: 0, transform: "translateX(36px)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
      );
    },
    [play],
  );

  return (
    <main
      ref={playEnter}
      className="fixed inset-0 z-40 mx-auto flex min-h-dvh max-w-md flex-col gap-4 overflow-y-auto bg-[#f0f0f4] px-4 pb-32"
    >
      {/* Header — matches the room page exactly so the swap is invisible. */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="h-11 w-11 rounded-xl bg-swish/70 justify-self-start" aria-hidden />
          <KvittLogo className="justify-self-center" />
          <div className="flex items-center gap-2 justify-self-end">
            <div className="h-11 w-11 rounded-xl bg-gray-100" aria-hidden />
            <div className="h-11 w-16 rounded-xl bg-gray-100" aria-hidden />
          </div>
        </div>
      </header>

      {/* Top section — title block left, QR + icons right. Bars sized
          to roughly match the real content so nothing shifts when the
          actual data lands. */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="h-6 w-3/5 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-2/5 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="h-[88px] w-[88px] animate-pulse rounded-lg bg-gray-100" />
            <div className="flex flex-col gap-2">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        </div>
        <div className="mt-3 h-12 animate-pulse rounded-xl bg-gray-100" />
      </section>

      {/* Items list placeholder — six rows of varying widths. */}
      <section className="flex flex-col gap-2">
        <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        {[80, 65, 75, 60, 70, 55].map((w, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: `${w}%` }} />
            <div className="ml-auto h-4 w-14 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </section>
    </main>
  );
}
