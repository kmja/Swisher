"use client";

import { useState } from "react";
import { buildSwishUri } from "@/lib/swish";
import { formatIban } from "@/lib/sepa";
import { formatOre } from "@/lib/money";
import { formatEur } from "@/lib/currency";
import { Money } from "@/components/Money";
import type { Strings } from "@/lib/i18n";

type Props = {
  name: string;
  message: string;
  t: Strings;
  /** Lead with a big pay button (for the diner paying on their own phone). */
  primaryPay?: boolean;
  /** Which rail is primary. SEPA shows an EPC QR; Swish a swish:// QR + link. */
  method?: "swish" | "sepa";
  /** SEK öre — the Swish amount, and the kronor reference shown under EUR. */
  amountOre: number;
  /** Swish payee number. Doubles as the optional "have Swish?" rail for SEPA. */
  swishPayee?: string;
  // SEPA rail
  iban?: string;
  payeeName?: string;
  eurCents?: number;
};

export default function QrCard({
  name,
  message,
  t,
  primaryPay,
  method = "swish",
  amountOre,
  swishPayee,
  iban,
  payeeName,
  eurCents,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [ibanCopied, setIbanCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [noApp, setNoApp] = useState(false);
  const [bigOpen, setBigOpen] = useState(false);

  const isSepa = method === "sepa" && !!iban && typeof eurCents === "number" && eurCents > 0;

  const swishUri = swishPayee ? buildSwishUri({ payee: swishPayee, amountOre, message }) : "";
  const swishQrSrc = swishPayee
    ? `/api/qr?payee=${encodeURIComponent(swishPayee)}&amountOre=${amountOre}&message=${encodeURIComponent(message)}`
    : "";
  const sepaQrSrc =
    isSepa && iban
      ? `/api/qr?method=sepa&iban=${encodeURIComponent(iban)}&name=${encodeURIComponent(payeeName ?? name)}&eurCents=${eurCents}&message=${encodeURIComponent(message)}`
      : "";

  const qrSrc = isSepa ? sepaQrSrc : swishQrSrc;
  const sekAmount = formatOre(amountOre);

  // A swish:// link silently fails when Swish isn't installed; if the page is
  // still visible shortly after tapping, show the QR fallback hint.
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

  async function copyText(text: string, mark: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      mark(true);
      setTimeout(() => mark(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function share() {
    const text = isSepa
      ? `${payeeName ?? name} · IBAN ${formatIban(iban!)} · ${formatEur(eurCents!)} · ${message}`
      : t.shareText(name, sekAmount);
    try {
      if (navigator.share) {
        await navigator.share(isSepa ? { title: t.shareTitle(name), text } : { title: t.shareTitle(name), text, url: swishUri });
        return;
      }
    } catch {
      /* cancelled or unsupported — fall back to copy */
    }
    copyText(isSepa ? text : swishUri, setCopied);
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-lg font-semibold">{name}</h3>
        {isSepa ? (
          <span className="inline-flex shrink-0 flex-col items-end leading-tight text-xl font-bold text-swish-dark">
            <span>{formatEur(eurCents!)}</span>
            <span className="text-xs font-normal text-gray-400">≈ {sekAmount} SEK</span>
          </span>
        ) : (
          <Money ore={amountOre} stack className="shrink-0 text-xl font-bold text-swish-dark" />
        )}
      </div>

      {primaryPay && !isSepa && (
        <>
          <a
            href={swishUri}
            onClick={trackSwishOpen}
            className="mt-4 block rounded-xl bg-swish px-4 py-4 text-center text-base font-bold text-white shadow-sm active:bg-swish-dark"
          >
            {t.payWithSwish(sekAmount)}
          </a>
          <p className="mt-1.5 text-center text-xs text-gray-400">{t.swishOpensApp}</p>
        </>
      )}

      <div className="mt-4 flex justify-center">
        {imgError || !qrSrc ? (
          <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl bg-gray-100 px-4 text-center text-sm text-gray-500">
            {t.qrError}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBigOpen(true)}
            aria-label={t.qrAlt(name)}
            className="overflow-hidden rounded-xl"
          >
            <img
              src={qrSrc}
              alt={t.qrAlt(name)}
              width={260}
              height={260}
              className="h-[260px] w-[260px] rounded-xl"
              onError={() => setImgError(true)}
            />
          </button>
        )}
      </div>

      {isSepa ? (
        <>
          <p className="mt-3 text-center text-xs font-medium text-gray-600">{t.sepaScan}</p>
          <p className="mt-0.5 text-center text-xs text-gray-400">{t.sepaTo(payeeName ?? name)}</p>
          <button
            type="button"
            onClick={() => copyText(formatIban(iban!), setIbanCopied)}
            className="mt-2 w-full truncate rounded-xl bg-gray-50 px-3 py-2 text-center font-mono text-sm tracking-wide text-ink active:bg-gray-100"
          >
            {ibanCopied ? t.ibanCopied : formatIban(iban!)}
          </button>
          {swishPayee && (
            <a
              href={swishUri}
              onClick={trackSwishOpen}
              className="mt-3 block rounded-xl bg-swish/10 px-4 py-2.5 text-center text-sm font-semibold text-swish-dark active:bg-swish/20"
            >
              {t.haveSwish(sekAmount)}
            </a>
          )}
          <button
            type="button"
            onClick={share}
            className="mt-2 w-full rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-ink active:bg-gray-200"
          >
            {copied ? t.copied : t.shareLink}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-center text-xs text-gray-500">{t.qrLockedTo(swishPayee ?? "")}</p>
          <div className={`mt-4 grid gap-2 ${primaryPay ? "grid-cols-1" : "grid-cols-2"}`}>
            {!primaryPay && (
              <a
                href={swishUri}
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
        </>
      )}
      {bigOpen && !imgError && qrSrc && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setBigOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4"
        >
          <p className="text-center text-lg font-semibold text-white">{name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={t.qrAlt(name)}
            className="aspect-square w-full max-w-[min(80vw,80vh,520px)] rounded-2xl bg-white p-3"
          />
          <button
            type="button"
            onClick={() => setBigOpen(false)}
            className="rounded-full bg-white/15 px-6 py-2 text-sm font-medium text-white active:bg-white/25"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
