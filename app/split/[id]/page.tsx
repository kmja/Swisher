"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import { FxProvider } from "@/components/Money";
import { formatOre } from "@/lib/money";
import { formatNative, flagEmoji, regionName, type Fx } from "@/lib/currency";
import { translations } from "@/lib/i18n";
import { readLocalSplit, toggleLocalPaid, type LocalSplit } from "@/lib/local-split";

type Lang = "sv" | "en";

const R = {
  sv: {
    loading: "Laddar…",
    notFound: "Den här delningen finns bara på telefonen den skapades på.",
    toStart: "Till start",
    newReceipt: "Nytt kvitto",
    history: "Historik",
    collect: "Att få in",
    allPaid: "Allt inbetalt ✓",
    paidOf: (paid: number, total: number) => `${paid} av ${total} betalda`,
    paid: "Betald",
    markPaid: "Markera betald",
  },
  en: {
    loading: "Loading…",
    notFound: "This split only exists on the device it was created on.",
    toStart: "To start",
    newReceipt: "New receipt",
    history: "History",
    collect: "To collect",
    allPaid: "All settled ✓",
    paidOf: (paid: number, total: number) => `${paid} of ${total} paid`,
    paid: "Paid",
    markPaid: "Mark paid",
  },
} as const;

function money(ore: number, fx: Fx): string {
  const native = formatNative(ore, fx);
  return `${formatOre(ore)} kr${native ? ` · ${native}` : ""}`;
}

export default function SplitPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "");

  const [lang, setLang] = useState<Lang>("sv");
  const [split, setSplit] = useState<LocalSplit | null | undefined>(undefined);

  const t = R[lang];
  const tx = translations[lang];

  useEffect(() => {
    try {
      const l = localStorage.getItem("swisher-lang");
      if (l === "sv" || l === "en") setLang(l);
      else if (typeof navigator !== "undefined" && !navigator.language?.toLowerCase().startsWith("sv")) setLang("en");
    } catch {
      /* ignore */
    }
    setSplit(readLocalSplit(id));
  }, [id]);

  function toggle(shareId: string) {
    const next = toggleLocalPaid(id, shareId);
    if (next) setSplit({ ...next });
  }

  if (split === undefined) return <Centered>{t.loading}</Centered>;
  if (!split)
    return (
      <Centered>
        <p>{t.notFound}</p>
        <HomeLink label={t.toStart} />
      </Centered>
    );

  const fx: Fx = split.currency !== "SEK" && split.rate > 0 ? { currency: split.currency, rate: split.rate } : null;
  const paid = new Set(split.paidBy);
  const payees = split.shares.filter((s) => s.totalOre > 0);
  const paidCount = payees.filter((s) => paid.has(s.id)).length;
  const outstanding = payees.filter((s) => !paid.has(s.id)).reduce((a, s) => a + s.totalOre, 0);
  const eurCentsFor = (ore: number) => (split.rate > 0 ? Math.round(ore / split.rate) : 0);

  return (
    <FxProvider value={fx}>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-16 pt-5">
        <nav className="flex items-center justify-between text-xs font-semibold">
          <a href="/" className="inline-flex items-center gap-1 rounded-full bg-swish px-3 py-1.5 text-white active:bg-swish-dark">
            + {t.newReceipt}
          </a>
          <a href="/history" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-swish-dark ring-1 ring-gray-200 active:bg-gray-100">
            🕘 {t.history}
          </a>
        </nav>

        <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="truncate text-lg font-bold">{split.place || "Swisher"}</p>
          <p className="text-sm text-gray-500">{split.date}</p>
          {fx && (
            <p className="mt-0.5 text-xs text-gray-400">
              {split.country ? `${flagEmoji(split.country)} ${regionName(split.country, lang)} · ` : ""}
              {`1 ${fx.currency} ≈ ${formatOre(Math.round(fx.rate * 100))} kr`}
            </p>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-gray-100 pt-2">
            <span className="text-sm text-gray-500">{outstanding > 0 ? t.paidOf(paidCount, payees.length) : t.allPaid}</span>
            {outstanding > 0 && <span className="font-semibold text-swish-dark">{money(outstanding, fx)}</span>}
          </div>
        </header>

        <div className="space-y-3">
          {payees.map((s) =>
            paid.has(s.id) ? (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-black/5"
              >
                <span className="font-medium text-emerald-600">✓ {s.name}</span>
                <span className="text-sm text-gray-400 line-through">{money(s.totalOre, fx)}</span>
              </button>
            ) : (
              <div key={s.id}>
                <QrCard
                  name={s.name}
                  method={split.method === "sepa" ? "sepa" : "swish"}
                  amountOre={s.totalOre}
                  swishPayee={split.payeeNumber || undefined}
                  iban={split.method === "sepa" ? split.payeeIban : undefined}
                  payeeName={split.payeeName}
                  eurCents={split.method === "sepa" ? eurCentsFor(s.totalOre) : undefined}
                  message={split.message}
                  t={tx}
                />
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="mt-2 w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-ink active:bg-gray-200"
                >
                  {t.markPaid}
                </button>
              </div>
            ),
          )}
        </div>
      </main>
    </FxProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center text-gray-600">
      {children}
    </main>
  );
}

function HomeLink({ label }: { label: string }) {
  return (
    <a href="/" className="rounded-xl bg-swish px-5 py-2.5 text-sm font-semibold text-white active:bg-swish-dark">
      {label}
    </a>
  );
}
