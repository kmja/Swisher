"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  qrSrc: string;
  title: string;
  /** Pre-formatted receipt date shown as the centred sub-header
   *  under the title — same hierarchy the room page's top section
   *  uses (h1 + date line). */
  date?: string;
  subtitle?: string;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
  /** When set, show a small "save image" link with this filename. */
  download?: string;
  /** Bounding rect of the element the dialog should "grow out of" —
   *  usually the share-trigger button. The panel animates from that
   *  rect to its centred resting position on open, and back into it
   *  on close. */
  origin?: DOMRect | null;
  labels: {
    share: string;
    copied: string;
    copyLink: string;
    close: string;
    save?: string;
  };
};

/**
 * A full-screen overlay with a large QR for handing the phone across the
 * table. Used for room invites and (later) per-person pay QRs.
 */
export default function QrDialog({
  open,
  onClose,
  qrSrc,
  title,
  date,
  subtitle,
  shareUrl,
  shareTitle,
  shareText,
  download,
  origin,
  labels,
}: Props) {
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the dialog rendered through its closing animation. `mounted`
  // tracks the DOM presence; `open` tracks the parent's intent. We
  // unmount only AFTER the close keyframe finishes.
  const [mounted, setMounted] = useState(open);
  // Cache the most recent origin so the closing animation lands back
  // at the same trigger even if the parent has nulled it out by the
  // time onClose fires.
  const lastOriginRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (origin) lastOriginRef.current = origin;
    }
  }, [open, origin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the dialog is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  /** Opening + closing animations. Both keyframes pivot around the
   *  cached origin rect so the dialog literally grows out of (and
   *  collapses back into) the share-trigger button. Falls back to a
   *  centred scale/fade when no origin is available. */
  useLayoutEffect(() => {
    if (!mounted || !panelRef.current || typeof panelRef.current.animate !== "function") return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const used = open ? (origin ?? lastOriginRef.current) : lastOriginRef.current;
    // Backdrop fades on its own curve so the dark layer arrives /
    // leaves independently of the panel.
    if (backdrop?.animate) {
      backdrop.animate(
        open ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        { duration: open ? 220 : 220, easing: open ? "ease-out" : "ease-in", fill: "forwards" },
      );
    }
    let anim: Animation;
    if (used) {
      const target = panel.getBoundingClientRect();
      const sx = Math.max(0.04, used.width / target.width);
      const sy = Math.max(0.04, used.height / target.height);
      const dx = used.left + used.width / 2 - (target.left + target.width / 2);
      const dy = used.top + used.height / 2 - (target.top + target.height / 2);
      const big = { transform: "translate(0, 0) scale(1, 1)", opacity: 1 };
      const small = { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 };
      anim = panel.animate(
        open ? [small, big] : [big, small],
        { duration: open ? 320 : 260, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "forwards" },
      );
    } else {
      const big = { transform: "scale(1)", opacity: 1 };
      const small = { transform: "scale(0.92)", opacity: 0 };
      anim = panel.animate(
        open ? [small, big] : [big, small],
        { duration: open ? 220 : 200, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "forwards" },
      );
    }
    if (!open) {
      anim.onfinish = () => setMounted(false);
    }
    return () => {
      // Don't cancel mid-flight — we want the onfinish handler to
      // unmount the closing dialog. Only cancel if a NEW open/close
      // toggle starts before the current finishes, which the next
      // effect run will recreate cleanly anyway.
    };
  }, [open, mounted, origin]);

  if (!mounted) return null;

  async function doShare() {
    if (shareUrl && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle ?? title, text: shareText, url: shareUrl });
        return;
      } catch {
        /* user cancelled or unsupported — fall back to copy */
      }
    }
    doCopy();
  }
  async function doCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Dim backdrop — its own layer so opacity can fade
          independently of the panel's transform / opacity. */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
        aria-hidden
      />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md origin-center rounded-3xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="absolute right-3 top-3 flex h-16 w-16 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
        >
          {/* Use an SVG × instead of the unicode glyph so the cross
              fills the button instead of riding small in the centre
              of the font's em-box. Stroke width matches the dialog
              chrome weight. */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden>
            <path d="M6 6 L18 18 M6 18 L18 6" />
          </svg>
        </button>
        {/* Header block mirrors the room-page top-section hierarchy:
            text-xl font-bold for the place / title and a mt-0.5
            text-sm text-gray-500 line underneath for the date.
            Equal pl/pr leaves room for the close button on the
            right while keeping the text dead-centred. */}
        <p className="truncate px-16 text-center text-xl font-bold text-ink">{title}</p>
        {date && <p className="mt-0.5 truncate px-16 text-center text-sm text-gray-500">{date}</p>}
        <div className="mx-auto mt-4 aspect-square w-full max-w-[min(80vw,80vh,420px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt={title} className="h-full w-full rounded-2xl object-contain" />
        </div>
        {subtitle && <p className="mt-3 text-center text-sm text-gray-500">{subtitle}</p>}
        {shareUrl && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={doShare}
              className="flex items-center justify-center gap-2 rounded-xl bg-swish px-4 py-3 text-sm font-semibold text-white active:bg-swish-dark"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {labels.share}
            </button>
            <button
              type="button"
              onClick={doCopy}
              className={`flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold shadow-sm active:bg-gray-200 ${copied ? "text-emerald-600" : "text-ink"}`}
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H9Z" />
                  <path d="M5 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1" />
                </svg>
              )}
              {copied ? labels.copied : labels.copyLink}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
