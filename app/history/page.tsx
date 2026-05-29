"use client";

import { useEffect, useState } from "react";
import { computeRoomShares, formatOre } from "@/lib/money";
import { formatNative, type Fx } from "@/lib/currency";
import { readHistory, removeHistory, type HistoryEntry } from "@/lib/history";
import { readLocalSplit, removeLocalSplit } from "@/lib/local-split";
import LangToggle, { saveLang } from "@/components/LangToggle";
import type { RoomState } from "@/lib/room-do";
import type { Diner } from "@/lib/types";

type Lang = "sv" | "en";

const R = {
  sv: {
    title: "Historik",
    empty: "Inga delade kvitton än.",
    emptyHint: "Skanna ett kvitto och bjud in – så dyker det upp här.",
    newReceipt: "Dela nytt kvitto",
    loading: "Laddar…",
    gone: "Rummet är inte längre tillgängligt",
    remove: "Ta bort",
    host: "Du samlar in",
    guest: "Din del",
    paidOf: (paid: number, total: number) => `${paid} av ${total} betalda`,
    outstanding: (amt: string) => `${amt} kvar att få in`,
    allSettled: "Allt inbetalt ✓",
    youOwe: (amt: string) => `Du ska betala ${amt}`,
    youPaid: "Du har betalat ✓",
    nothing: "Inget att betala",
  },
  en: {
    title: "History",
    empty: "No split receipts yet.",
    emptyHint: "Scan a receipt and invite people — it'll show up here.",
    newReceipt: "Split a new receipt",
    loading: "Loading…",
    gone: "Room no longer available",
    remove: "Remove",
    host: "You collect",
    guest: "Your share",
    paidOf: (paid: number, total: number) => `${paid} of ${total} paid`,
    outstanding: (amt: string) => `${amt} outstanding`,
    allSettled: "All settled ✓",
    youOwe: (amt: string) => `You owe ${amt}`,
    youPaid: "You're paid up ✓",
    nothing: "Nothing to pay",
  },
} as const;

type Summary =
  | { status: "loading" }
  | { status: "gone" }
  | {
      status: "ok";
      place: string;
      date: string;
      isHost: boolean;
      fx: Fx;
      paidCount: number;
      payeeCount: number;
      outstandingOre: number;
      myOre: number;
      iPaid: boolean;
    };

function money(ore: number, fx: Fx): string {
  const native = formatNative(ore, fx);
  return `${formatOre(ore)} SEK${native ? ` · ${native}` : ""}`;
}

export default function HistoryPage() {
  const [lang, setLang] = useState<Lang>("sv");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const t = R[lang];

  useEffect(() => {
    try {
      const l = localStorage.getItem("swisher-lang");
      if (l === "sv" || l === "en") setLang(l);
      else if (typeof navigator !== "undefined" && !navigator.language?.toLowerCase().startsWith("sv")) setLang("en");
    } catch {
      /* ignore */
    }
    setEntries(readHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    entries.forEach((e) => {
      if (e.kind === "local") {
        const split = readLocalSplit(e.id);
        if (!split) {
          setSummaries((prev) => ({ ...prev, [e.id]: { status: "gone" } }));
          return;
        }
        const fx: Fx = split.currency !== "SEK" && split.rate > 0 ? { currency: split.currency, rate: split.rate } : null;
        const paid = new Set(split.paidBy);
        const payees = split.shares.filter((s) => s.totalOre > 0);
        setSummaries((prev) => ({
          ...prev,
          [e.id]: {
            status: "ok",
            place: split.place || "Kvitt",
            date: split.date,
            isHost: true,
            fx,
            paidCount: payees.filter((s) => paid.has(s.id)).length,
            payeeCount: payees.length,
            outstandingOre: payees.filter((s) => !paid.has(s.id)).reduce((a, s) => a + s.totalOre, 0),
            myOre: 0,
            iPaid: false,
          },
        }));
        return;
      }
      setSummaries((prev) => (prev[e.id] ? prev : { ...prev, [e.id]: { status: "loading" } }));
      (async () => {
        try {
          const res = await fetch(`/api/room/${e.id}`, { cache: "no-store" });
          if (!res.ok) {
            if (!cancelled) setSummaries((prev) => ({ ...prev, [e.id]: { status: "gone" } }));
            return;
          }
          const state = (await res.json()) as RoomState;
          let personId: string | null = null;
          try {
            personId = localStorage.getItem(`swisher-room:${e.id}`);
          } catch {
            /* ignore */
          }
          const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
          const { shares } = computeRoomShares(state.items, diners, state.tipOre);
          const paidBy = state.paidBy ?? [];
          const isHost = !!personId && personId === state.payeePersonId;
          const payees = shares.filter((s) => s.dinerId !== state.payeePersonId && s.totalOre > 0);
          const paidCount = payees.filter((s) => paidBy.includes(s.dinerId)).length;
          const outstandingOre = payees
            .filter((s) => !paidBy.includes(s.dinerId))
            .reduce((acc, s) => acc + s.totalOre, 0);
          const mine = shares.find((s) => s.dinerId === personId);
          const fx: Fx =
            state.currency && state.currency !== "SEK" && state.rate > 0
              ? { currency: state.currency, rate: state.rate }
              : null;
          if (!cancelled)
            setSummaries((prev) => ({
              ...prev,
              [e.id]: {
                status: "ok",
                place: state.place || "Kvitt",
                date: state.date,
                isHost,
                fx,
                paidCount,
                payeeCount: payees.length,
                outstandingOre,
                myOre: mine?.totalOre ?? 0,
                iPaid: !!personId && paidBy.includes(personId),
              },
            }));
        } catch {
          /* transient — leave as loading */
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  function remove(id: string) {
    removeHistory(id);
    removeLocalSplit(id);
    setEntries(readHistory());
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-28 pt-5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <LangToggle lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
      </header>

      {entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-gray-500">
          <span className="text-4xl">🧾</span>
          <p className="font-medium">{t.empty}</p>
          <p className="text-sm text-gray-400">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const s = summaries[e.id];
            return (
              <div key={e.id} className="relative rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <a href={e.kind === "local" ? `/split/${e.id}` : `/room/${e.id}`} className="block px-4 py-3 active:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{(s && s.status === "ok" && s.place) || e.place || "Kvitt"}</span>
                    <span className="shrink-0 text-xs text-gray-400">{[(s && s.status === "ok" ? s.date : e.date), e.kind === "room" ? e.id : null].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    {!s || s.status === "loading" ? (
                      <span className="text-gray-400">{t.loading}</span>
                    ) : s.status === "gone" ? (
                      <span className="text-gray-400">{t.gone}</span>
                    ) : s.isHost ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">{t.paidOf(s.paidCount, s.payeeCount)}</span>
                        <span className={s.outstandingOre > 0 ? "font-semibold text-swish-dark" : "font-semibold text-emerald-600"}>
                          {s.outstandingOre > 0 ? t.outstanding(money(s.outstandingOre, s.fx)) : t.allSettled}
                        </span>
                      </div>
                    ) : s.myOre > 0 ? (
                      <span className={s.iPaid ? "font-medium text-emerald-600" : "font-semibold text-swish-dark"}>
                        {s.iPaid ? t.youPaid : t.youOwe(money(s.myOre, s.fx))}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t.nothing}</span>
                    )}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label={t.remove}
                  className="absolute right-1 top-1 px-2 py-1 text-xs text-gray-300 active:text-red-500"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
        <a
          href="/"
          className="mx-auto block max-w-md rounded-xl bg-swish px-5 py-3.5 text-center font-semibold text-white active:bg-swish-dark"
        >
          + {t.newReceipt}
        </a>
      </div>
    </main>
  );
}
