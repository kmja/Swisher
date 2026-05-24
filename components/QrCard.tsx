"use client";

import { useState } from "react";
import { buildSwishUri } from "@/lib/swish";
import { formatOre } from "@/lib/money";
import type { Strings } from "@/lib/i18n";

type Props = {
  name: string;
  payee: string;
  amountOre: number;
  message: string;
  t: Strings;
  /** Lead with a big "Pay … with Swish" button (for the diner paying on their own phone). */
  primaryPay?: boolean;
};

export default function QrCard({ name, payee, amountOre, message, t, primaryPay }: Props) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [noApp, setNoApp] = useState(false);

  const uri = buildSwishUri({ payee, amountOre, message });
  const qrSrc = `/api/qr?payee=${encodeURIComponent(payee)}&amountOre=${amountOre}&message=${encodeURIComponent(message)}`;
  const amount = formatOre(amountOre);

  // A swish:// link silently fails (or shows the browser's own error) when the
  // Swish app isn't installed. Tapping should hide the page; if we're still
  // visible shortly after, the app didn't open — show the QR fallback hint.
  function trackSwishOpen() {
    setNoApp(false);
    let done = false;
    const finish = () => {
      done = true;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", finish);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") finish();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", finish);
    setTimeout(() => {
      if (!done && document.visibilityState === "visible") setNoApp(true);
      finish();
    }, 2000);
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: t.shareTitle(name), text: t.shareText(name, amount), url: uri });
        return;
      }
    } catch {
      /* user cancelled or unsupported — fall back to copy */
    }
    copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-lg font-semibold">{name}</h3>
        <span className="shrink-0 text-xl font-bold text-swish-dark">
          {amount} {t.currency}
        </span>
      </div>

      {primaryPay && (
        <>
          <a
            href={uri}
            onClick={trackSwishOpen}
            className="mt-4 block rounded-xl bg-swish px-4 py-4 text-center text-base font-bold text-white shadow-sm active:bg-swish-dark"
          >
            {t.payWithSwish(amount)}
          </a>
          <p className="mt-1.5 text-center text-xs text-gray-400">{t.swishOpensApp}</p>
        </>
      )}

      <div className="mt-4 flex justify-center">
        {imgError ? (
          <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl bg-gray-100 px-4 text-center text-sm text-gray-500">
            {t.qrError}
          </div>
        ) : (
          <img
            src={qrSrc}
            alt={t.qrAlt(name)}
            width={260}
            height={260}
            className="h-[260px] w-[260px] rounded-xl"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <p className="mt-3 text-center text-xs text-gray-500">{t.qrLockedTo(payee)}</p>

      <div className={`mt-4 grid gap-2 ${primaryPay ? "grid-cols-1" : "grid-cols-2"}`}>
        {!primaryPay && (
          <a
            href={uri}
            onClick={trackSwishOpen}
            className="rounded-xl bg-swish px-4 py-3 text-center text-sm font-semibold text-white active:bg-swish-dark"
          >
            {t.openSwish}
          </a>
        )}
        <button
          type="button"
          onClick={share}
          className="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-ink active:bg-gray-200"
        >
          {copied ? t.copied : t.shareLink}
        </button>
      </div>

      {noApp && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 ring-1 ring-amber-200">
          {t.noSwishApp}
        </p>
      )}
    </div>
  );
}
