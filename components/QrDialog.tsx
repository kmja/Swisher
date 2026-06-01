"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  qrSrc: string;
  title: string;
  subtitle?: string;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
  /** When set, show a small "save image" link with this filename. */
  download?: string;
  /** Bounding rect of the element the dialog should "grow out of" —
   *  usually the share-trigger button. The panel animates from that
   *  rect to its centred resting position on open. */
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

  /** Grow-from-origin animation: when the dialog mounts with an
   *  `origin` rect we run the panel from that rect's position +
   *  size to its centred resting frame. Backdrop fades in parallel
   *  on its own curve. Without an `origin` we fall back to a plain
   *  centred fade so old callers keep their previous look. */
  useLayoutEffect(() => {
    if (!open || !panelRef.current || typeof panelRef.current.animate !== "function") return;
    if (backdropRef.current?.animate) {
      backdropRef.current.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, easing: "ease-out", fill: "backwards" },
      );
    }
    const panel = panelRef.current;
    if (origin) {
      const target = panel.getBoundingClientRect();
      const scaleX = Math.max(0.04, origin.width / target.width);
      const scaleY = Math.max(0.04, origin.height / target.height);
      const dx = origin.left + origin.width / 2 - (target.left + target.width / 2);
      const dy = origin.top + origin.height / 2 - (target.top + target.height / 2);
      panel.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, opacity: 0 },
          { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
        ],
        { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
      );
    } else {
      panel.animate(
        [
          { transform: "scale(0.92)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 220, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
      );
    }
  }, [open, origin]);

  if (!open) return null;

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
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md origin-center rounded-3xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-400 active:bg-gray-100"
        >
          ×
        </button>
        <p className="truncate pr-10 text-center text-lg font-bold">{title}</p>
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
              className="rounded-xl bg-swish px-4 py-3 text-sm font-semibold text-white active:bg-swish-dark"
            >
              {labels.share}
            </button>
            <button
              type="button"
              onClick={doCopy}
              className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-ink active:bg-gray-200"
            >
              {copied ? labels.copied : labels.copyLink}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
