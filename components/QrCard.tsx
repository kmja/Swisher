"use client";

import { useState } from "react";
import { buildSwishUri } from "@/lib/swish";
import { formatOre } from "@/lib/money";

type Props = {
  name: string;
  payee: string;
  amountOre: number;
  message: string;
};

export default function QrCard({ name, payee, amountOre, message }: Props) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const uri = buildSwishUri({ payee, amountOre, message });
  const qrSrc = `/api/qr?payee=${encodeURIComponent(payee)}&amountOre=${amountOre}&message=${encodeURIComponent(message)}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Swish – ${name}`, text: `${name}: ${formatOre(amountOre)} kr`, url: uri });
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
        <span className="shrink-0 text-xl font-bold text-swish-dark">{formatOre(amountOre)} kr</span>
      </div>

      <div className="mt-4 flex justify-center">
        {imgError ? (
          <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl bg-gray-100 px-4 text-center text-sm text-gray-500">
            Kunde inte skapa QR-kod. Använd länken nedan.
          </div>
        ) : (
          <img
            src={qrSrc}
            alt={`Swish QR-kod för ${name}`}
            width={260}
            height={260}
            className="h-[260px] w-[260px] rounded-xl"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <p className="mt-3 text-center text-xs text-gray-500">
        Skanna med valfri telefon · betalningen är låst till {payee}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={uri}
          className="rounded-xl bg-swish px-4 py-3 text-center text-sm font-semibold text-white active:bg-swish-dark"
        >
          Öppna Swish
        </a>
        <button
          type="button"
          onClick={share}
          className="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-ink active:bg-gray-200"
        >
          {copied ? "Kopierad!" : "Dela länk"}
        </button>
      </div>
    </div>
  );
}
