"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import { computeRoomShares, formatOre, parseAmountToOre } from "@/lib/money";
import { translations } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/categories";
import ItemEmoji from "@/components/ItemEmoji";
import QrDialog from "@/components/QrDialog";
import { Money, FxProvider } from "@/components/Money";
import { flagEmoji, regionName, type Fx } from "@/lib/currency";
import { addHistory } from "@/lib/history";
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
    copyLink: "Kopiera länk",
    close: "Stäng",
    youCollect: "Du samlar in",
    yourShareNote: "Din egen del – du swishar inte dig själv.",
    remainingToCollect: "Kvar att få in",
    paidProgress: (paid: number, total: number) => `${paid} av ${total} har betalat`,
    allCollected: "Allt inbetalt ✓",
    ownShare: "Din egen del",
    dontPaySelf: "du betalar inte dig själv",
    itemsTitle: "Vad åt du?",
    claimHint: "Tryck på det du åt. Delar ni på något tar ni samma rad.",
    sharedSection: "Delas av alla",
    sharedBy: (n: number) => `delas av ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK/pers`,
    peopleTitle: "Vilka är med",
    unclaimed: (n: number) => `${n} rad${n === 1 ? "" : "er"} ofördelade`,
    allClaimed: "Allt är fördelat",
    claimedTitle: (n: number) => `✓ ${n} klara`,
    you: "du",
    tip: "Dricks",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har inte petat i något än.",
    paid: "Betald",
    markPaid: "Markera betald",
    newReceipt: "Nytt kvitto",
    history: "Historik",
    editItems: "Rätta rader",
    editRow: "Rätta rad",
    doneEditing: "Klar",
    addRow: "Lägg till rad",
    descPh: "Beskrivning",
    pricePh: "0,00",
    removeRow: "Ta bort rad",
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
    copyLink: "Copy link",
    close: "Close",
    youCollect: "You collect",
    yourShareNote: "Your own share — you don't Swish yourself.",
    remainingToCollect: "Remaining to collect",
    paidProgress: (paid: number, total: number) => `${paid} of ${total} paid`,
    allCollected: "All collected ✓",
    ownShare: "Your own share",
    dontPaySelf: "you don't pay yourself",
    itemsTitle: "What did you have?",
    claimHint: "Tap what you had. Sharing something? You both tap it.",
    sharedSection: "Shared by everyone",
    sharedBy: (n: number) => `shared by ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK each`,
    peopleTitle: "Who's in",
    unclaimed: (n: number) => `${n} item${n === 1 ? "" : "s"} unassigned`,
    allClaimed: "Everything's assigned",
    claimedTitle: (n: number) => `✓ ${n} claimed`,
    you: "you",
    tip: "Tip",
    none: "None",
    yourTotal: "Your share",
    nothingYet: "You haven't tapped anything yet.",
    paid: "Paid",
    markPaid: "Mark paid",
    newReceipt: "New receipt",
    history: "History",
    editItems: "Fix items",
    editRow: "Edit item",
    doneEditing: "Done",
    addRow: "Add item",
    descPh: "Description",
    pricePh: "0.00",
    removeRow: "Remove row",
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
  const [shareOpen, setShareOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");

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
    // Pause live polling while editing/adding an item, so it can't clobber inputs.
    if (editingItemId || addingItem) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [refresh, editingItemId, addingItem]);

  // Remember this room locally so it shows up in history.
  useEffect(() => {
    if (state && personId) {
      addHistory({
        id: code,
        place: state.place,
        date: state.date,
        role: personId === state.payeePersonId ? "host" : "guest",
      });
    }
  }, [state, personId, code]);

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

  async function togglePaid(targetId: string) {
    if (!personId) return;
    const res = await fetch(`/api/room/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid", personId, targetId }),
    });
    if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
  }

  async function postAction(payload: Record<string, unknown>) {
    if (!personId) return;
    const res = await fetch(`/api/room/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, ...payload }),
    });
    if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
  }

  function editItem(itemId: string, patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number }) {
    return postAction({ action: "edit", itemId, ...patch });
  }
  function removeItemRow(itemId: string) {
    return postAction({ action: "removeItem", itemId });
  }
  async function addItemRow() {
    const priceOre = parseAmountToOre(newPrice) ?? 0;
    if (!newDesc.trim() || priceOre <= 0) return;
    await postAction({ action: "addItem", description: newDesc.trim(), priceOre, shared: false });
    setNewDesc("");
    setNewPrice("");
    setAddingItem(false);
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";
  const shareText = [state?.place, state?.date].filter(Boolean).join(" · ");

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

  const roomFx: Fx =
    state.currency && state.currency !== "SEK" && state.rate > 0
      ? { currency: state.currency, rate: state.rate }
      : null;

  // What the host still needs to collect: everyone else's shares, minus those
  // already marked paid. Their own share isn't collected.
  const paidSet = new Set(state.paidBy ?? []);
  const otherShares = shares.filter((s) => s.dinerId !== state.payeePersonId && s.totalOre > 0);
  const paidCount = otherShares.filter((s) => paidSet.has(s.dinerId)).length;
  const toCollectOre = otherShares.filter((s) => !paidSet.has(s.dinerId)).reduce((a, s) => a + s.totalOre, 0);
  const claimedNamesFor = (dinerId: string) =>
    state.items.filter((i) => i.claimedBy.includes(dinerId)).map((i) => i.description);

  const peopleCount = Math.max(1, state.people.length);
  const isMine = (it: RoomState["items"][number]) => !!personId && it.claimedBy.includes(personId);

  // One row in the claim list: an inline editor when it's being edited, else a
  // tappable claim row with a pencil to edit. Reused for the shared group and
  // each category section.
  function claimItemRow(it: RoomState["items"][number]) {
    if (editingItemId === it.id) {
      const dv = it.shareCount && it.shareCount > 0 ? it.shareCount : Math.max(2, peopleCount);
      return (
        <div key={it.id} className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-swish/40">
          <div className="flex items-center gap-2">
            <input
              defaultValue={it.description}
              onBlur={(e) => e.target.value.trim() && e.target.value !== it.description && editItem(it.id, { description: e.target.value })}
              placeholder={t.descPh}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
            />
            <input
              defaultValue={formatOre(it.priceOre)}
              onBlur={(e) => {
                const o = parseAmountToOre(e.target.value);
                if (o != null && o !== it.priceOre) editItem(it.id, { priceOre: o });
              }}
              inputMode="decimal"
              placeholder={t.pricePh}
              className="w-20 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
            />
            <button type="button" onClick={() => removeItemRow(it.id)} aria-label={t.removeRow} className="px-1 text-gray-400 active:text-red-500">
              ✕
            </button>
            <button type="button" onClick={() => setEditingItemId(null)} aria-label={t.doneEditing} className="px-1 text-lg text-swish-dark">
              ✓
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-1 text-sm text-gray-500">
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!it.shared}
                onChange={() => editItem(it.id, { shared: !it.shared })}
                className="h-6 w-6 rounded border-gray-300 accent-swish"
              />
              {tx.sharedToggle}
            </label>
            {it.shared && (
              <span className="inline-flex items-center gap-1.5">
                <span>{tx.splitWays}</span>
                <button type="button" aria-label="−" onClick={() => editItem(it.id, { shareCount: Math.max(2, dv - 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200">−</button>
                <span className="w-9 text-center text-lg font-semibold tabular-nums text-gray-700">{dv}</span>
                <button type="button" aria-label="+" onClick={() => editItem(it.id, { shareCount: Math.min(50, dv + 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200">+</button>
              </span>
            )}
          </div>
        </div>
      );
    }
    const mine = isMine(it);
    return (
      <div key={it.id} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleClaim(it.id)}
          disabled={busyItem === it.id}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left shadow-sm ring-1 transition ${
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
              <span className="text-[11px] text-swish-dark">{tx.sharedToggle} · <Money ore={it.priceOre} /></span>
            )}
          </span>
          <Money
            ore={it.shared ? Math.round(it.priceOre / peopleCount) : it.priceOre}
            className="shrink-0 text-right text-sm font-semibold"
          />
        </button>
        <button
          type="button"
          onClick={() => setEditingItemId(it.id)}
          aria-label={t.editRow}
          className="shrink-0 px-1.5 py-2 text-gray-300 active:text-swish-dark"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <FxProvider value={roomFx}>
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-16 pt-5">
      {/* Navigation */}
      <nav className="flex items-center justify-between text-xs font-semibold">
        <a href="/" className="inline-flex items-center gap-1 rounded-full bg-swish px-3 py-1.5 text-white active:bg-swish-dark">
          + {t.newReceipt}
        </a>
        <a href="/history" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-swish-dark ring-1 ring-gray-200 active:bg-gray-100">
          🕘 {t.history}
        </a>
      </nav>

      {/* Share / invite */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{state.place || "Swisher"}</p>
            <p className="text-sm text-gray-500">{[state.date, code].filter(Boolean).join(" · ")}</p>
            {roomFx && (
              <p className="mt-0.5 text-xs text-gray-400">
                {state.country ? `${flagEmoji(state.country)} ${regionName(state.country, lang)} · ` : ""}
                {`1 ${roomFx.currency} ≈ ${formatOre(Math.round(roomFx.rate * 100))} SEK`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${isPayee || !personId ? "bg-swish text-white active:bg-swish-dark" : "bg-swish/10 text-swish-dark ring-1 ring-swish/30 active:bg-swish/20"}`}
          >
            {t.share}
          </button>
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
              {state.items.some((it) => it.shared) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                    <span aria-hidden>🍽️</span>
                    <span>{t.sharedSection}</span>
                  </div>
                  {state.items.filter((it) => it.shared).map(claimItemRow)}
                </div>
              )}
              {CATEGORY_ORDER.map((cat) => {
                const all = state.items.filter((it) => !it.shared && categoryFor(it.description, it.category) === cat);
                if (all.length === 0) return null;
                // Unclaimed items + the ones I claimed stay; items others claimed collapse.
                const mainItems = all.filter((it) => it.claimedBy.length === 0 || isMine(it));
                const othersItems = all.filter((it) => it.claimedBy.length > 0 && !isMine(it));
                const claimers = (it: RoomState["items"][number]) =>
                  it.claimedBy.map((id) => (id === personId ? t.you : nameById.get(id) ?? "?")).join(", ");
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                      <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                      <span>{CATEGORY_LABEL[lang][cat]}</span>
                    </div>
                    {mainItems.map(claimItemRow)}
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
            {addingItem ? (
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-swish/40">
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t.descPh}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                />
                <input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder={t.pricePh}
                  className="w-20 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                />
                <button
                  type="button"
                  onClick={addItemRow}
                  disabled={!newDesc.trim() || (parseAmountToOre(newPrice) ?? 0) <= 0}
                  className="rounded-lg bg-swish px-3 py-2 text-sm font-semibold text-white active:bg-swish-dark disabled:opacity-40"
                >
                  {t.addRow}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingItem(false); setNewDesc(""); setNewPrice(""); }}
                  aria-label="✕"
                  className="px-1 text-gray-400 active:text-red-500"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingItem(true)} className="mt-2 text-sm font-medium text-swish-dark active:opacity-70">
                + {t.addRow}
              </button>
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
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{t.remainingToCollect}</span>
                  {toCollectOre > 0 ? (
                    <Money ore={toCollectOre} className="text-xl font-bold text-swish-dark" />
                  ) : otherShares.length > 0 ? (
                    <span className="text-sm font-semibold text-emerald-600">{t.allCollected}</span>
                  ) : (
                    <Money ore={0} className="text-xl font-bold text-swish-dark" />
                  )}
                </div>
                {otherShares.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{t.paidProgress(paidCount, otherShares.length)}</p>
                )}
                {myShare.totalOre > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    {t.ownShare} <Money ore={myShare.totalOre} className="font-medium" /> · {t.dontPaySelf}
                  </p>
                )}
              </section>
            ) : myShare.totalOre > 0 ? (
              <div id="pay-qr">
                <QrCard
                  name={t.yourTotal}
                  method={state.method === "sepa" ? "sepa" : "swish"}
                  amountOre={myShare.totalOre}
                  swishPayee={state.payeeNumber || undefined}
                  iban={state.method === "sepa" ? state.payeeIban : undefined}
                  payeeName={state.payeeName}
                  eurCents={state.method === "sepa" && state.rate > 0 ? Math.round(myShare.totalOre / state.rate) : undefined}
                  message={`${myShare.name} - ${state.message}`.slice(0, 50)}
                  t={tx}
                  primaryPay
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.nothingYet}</p>
            )
          )}

          {/* Everyone */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">{t.peopleTitle}</h2>
            <div className="space-y-2">
              {shares.map((s) => {
                const isHostRow = s.dinerId === state.payeePersonId;
                const isPaid = (state.paidBy ?? []).includes(s.dinerId);
                // The host (collector) or the person themselves can settle a share.
                const canToggle = !isHostRow && s.totalOre > 0 && (isPayee || s.dinerId === personId);
                const claimed = claimedNamesFor(s.dinerId);
                return (
                  <div key={s.dinerId} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-swish/15 text-xs font-bold text-swish-dark">
                      {initials(nameById.get(s.dinerId) ?? "?")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {nameById.get(s.dinerId)}
                        {isHostRow && <span className="ml-1 text-xs text-gray-400">★</span>}
                        {s.dinerId === personId && <span className="ml-1 text-xs text-gray-400">({lang === "sv" ? "du" : "you"})</span>}
                      </span>
                      {claimed.length > 0 && <span className="truncate text-[11px] text-gray-400">{claimed.join(", ")}</span>}
                    </span>
                    {!isHostRow && s.totalOre > 0 ? (
                      <button
                        type="button"
                        onClick={() => canToggle && togglePaid(s.dinerId)}
                        disabled={!canToggle}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 disabled:opacity-100 ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-white text-gray-500 ring-gray-200"
                        }`}
                      >
                        {isPaid ? `✓ ${t.paid}` : t.markPaid}
                      </button>
                    ) : null}
                    <Money ore={s.totalOre} className={`text-sm font-semibold ${isPaid ? "text-gray-400 line-through" : ""}`} />
                  </div>
                );
              })}
            </div>
            {unassignedOre > 0 && (
              <p className="mt-2 text-xs text-amber-600"><Money ore={unassignedOre} /> {lang === "sv" ? "ofördelat" : "unassigned"}</p>
            )}
          </section>
        </>
      )}
      {!isPayee && myShare && myShare.totalOre > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById("pay-qr")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-between gap-3 border-t border-white/10 bg-ink/95 px-5 py-3 text-white shadow-lg backdrop-blur"
        >
          <span className="text-xs uppercase tracking-wide text-white/60">{t.yourTotal}</span>
          <Money ore={myShare.totalOre} className="text-base font-bold" nativeClassName="ml-1 text-xs font-normal text-white/60" />
          <span className="text-base">↓</span>
        </button>
      )}
      <QrDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        qrSrc={`/api/room/${code}/qr`}
        title={state.place || "Swisher"}
        subtitle={`${t.scanToJoin} · ${code}`}
        shareUrl={shareUrl}
        shareTitle={state.place || "Swisher"}
        shareText={shareText}
        labels={{ share: t.share, copied: t.copied, copyLink: t.copyLink, close: t.close }}
      />
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
