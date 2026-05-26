"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import { computeRoomShares, formatOre } from "@/lib/money";
import { translations } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/categories";
import ItemEmoji from "@/components/ItemEmoji";
import type { RoomState } from "@/lib/room-do";
import type { Diner, Share } from "@/lib/types";

type Lang = "sv" | "en";

const R = {
  sv: {
    loading: "Laddar rummet…",
    notFound: "Hittade inget rum med den koden.",
    unavailable: "Live-rum kräver den driftsatta versionen.",
    toStart: "Till start",
    joinTitle: "Vad heter du?",
    joinHint: "Peta sedan i vad du åt.",
    namePlaceholder: "Ditt namn",
    join: "Gå med",
    joining: "Går med…",
    scanToJoin: "Skanna för att gå med",
    share: "Dela inbjudan",
    copied: "Kopierad!",
    youCollect: "Du samlar in",
    yourShareNote: "Din egen del – du swishar inte dig själv.",
    itemsTitle: "Vad åt du?",
    claimHint: "Tryck på det du åt. Delar ni på något tar ni samma rad.",
    sharedBy: (n: number) => `delas av ${n}`,
    eachShort: (amt: string) => `≈ ${amt} kr/pers`,
    peopleTitle: "Vilka är med",
    unclaimed: (n: number) => `${n} rad${n === 1 ? "" : "er"} ofördelade`,
    allClaimed: "Allt är fördelat",
    claimedTitle: (n: number) => `✓ ${n} klara`,
    you: "du",
    tip: "Dricks",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har inte petat i något än.",
  },
  en: {
    loading: "Loading the room…",
    notFound: "No room found for that code.",
    unavailable: "Live rooms need the deployed version.",
    toStart: "To start",
    joinTitle: "What's your name?",
    joinHint: "Then tap what you had.",
    namePlaceholder: "Your name",
    join: "Join",
    joining: "Joining…",
    scanToJoin: "Scan to join",
    share: "Share invite",
    copied: "Copied!",
    youCollect: "You collect",
    yourShareNote: "Your own share — you don't Swish yourself.",
    itemsTitle: "What did you have?",
    claimHint: "Tap what you had. Sharing something? You both tap it.",
    sharedBy: (n: number) => `shared by ${n}`,
    eachShort: (amt: string) => `≈ ${amt} kr each`,
    peopleTitle: "Who's in",
    unclaimed: (n: number) => `${n} item${n === 1 ? "" : "s"} unassigned`,
    allClaimed: "Everything's assigned",
    claimedTitle: (n: number) => `✓ ${n} claimed`,
    you: "you",
    tip: "Tip",
    none: "None",
    yourTotal: "Your share",
    nothingYet: "You haven't tapped anything yet.",
  },
} as const;

const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function RoomPage() {
  const params = useParams<{ id: string | string[] }>();
  const code = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "").toUpperCase();
  const storageKey = `swisher-room:${code}`;

  const [lang, setLang] = useState<Lang>("sv");
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "unavailable">("loading");
  const [personId, setPersonId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const t = R[lang];
  const tx = translations[lang];

  useEffect(() => {
    try {
      const l = localStorage.getItem("swisher-lang");
      if (l === "sv" || l === "en") setLang(l);
      else if (typeof navigator !== "undefined" && !navigator.language?.toLowerCase().startsWith("sv")) setLang("en");
      const pid = localStorage.getItem(storageKey);
      if (pid) setPersonId(pid);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${code}`, { cache: "no-store" });
      if (res.status === 404) return setStatus("notfound");
      if (res.status === 503) return setStatus("unavailable");
      if (!res.ok) return;
      setState((await res.json()) as RoomState);
      setStatus("ok");
    } catch {
      /* transient network error — keep last state */
    }
  }, [code]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [refresh]);

  // Drop a stale id if the room no longer knows this person.
  useEffect(() => {
    if (state && personId && !state.people.some((p) => p.id === personId)) {
      setPersonId(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [state, personId, storageKey]);

  async function join() {
    if (!name.trim() || joining) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name }),
      });
      if (res.ok) {
        const data = (await res.json()) as { personId: string; state: RoomState };
        setPersonId(data.personId);
        setState(data.state);
        try {
          localStorage.setItem(storageKey, data.personId);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setJoining(false);
    }
  }

  async function toggleClaim(itemId: string) {
    if (!personId) return;
    setBusyItem(itemId);
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", personId, itemId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
    } finally {
      setBusyItem(null);
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Swisher", text: lang === "sv" ? "Gå med och dela notan" : "Join and split the bill", url: shareUrl });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const { shares, unassignedOre } = useMemo(() => {
    if (!state) return { shares: [] as Share[], unassignedOre: 0 };
    const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
    return computeRoomShares(state.items, diners, state.tipOre);
  }, [state]);

  const unclaimedCount = (state?.items ?? []).filter((i) => !i.shared && i.claimedBy.length === 0).length;
  const myShare = shares.find((s) => s.dinerId === personId);
  const isPayee = !!state && personId === state.payeePersonId;
  const nameById = useMemo(() => new Map((state?.people ?? []).map((p) => [p.id, p.name])), [state]);

  if (status === "loading") return <Centered>{t.loading}</Centered>;
  if (status === "notfound") return <Centered><p>{t.notFound}</p><HomeLink label={t.toStart} /></Centered>;
  if (status === "unavailable") return <Centered><p>{t.unavailable}</p><HomeLink label={t.toStart} /></Centered>;
  if (!state) return <Centered>{t.loading}</Centered>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-16 pt-5">
      {/* Share / invite */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{state.place || "Swisher"}</p>
            <p className="text-sm text-gray-500">{[state.date, code].filter(Boolean).join(" · ")}</p>
          </div>
          <button
            type="button"
            onClick={share}
            className="rounded-xl bg-swish px-4 py-2.5 text-sm font-semibold text-white active:bg-swish-dark"
          >
            {copied ? t.copied : t.share}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/room/${code}/qr`} alt={t.scanToJoin} width={84} height={84} className="h-21 w-21 rounded-lg" style={{ height: 84, width: 84 }} />
          <p className="text-sm text-gray-500">{t.scanToJoin}</p>
        </div>
      </section>

      {/* Join, or the claiming UI */}
      {!personId ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h1 className="text-xl font-bold">{t.joinTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">{t.joinHint}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            onKeyDown={(e) => e.key === "Enter" && join()}
            className="mt-3 w-full rounded-xl bg-gray-50 px-4 py-3 outline-none"
          />
          <button
            type="button"
            onClick={join}
            disabled={!name.trim() || joining}
            className="mt-3 w-full rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark disabled:opacity-50"
          >
            {joining ? t.joining : t.join}
          </button>
        </section>
      ) : (
        <>
          <section>
            <h2 className="text-xl font-bold">{t.itemsTitle}</h2>
            <p className="text-sm text-gray-600">{t.claimHint}</p>
            <div className="mt-3 space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const all = state.items.filter((it) => categoryFor(it.description, it.category) === cat);
                if (all.length === 0) return null;
                const isMine = (it: RoomState["items"][number]) => it.claimedBy.includes(personId);
                // Shared items (split across everyone) always stay in the main list.
                // Otherwise: unclaimed items + the ones I claimed; others collapse.
                const mainItems = all.filter((it) => it.shared || it.claimedBy.length === 0 || isMine(it));
                const othersItems = all.filter((it) => !it.shared && it.claimedBy.length > 0 && !isMine(it));
                const peopleCount = Math.max(1, state.people.length);
                const claimers = (it: RoomState["items"][number]) =>
                  it.claimedBy.map((id) => (id === personId ? t.you : nameById.get(id) ?? "?")).join(", ");
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                      <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                      <span>{CATEGORY_LABEL[lang][cat]}</span>
                    </div>
                    {mainItems.map((it) => {
                      const mine = isMine(it);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggleClaim(it.id)}
                          disabled={busyItem === it.id}
                          className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left shadow-sm ring-1 transition ${
                            mine ? "bg-swish/10 ring-swish" : "bg-white ring-black/5"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                              mine ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                              <span aria-hidden className="mr-1"><ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} /></span>
                              {it.description}
                            </span>
                            {it.shared && (
                              <span className="text-[11px] text-swish-dark">{tx.sharedToggle} · {formatOre(it.priceOre)} {tx.currency}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-right text-sm font-semibold">
                            {formatOre(it.shared ? Math.round(it.priceOre / peopleCount) : it.priceOre)} {tx.currency}
                          </span>
                        </button>
                      );
                    })}
                    {othersItems.length > 0 && (
                      <details className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                        <summary className="cursor-pointer text-xs font-medium text-gray-500">{t.claimedTitle(othersItems.length)}</summary>
                        <div className="mt-2 space-y-1">
                          {othersItems.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => toggleClaim(it.id)}
                              disabled={busyItem === it.id}
                              className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm active:bg-gray-100"
                            >
                              <span className="text-emerald-500">✓</span>
                              <span className="min-w-0 flex-1 truncate text-gray-400 line-through">{it.description}</span>
                              <span className="shrink-0 text-xs text-gray-400">{claimers(it)}</span>
                              <span className="shrink-0 text-gray-400 line-through">{formatOre(it.priceOre)}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {unclaimedCount > 0 ? (
              <p className="mt-2 text-xs text-amber-600">{t.unclaimed(unclaimedCount)}</p>
            ) : (
              <p className="mt-2 text-xs text-emerald-600">{t.allClaimed}</p>
            )}
          </section>

          {state.tipOre > 0 && (
            <div className="rounded-2xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              {tx.tipSplitNote(formatOre(state.tipOre))}
            </div>
          )}

          {/* My share + pay */}
          {myShare && (
            isPayee ? (
              <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{t.youCollect}</span>
                  <span className="text-gray-600">{formatOre(myShare.totalOre)} {tx.currency}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{t.yourShareNote}</p>
              </section>
            ) : myShare.totalOre > 0 ? (
              <QrCard name={t.yourTotal} payee={state.payeeNumber} amountOre={myShare.totalOre} message={state.message} t={tx} primaryPay />
            ) : (
              <p className="text-sm text-gray-500">{t.nothingYet}</p>
            )
          )}

          {/* Everyone */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">{t.peopleTitle}</h2>
            <div className="space-y-2">
              {shares.map((s) => (
                <div key={s.dinerId} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-swish/15 text-xs font-bold text-swish-dark">
                    {initials(nameById.get(s.dinerId) ?? "?")}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">
                    {nameById.get(s.dinerId)}
                    {s.dinerId === state.payeePersonId && <span className="ml-1 text-xs text-gray-400">★</span>}
                    {s.dinerId === personId && <span className="ml-1 text-xs text-gray-400">({lang === "sv" ? "du" : "you"})</span>}
                  </span>
                  <span className="text-sm font-semibold">{formatOre(s.totalOre)} {tx.currency}</span>
                </div>
              ))}
            </div>
            {unassignedOre > 0 && (
              <p className="mt-2 text-xs text-amber-600">{formatOre(unassignedOre)} {tx.currency} {lang === "sv" ? "ofördelat" : "unassigned"}</p>
            )}
          </section>
        </>
      )}
    </main>
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
