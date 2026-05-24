"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import { computeShares, formatOre } from "@/lib/money";
import { translations } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/categories";
import type { RoomState } from "@/lib/room-do";
import type { Diner, LineItem } from "@/lib/types";

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

  async function setTip(percent: number) {
    const res = await fetch(`/api/room/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tip", percent }),
    });
    if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
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

  const { shares, unassignedOre, lineItems } = useMemo(() => {
    if (!state) return { shares: [], unassignedOre: 0, lineItems: [] as LineItem[] };
    const li: LineItem[] = state.items.map((i) => ({
      id: i.id,
      description: i.description,
      priceOre: i.priceOre,
      sharers: i.claimedBy,
    }));
    const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
    const r = computeShares(li, diners, state.tipPercent);
    return { ...r, lineItems: li };
  }, [state]);

  const unclaimedCount = lineItems.filter((i) => i.sharers.length === 0).length;
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
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Swisher</p>
            <p className="text-lg font-bold tracking-widest text-swish-dark">{code}</p>
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
                const groupItems = state.items.filter((it) => categoryFor(it.description, it.category) === cat);
                if (groupItems.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                      <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                      <span>{CATEGORY_LABEL[lang][cat]}</span>
                    </div>
                    {groupItems.map((it) => {
                const mine = it.claimedBy.includes(personId);
                const n = it.claimedBy.length;
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{it.description}</span>
                      {n > 1 && <span className="text-xs text-gray-500">{t.sharedBy(n)} · {t.eachShort(formatOre(Math.floor(it.priceOre / n)))}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">{formatOre(it.priceOre)} {tx.currency}</span>
                  </button>
                );
              })}
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

          {/* Tip — host only */}
          {isPayee && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.tip}</span>
                <span className="text-sm text-gray-600">{state.tipPercent}%</span>
              </div>
              <div className="mt-2 flex gap-2">
                {[0, 5, 10, 15].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTip(p)}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                      state.tipPercent === p ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200"
                    }`}
                  >
                    {p === 0 ? t.none : `${p}%`}
                  </button>
                ))}
              </div>
            </section>
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
              <QrCard name={t.yourTotal} payee={state.payeeNumber} amountOre={myShare.totalOre} message={state.message} t={tx} />
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
