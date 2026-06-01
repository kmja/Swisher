"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import SwishIcon from "@/components/SwishIcon";
import { computeRoomShares, formatOre, parseAmountToOre, isFullyShared } from "@/lib/money";
import { translations } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/categories";
import { formatReceiptDate } from "@/lib/date";
import ItemEmoji from "@/components/ItemEmoji";
import QrDialog from "@/components/QrDialog";
import LangToggle, { saveLang } from "@/components/LangToggle";
import KvittLogo from "@/components/KvittLogo";
import { Money, FxProvider } from "@/components/Money";
import { flagEmoji, regionName, type Fx } from "@/lib/currency";
import { addHistory } from "@/lib/history";
import { buildSwishUri } from "@/lib/swish";
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
    inviteText: (place: string, date: string) =>
      `Gå med och dela notan${place ? ` från ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Kvitto",
    receiptLoading: "Hämtar kvittot…",
    saveQr: "Spara QR-koden",
    imDone: "Jag är klar",
    doneOn: "✓ Klar",
    youCollect: "Du samlar in",
    yourShareNote: "Din egen del – du swishar inte dig själv.",
    remainingToCollect: "Kvar att få in",
    paidProgress: (paid: number, total: number) => `${paid} av ${total} har betalat`,
    allCollected: "Allt inbetalt ✓",
    ownShare: "Din egen del",
    dontPaySelf: "du betalar inte dig själv",
    itemsTitle: "Vad åt du?",
    claimHint: "Tryck på det du åt. Delade rätter ligger högst upp och är redan fördelade.",
    sharedSection: "Delas av alla",
    markedShared: (desc: string) =>
      `🤝 ”${desc || "Raden"}” delas nu av alla — flyttad till listan längst ner.`,
    nLeft: (n: number) => `${n} kvar`,
    cartEmpty: "Inget taget än",
    sharedBy: (n: number) => `delas av ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK/pers`,
    peopleTitle: "Vilka är med",
    unclaimed: (n: number) => `${n} rätt${n === 1 ? "" : "er"} ofördelade`,
    allClaimed: "Allt är fördelat",
    claimedTitle: (n: number) => `✓ ${n} klara`,
    you: "du",
    tip: "Dricks",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har inte petat i något än.",
    paid: "Betald",
    markPaid: "Markera betald",
    cartCount: (n: number) => `${n} rätt${n === 1 ? "" : "er"} klar${n === 1 ? "" : "a"}`,
    payWithSwishAmt: (amt: string) => `Betala ${amt} SEK med Swish`,
    waitingForGuests: "Väntar på gäster…",
    nobodyOwes: "Allt klart ✓",
    newReceipt: "Nytt kvitto",
    history: "Historik",
    editItems: "Redigera rätter",
    editRow: "Redigera rätt",
    doneEditing: "Klar",
    addRow: "Lägg till rätt",
    descPh: "Beskrivning",
    pricePh: "0,00",
    removeRow: "Ta bort rätt",
    removedItem: (desc: string) => `Tog bort ${desc}`,
    undo: "Ångra",
    save: "Spara",
    cancel: "Avbryt",
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
    inviteText: (place: string, date: string) =>
      `Join and split the bill${place ? ` from ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Receipt",
    receiptLoading: "Fetching the receipt…",
    saveQr: "Save the QR code",
    imDone: "I'm done",
    doneOn: "✓ Done",
    youCollect: "You collect",
    yourShareNote: "Your own share — you don't Swish yourself.",
    remainingToCollect: "Remaining to collect",
    paidProgress: (paid: number, total: number) => `${paid} of ${total} paid`,
    allCollected: "All collected ✓",
    ownShare: "Your own share",
    dontPaySelf: "you don't pay yourself",
    itemsTitle: "What did you have?",
    claimHint: "Tap what you had. Shared dishes sit at the top — already split for the table.",
    sharedSection: "Shared by everyone",
    markedShared: (desc: string) =>
      `🤝 “${desc || "Item"}” is now shared by everyone — moved to the bottom.`,
    nLeft: (n: number) => `${n} left`,
    cartEmpty: "Nothing claimed yet",
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
    cartCount: (n: number) => `${n} item${n === 1 ? "" : "s"} claimed`,
    payWithSwishAmt: (amt: string) => `Pay ${amt} SEK with Swish`,
    waitingForGuests: "Waiting for guests…",
    nobodyOwes: "All clear ✓",
    newReceipt: "New receipt",
    history: "History",
    editItems: "Fix items",
    editRow: "Edit item",
    doneEditing: "Done",
    addRow: "Add item",
    descPh: "Description",
    pricePh: "0.00",
    removeRow: "Remove row",
    removedItem: (desc: string) => `Removed ${desc}`,
    undo: "Undo",
    save: "Save",
    cancel: "Cancel",
  },
} as const;

const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function RoomPage() {
  const params = useParams<{ id: string | string[] }>();
  const searchParams = useSearchParams();
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
  // Host's name / Swish number / group-size are always-visible input
  // fields in the top section now. Drafts mirror the server state but
  // we only push them downstream when the corresponding input isn't
  // focused, so a guest-side state push doesn't yank a char out from
  // under the host mid-typing.
  const [payeeNameDraft, setPayeeNameDraft] = useState("");
  const [payeeNumberDraft, setPayeeNumberDraft] = useState("");
  const payeeNameInputRef = useRef<HTMLInputElement>(null);
  const payeeNumberInputRef = useRef<HTMLInputElement>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptImages, setReceiptImages] = useState<string[] | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // Buffered edits while the pencil-driven editor is open. Save flushes the
  // draft to the server in one editItem call; Cancel just discards.
  type EditDraft = {
    description: string;
    priceInput: string;
    shared: boolean;
    shareCount: number | undefined;
  };
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  // Snapshot of the most-recently-removed item, shown as a transient undo toast
  // above the sticky footer. Claims aren't restored — the addItem action only
  // round-trips description/price/shared/shareCount/category/emoji.
  type RemovedSnapshot = {
    description: string;
    priceOre: number;
    shared: boolean;
    shareCount?: number;
    category?: string;
    emoji?: string;
    /** Position in state.items at the time of removal, so undo can restore
     *  the row in its original slot rather than appending it to the end. */
    index: number;
  };
  const [pendingUndo, setPendingUndo] = useState<RemovedSnapshot | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // Sync the payee name / number drafts FROM the server state, but
  // only when the input isn't focused — otherwise a live update from
  // another client (or the guest list mutating, which triggers a
  // state refresh) would clobber whatever the host is typing.
  useEffect(() => {
    if (!state) return;
    if (payeeNameInputRef.current !== document.activeElement) {
      setPayeeNameDraft(state.payeeName ?? "");
    }
    if (payeeNumberInputRef.current !== document.activeElement) {
      setPayeeNumberDraft(state.payeeNumber ?? "");
    }
  }, [state?.payeeName, state?.payeeNumber]);

  // Positive toast surfaced when an edit flips an item from
  // not-fully-shared → fully-shared. Auto-dismisses after ~4 s so it
  // doesn't linger over the bottom action row.
  const [markedSharedToast, setMarkedSharedToast] = useState<{ description: string } | null>(null);
  const markedSharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Promote-to-shared animation. Two pieces of state cooperate:
  //   • promoteRequestRef caches the source rect captured BEFORE the
  //     edit is applied (so the edit form is still on screen).
  //   • flyingItem is the live ghost data once we've resolved the
  //     target rect from sharedHeaderRef on the next layout pass.
  // The shared-section header gets a ref so we can grab its bounding
  // rect for the target, even when the section is collapsed (the
  // header still exists; only the drawer is height 0).
  const sharedHeaderRef = useRef<HTMLButtonElement>(null);
  type FlyRect = { x: number; y: number; w: number; h: number };
  type PromoteRequest = {
    description: string;
    emoji?: string;
    category?: string;
    source: FlyRect;
  };
  const promoteRequestRef = useRef<PromoteRequest | null>(null);
  const [flyingItem, setFlyingItem] = useState<{
    description: string;
    emoji?: string;
    category?: string;
    source: FlyRect;
    target: { x: number; y: number };
  } | null>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!markedSharedToast) return;
    if (markedSharedTimer.current) clearTimeout(markedSharedTimer.current);
    markedSharedTimer.current = setTimeout(() => setMarkedSharedToast(null), 4200);
    return () => { if (markedSharedTimer.current) clearTimeout(markedSharedTimer.current); };
  }, [markedSharedToast]);

  // Long-press → inline edit for description or price. The pencil button is
  // still there for "full" edits (shared, split count, delete); this is the
  // shortcut for the most common fixes (the OCR's typo, the wrong digit).
  const [quickEdit, setQuickEdit] = useState<{ itemId: string; field: "description" | "price" } | null>(null);
  const quickEditInputRef = useRef<HTMLInputElement | null>(null);
  // autoFocus alone doesn't bring up the mobile keyboard reliably — iOS needs
  // a focus() call that's chained from a user activation. requestAnimationFrame
  // keeps us in that window: state flips → React mounts the input → rAF fires
  // before paint → we focus + select the input so the keyboard pops up.
  useEffect(() => {
    if (!quickEdit) return;
    const id = requestAnimationFrame(() => {
      const input = quickEditInputRef.current;
      if (!input) return;
      input.focus();
      try { input.select(); } catch { /* select() can throw on some types */ }
    });
    return () => cancelAnimationFrame(id);
  }, [quickEdit]);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  const lpStart = useRef({ x: 0, y: 0 });

  // FLIP layout animation: when a row is removed and its neighbours shift up
  // (or down — if undo restores an item), animate the movement instead of
  // snapping. Two things conspire on iOS Safari that the v1.x code got wrong:
  //
  // 1. getBoundingClientRect().top is VIEWPORT-relative, so when the address
  //    bar collapses on scroll-stop the viewport gets taller and every row's
  //    top shifts. Add window.scrollY to anchor the stored positions to the
  //    document instead — invariant under viewport resize.
  // 2. The effect must only re-measure when the items SET actually changes.
  //    With no deps it ran on every DO live-state push (state objects are
  //    fresh JSON each round-trip), and combined with #1 produced a ~10 px
  //    translateY animation on every render after a scroll. Gate on a
  //    signature of item ids in order so unrelated state updates skip it.
  const rowPositionsRef = useRef<Map<string, number>>(new Map());
  // Include shared / shareCount in the signature so the FLIP effect
  // also re-measures when an item flips into / out of the "shared by
  // everyone" section — the row's id is unchanged but its DOM slot
  // moves, and we want the move animated.
  const itemIdsSig = useMemo(
    () =>
      state?.items
        .map((i) => `${i.id}:${i.shared ? 1 : 0}:${i.shareCount ?? 0}`)
        .join("|") ?? "",
    [state?.items],
  );
  useLayoutEffect(() => {
    if (!state) return;
    const scrollY = window.scrollY;
    const next = new Map<string, number>();
    for (const item of state.items) {
      const el = document.querySelector(`[data-item-id="${item.id}"]`);
      if (el instanceof HTMLElement) next.set(item.id, el.getBoundingClientRect().top + scrollY);
    }
    for (const [id, newTop] of next) {
      const oldTop = rowPositionsRef.current.get(id);
      if (oldTop == null) continue; // first appearance — no animation
      const dy = oldTop - newTop;
      if (Math.abs(dy) < 1) continue; // didn't move
      const el = document.querySelector(`[data-item-id="${id}"]`);
      if (!(el instanceof HTMLElement)) continue;
      // Skip rows that are mid-swipe (transform is being driven by the
      // pointer handlers) so we don't clobber their slide-out.
      if (el.style.transform && el.style.transform.includes("translateX")) continue;
      // First / Last / Invert / Play.
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      // Force a reflow so the browser commits the snapped-back position
      // before we start the play transition.
      void el.getBoundingClientRect();
      el.style.transition = "transform 260ms cubic-bezier(0.32, 0.72, 0.36, 1)";
      el.style.transform = "translateY(0)";
    }
    rowPositionsRef.current = next;
  }, [itemIdsSig, state]);

  // After the items state lands with a freshly promoted row, look up
  // the shared section header's position and seed flyingItem with both
  // source + target rects. Runs on every items change but only does
  // anything when promoteRequestRef has been staged by saveEdit.
  useLayoutEffect(() => {
    const req = promoteRequestRef.current;
    if (!req) return;
    const targetEl = sharedHeaderRef.current;
    if (!targetEl) return;
    const t = targetEl.getBoundingClientRect();
    promoteRequestRef.current = null;
    setFlyingItem({
      description: req.description,
      emoji: req.emoji,
      category: req.category,
      source: req.source,
      target: { x: t.left + t.width / 2, y: t.top + t.height / 2 },
    });
  }, [itemIdsSig]);

  // Play the fly-to-shared animation imperatively via WAAPI. We
  // translate from (source top-left, scale 1) to (target centre, scale
  // 0.4) over ~620 ms with a "land into a slot" curve — the row
  // shrinks as it travels so it visually settles into the section
  // header. If the target is off-screen the same math just sends the
  // ghost off the edge of the viewport.
  useLayoutEffect(() => {
    if (!flyingItem || !flyingRef.current || typeof flyingRef.current.animate !== "function") return;
    const dx = flyingItem.target.x - (flyingItem.source.x + flyingItem.source.w / 2);
    const dy = flyingItem.target.y - (flyingItem.source.y + flyingItem.source.h / 2);
    const anim = flyingRef.current.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(0.85)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 },
      ],
      { duration: 620, easing: "cubic-bezier(0.45, 0.05, 0.5, 0.95)", fill: "forwards" },
    );
    const clear = () => setFlyingItem(null);
    anim.onfinish = clear;
    return () => { anim.cancel(); };
  }, [flyingItem]);

  // Swipe-left-to-remove on claim rows. Pure DOM transforms during the drag
  // (no React re-renders for smoothness); React only re-renders on commit
  // when removeItemRow runs and the row's actual data is gone.
  //
  // These handlers are intentionally NOT wrapped in useCallback. They close
  // over `state` (read inside removeItemRow) and `setState` from the latest
  // render; an empty-deps useCallback would freeze them on render 1 when
  // state was still null, so the commit timeout would call a stale
  // removeItemRow that bailed out before snapshotting anything for the
  // undo toast. Re-creating per render is cheap (the row re-renders anyway).
  const swipeRef = useRef<{
    el: HTMLDivElement;
    startX: number;
    startY: number;
    armed: boolean;
    itemId: string;
  } | null>(null);
  const onSwipeStart = (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
    swipeRef.current = {
      el: e.currentTarget,
      startX: e.clientX,
      startY: e.clientY,
      armed: false,
      itemId,
    };
  };
  const onSwipeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.armed) {
      // Need a clear horizontal intent before we hijack the gesture: at
      // least 6 px of total movement AND dx larger than dy by a healthy
      // margin so vertical jitter on a scroll attempt doesn't accidentally
      // arm a swipe.
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) {
        // Vertical-dominant → it's a scroll. Abandon.
        swipeRef.current = null;
        return;
      }
      s.armed = true;
      try { s.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      // Cancel any concurrent long-press detection while swiping.
      if (lpTimer.current) {
        clearTimeout(lpTimer.current);
        lpTimer.current = null;
      }
    }
    // Rubber-band the right direction so users feel the asymmetry.
    const offset = dx < 0 ? dx : dx * 0.25;
    s.el.style.transform = `translateX(${offset}px)`;
    s.el.style.transition = "";
  };
  const onSwipeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s || !s.armed) {
      swipeRef.current = null;
      return;
    }
    const dx = e.clientX - s.startX;
    const threshold = -110;
    const el = s.el;
    const itemId = s.itemId;
    if (dx < threshold) {
      // Commit: slide the row off-screen, fade, then drop it from state.
      el.style.transition = "transform 200ms ease-out, opacity 200ms ease-out";
      el.style.transform = "translateX(-120%)";
      el.style.opacity = "0";
      window.setTimeout(() => removeItemRow(itemId), 180);
    } else {
      // Spring back to neutral.
      el.style.transition = "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.transform = "translateX(0)";
    }
    swipeRef.current = null;
  };
  const onSwipeCancel = () => {
    const s = swipeRef.current;
    if (s?.armed) {
      s.el.style.transition = "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      s.el.style.transform = "translateX(0)";
    }
    swipeRef.current = null;
  };
  const cancelLongPress = useCallback(() => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  }, []);
  const startLongPress = useCallback((onFire: () => void) => (e: React.PointerEvent) => {
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      lpTimer.current = null;
      onFire();
      // Subtle haptic so the user knows the edit was armed.
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    }, 450);
  }, [cancelLongPress]);
  const moveLongPress = useCallback((e: React.PointerEvent) => {
    if (!lpTimer.current) return;
    const dx = e.clientX - lpStart.current.x;
    const dy = e.clientY - lpStart.current.y;
    if (dx * dx + dy * dy > 64) cancelLongPress();
  }, [cancelLongPress]);
  const swallowLongPressClick = useCallback((e: React.MouseEvent) => {
    if (lpFired.current) {
      e.preventDefault();
      e.stopPropagation();
      lpFired.current = false;
    }
  }, []);
  useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const t = R[lang];
  const tx = translations[lang];

  // When the host lands here from createRoom (?invite=1), pop the QR/share
  // dialog right away and strip the query so a refresh doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("invite") !== "1") return;
    setShareOpen(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [searchParams]);

  // Trap iOS' edge-swipe-back (and the system back button) so a live room
  // can't be accidentally navigated away from — leaving via the Kvitt UI
  // ("Nytt kvitto" / "Historik") still works because those are <a> links
  // that fully navigate, which unmounts this page and detaches the listener.
  //
  // The previous version pushed one sentinel entry and re-pushed on every
  // popstate. That worked for the first swipe-back but failed on the second:
  // Next.js's own popstate handler treated the pop as a route change, our
  // component unmounted before we could refill, and the next swipe popped
  // the trap-less history.
  //
  // Fix: push MANY sentinel entries, all explicitly pointing at the room's
  // own URL. Popping any of them is a no-op for Next.js (URL didn't change
  // → no route change → no unmount), so the trap stays installed and the
  // user can swipe-back as many times as they like without escaping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const here = window.location.pathname + window.location.search;
    // 30 is plenty: Safari historically caps history at ~50 entries and
    // we want to leave room for the rest of the app's session.
    for (let i = 0; i < 30; i++) {
      window.history.pushState({ kvittTrap: true }, "", here);
    }
    const onPopState = () => {
      // Top up so the buffer can't drain even if the user fling-swipes.
      window.history.pushState({ kvittTrap: true }, "", here);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    // Optimistic: flip the claim locally so the tap feels instant. On error we
    // refresh from the server, which restores the truth.
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const i = it.claimedBy.indexOf(personId);
          const claimedBy = i >= 0 ? it.claimedBy.filter((id) => id !== personId) : [...it.claimedBy, personId];
          return { ...it, claimedBy };
        }),
      };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", personId, itemId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    } finally {
      setBusyItem(null);
    }
  }

  async function toggleDone() {
    if (!personId) return;
    setState((prev) => {
      if (!prev) return prev;
      const doneBy = prev.doneBy ?? [];
      const i = doneBy.indexOf(personId);
      const next = i >= 0 ? doneBy.filter((id) => id !== personId) : [...doneBy, personId];
      return { ...prev, doneBy: next };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done", personId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    }
  }

  async function togglePaid(targetId: string) {
    if (!personId) return;
    setState((prev) => {
      if (!prev) return prev;
      const paidBy = prev.paidBy ?? [];
      const i = paidBy.indexOf(targetId);
      const next = i >= 0 ? paidBy.filter((id) => id !== targetId) : [...paidBy, targetId];
      return { ...prev, paidBy: next };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", personId, targetId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    }
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
  /** Push the current name + number drafts to the server. Called on
   *  blur of either input so the host doesn't need an explicit save
   *  step. */
  async function savePayeeDrafts() {
    if (!state) return;
    const name = payeeNameDraft.trim();
    const number = payeeNumberDraft.trim();
    if (name === state.payeeName && number === state.payeeNumber) return;
    await postAction({ action: "editPayee", name, number });
  }
  /** Bump / drop group size by 1. We post a separate editPayee patch
   *  rather than batching with the name/number so the server's
   *  re-share sweep (which has its own side effects) runs cleanly. */
  async function updateGroupSize(next: number) {
    if (!state) return;
    const clamped = Math.max(2, Math.min(50, Math.round(next)));
    if (clamped === (state.groupSize ?? 0)) return;
    await postAction({ action: "editPayee", groupSize: clamped });
  }
  function openEdit(it: { id: string; description: string; priceOre: number; shared?: boolean; shareCount?: number }) {
    setEditingItemId(it.id);
    setEditDraft({
      description: it.description,
      priceInput: formatOre(it.priceOre),
      shared: !!it.shared,
      shareCount: it.shareCount,
    });
  }
  function cancelEdit() {
    setEditingItemId(null);
    setEditDraft(null);
  }
  async function saveEdit(itemId: string) {
    if (!editDraft) return cancelEdit();
    const before = state?.items.find((i) => i.id === itemId);
    const desc = editDraft.description.trim();
    const priceOre = parseAmountToOre(editDraft.priceInput);
    const patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number } = {};
    if (desc) patch.description = desc;
    if (priceOre != null) patch.priceOre = priceOre;
    patch.shared = editDraft.shared;
    if (editDraft.shared) patch.shareCount = editDraft.shareCount;
    // Did this edit promote the row into the "shared by everyone"
    // section? Then surface the positive toast — the FLIP layout
    // animation will carry the row down to the bottom on its own.
    const wasFully = before ? isFullyShared(before, groupSize) : false;
    const isFully = isFullyShared(
      { shared: !!patch.shared, shareCount: patch.shareCount },
      groupSize,
    );
    await editItem(itemId, patch);
    if (!wasFully && isFully) {
      // Stage a fly-from-source animation. We capture the source rect
      // (the edit form's bounding box) NOW, before the patch is
      // applied; the target rect (the shared section header) only
      // resolves on the next render, so a useLayoutEffect picks it up
      // and seeds the flyingItem state from there.
      const sourceEl = document.querySelector(`[data-item-id="${itemId}"]`);
      if (sourceEl instanceof HTMLElement) {
        const r = sourceEl.getBoundingClientRect();
        promoteRequestRef.current = {
          description: desc || before?.description || "",
          emoji: before?.emoji,
          category: before?.category,
          source: { x: r.left, y: r.top, w: r.width, h: r.height },
        };
      }
      setMarkedSharedToast({ description: desc || before?.description || "" });
    }
    cancelEdit();
  }
  async function removeItemRow(itemId: string) {
    const idx = state?.items.findIndex((i) => i.id === itemId) ?? -1;
    const item = idx >= 0 ? state?.items[idx] : undefined;
    if (item) {
      setPendingUndo({
        description: item.description,
        priceOre: item.priceOre,
        shared: !!item.shared,
        shareCount: item.shareCount,
        category: item.category,
        emoji: item.emoji,
        index: idx,
      });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setPendingUndo(null), 6000);
    }
    // Optimistic: drop the row from local state immediately so the FLIP
    // layout effect can animate the neighbours into the gap right away
    // instead of waiting for the server round-trip. postAction will
    // overwrite with the server's truth when it returns.
    setState((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev));
    await postAction({ action: "removeItem", itemId });
  }
  async function undoRemoval() {
    if (!pendingUndo) return;
    const snap = pendingUndo;
    setPendingUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await postAction({
      action: "addItem",
      description: snap.description,
      priceOre: snap.priceOre,
      shared: snap.shared,
      shareCount: snap.shareCount,
      category: snap.category,
      emoji: snap.emoji,
      // Re-insert at the original position rather than appending.
      index: snap.index,
    });
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
  const shareText = t.inviteText(state?.place ?? "", state?.date ?? "");

  async function openReceipt() {
    setReceiptOpen(true);
    if (receiptImages !== null) return;
    try {
      const res = await fetch(`/api/room/${code}/images`, { cache: "force-cache" });
      if (res.ok) {
        const data = (await res.json()) as { images: string[] };
        setReceiptImages(data.images ?? []);
      } else {
        setReceiptImages([]);
      }
    } catch {
      setReceiptImages([]);
    }
  }

  const { shares, unassignedOre } = useMemo(() => {
    if (!state) return { shares: [] as Share[], unassignedOre: 0 };
    const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
    return computeRoomShares(state.items, diners, state.tipOre, state.groupSize ?? 0);
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

  // What the host still needs to collect: everyone else's shares (minus those
  // already paid), PLUS items that are still unassigned. The host paid the
  // full bill, so anything they haven't claimed for themselves is still owed
  // by someone — whether they've claimed yet or not.
  const paidSet = new Set(state.paidBy ?? []);
  const otherShares = shares.filter((s) => s.dinerId !== state.payeePersonId && s.totalOre > 0);
  const paidCount = otherShares.filter((s) => paidSet.has(s.dinerId)).length;
  const unpaidOthersOre = otherShares.filter((s) => !paidSet.has(s.dinerId)).reduce((a, s) => a + s.totalOre, 0);
  const toCollectOre = unpaidOthersOre + unassignedOre;
  const claimedNamesFor = (dinerId: string) =>
    state.items.filter((i) => i.claimedBy.includes(dinerId)).map((i) => i.description);

  const peopleCount = Math.max(1, state.people.length);
  // Group size used for share-count defaults and the +/− cap. Prefer the host's
  // intended head count; otherwise grow with the actual people in the room.
  const groupSize = Math.max(2, peopleCount, state.groupSize ?? 0);
  const isMine = (it: RoomState["items"][number]) => !!personId && it.claimedBy.includes(personId);

  // One row in the claim list: an inline editor when it's being edited, else a
  // tappable claim row with a pencil to edit. Reused for the shared group and
  // each category section.
  function claimItemRow(it: RoomState["items"][number]) {
    if (editingItemId === it.id && editDraft) {
      // Match the host-setup edit row: icon · description · price ·
      // remove-X all on the card top, share stepper inline when shared,
      // vertical share toggle on the right, and a Save / Cancel pair below.
      const dv = editDraft.shareCount && editDraft.shareCount > 0 ? editDraft.shareCount : groupSize;
      const draftOre = parseAmountToOre(editDraft.priceInput) ?? 0;
      return (
        <div key={it.id} data-item-id={it.id} className="space-y-2">
          <div className="flex items-stretch gap-2">
            <div
              className={`min-w-0 flex-1 rounded-xl p-2 shadow-sm ring-1 ${
                editDraft.shared ? "bg-swish/5 ring-swish/40" : "bg-white ring-swish/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="pl-1 text-3xl leading-none">
                  <ItemEmoji description={editDraft.description} hint={it.category} modelEmoji={it.emoji} />
                </span>
                <input
                  value={editDraft.description}
                  onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  placeholder={t.descPh}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                />
                <input
                  value={editDraft.priceInput}
                  onChange={(e) => setEditDraft({ ...editDraft, priceInput: e.target.value })}
                  inputMode="decimal"
                  placeholder={t.pricePh}
                  className="w-20 shrink-0 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                />
                <button
                  type="button"
                  onClick={() => { removeItemRow(it.id); cancelEdit(); }}
                  aria-label={t.removeRow}
                  className="px-1 text-gray-400 active:text-red-500"
                >
                  ✕
                </button>
              </div>
              {editDraft.shared && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1 text-sm text-gray-500">
                  <span>{tx.splitWays}</span>
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => setEditDraft({ ...editDraft, shareCount: Math.max(2, dv - 1) })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="min-w-[3.5rem] text-center text-2xl font-bold tabular-nums text-ink">{dv}/{groupSize}</span>
                  <button
                    type="button"
                    aria-label="+"
                    disabled={dv >= groupSize}
                    onClick={() => setEditDraft({ ...editDraft, shareCount: Math.min(groupSize, dv + 1) })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="text-gray-400">≈ {formatOre(Math.floor(draftOre / dv))} SEK</span>
                </div>
              )}
            </div>
            <button
              type="button"
              role="switch"
              onClick={() =>
                setEditDraft({
                  ...editDraft,
                  shared: !editDraft.shared,
                  shareCount: editDraft.shared ? undefined : editDraft.shareCount,
                })
              }
              aria-checked={editDraft.shared}
              aria-label={tx.sharedToggle}
              title={tx.sharedToggle}
              className="flex w-14 shrink-0 flex-col items-center justify-center gap-1.5"
            >
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  editDraft.shared ? "text-swish-dark" : "text-gray-500"
                }`}
              >
                {tx.sharedLabel}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editDraft.shared ? "bg-swish" : "bg-gray-300"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    editDraft.shared ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => saveEdit(it.id)}
              className="rounded-xl bg-swish px-4 py-2 text-sm font-semibold text-white active:bg-swish-dark"
            >
              {t.save}
            </button>
          </div>
        </div>
      );
    }
    const mine = isMine(it);
    // For shared items, show "X/Y" — X people have taken a share, Y total
    // shares — so the table can see the group size at a glance. Partial
    // shares (Y < groupSize) still dim and disable the row once every share
    // is taken by someone other than the viewer.
    const partialShare = it.shared && !isFullyShared(it, groupSize);
    const shareCap = it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize;
    const sharesTaken = it.claimedBy.length;
    const sharesFull = partialShare && !mine && sharesTaken >= shareCap;
    const editingDesc = quickEdit?.itemId === it.id && quickEdit.field === "description";
    const editingPrice = quickEdit?.itemId === it.id && quickEdit.field === "price";
    const anyQuickEdit = editingDesc || editingPrice;
    return (
      <div
          key={it.id}
          data-item-id={it.id}
          role="button"
          tabIndex={anyQuickEdit || sharesFull ? -1 : 0}
          aria-pressed={mine}
          aria-disabled={anyQuickEdit || sharesFull}
          onPointerDown={(e) => { if (!anyQuickEdit) onSwipeStart(e, it.id); }}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeEnd}
          onPointerCancel={onSwipeCancel}
          onClick={() => {
            if (anyQuickEdit || sharesFull || busyItem === it.id) return;
            toggleClaim(it.id);
          }}
          onKeyDown={(e) => {
            if (anyQuickEdit) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleClaim(it.id);
            }
          }}
          className={`relative flex min-w-0 cursor-pointer touch-pan-y select-none items-center gap-2.5 rounded-2xl p-3 text-left shadow-sm ring-1 transition-colors will-change-transform ${
            mine
              // Opaque colours so the red swipe-reveal layer behind the row
              // doesn't bleed through. `bg-swish/10` over the page bg used to
              // resolve to ~#f4e6ee; freeze that as the literal mine colour.
              // sharesFull keeps a soft gray (no opacity-60, which would let
              // red show through) with dimmed text for the "no more shares"
              // signal.
              ? "bg-[#f4e6ee] ring-swish"
              : sharesFull
              ? "bg-gray-100 text-gray-400 ring-black/5"
              : "bg-white ring-black/5"
          } ${anyQuickEdit ? "ring-2 ring-swish/60" : ""}`}
        >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
            mine ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none"><ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} /></span>
              {editingDesc ? (
                <input
                  ref={quickEditInputRef}
                  defaultValue={it.description}
                  placeholder={t.descPh}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    else if (e.key === "Escape") setQuickEdit(null);
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== it.description) editItem(it.id, { description: v });
                    setQuickEdit(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 outline-none ring-1 ring-swish/40"
                />
              ) : (
                <span
                  onPointerDown={startLongPress(() => setQuickEdit({ itemId: it.id, field: "description" }))}
                  onPointerMove={moveLongPress}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onClick={swallowLongPressClick}
                  onContextMenu={(e) => e.preventDefault()}
                  className="min-w-0 truncate select-none [-webkit-touch-callout:none]"
                >
                  {it.description}
                  {it.shared && (
                    <span className="ml-1.5 text-xs font-normal tabular-nums text-gray-400">
                      {sharesTaken}/{shareCap}
                    </span>
                  )}
                </span>
              )}
            </span>
            {it.shared && (
              <span className="text-[11px] text-swish-dark">
                {partialShare ? `${tx.splitWays} ${shareCap}` : tx.sharedToggle} · <Money ore={it.priceOre} />
              </span>
            )}
          </span>
          {editingPrice ? (
            <input
              ref={quickEditInputRef}
              defaultValue={formatOre(it.priceOre)}
              inputMode="decimal"
              placeholder={t.pricePh}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") setQuickEdit(null);
              }}
              onBlur={(e) => {
                const o = parseAmountToOre(e.target.value);
                if (o != null && o !== it.priceOre) editItem(it.id, { priceOre: o });
                setQuickEdit(null);
              }}
              className="w-24 shrink-0 rounded-lg bg-gray-50 px-2 py-1 text-right outline-none ring-1 ring-swish/40"
            />
          ) : (
            <span
              onPointerDown={startLongPress(() => setQuickEdit({ itemId: it.id, field: "price" }))}
              onPointerMove={moveLongPress}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onClick={swallowLongPressClick}
              onContextMenu={(e) => e.preventDefault()}
              className="flex shrink-0 select-none flex-col items-end leading-tight [-webkit-touch-callout:none]"
            >
              {it.shared && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t.yourTotal}</span>
              )}
              <Money
                ore={it.shared ? Math.round(it.priceOre / shareCap) : it.priceOre}
                className="text-right text-base font-semibold"
              />
            </span>
          )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openEdit(it); }}
          aria-label={t.editRow}
          className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-500 shadow-md ring-1 ring-black/10 active:bg-gray-100 active:text-swish-dark"
        >
          <PencilIcon />
        </button>
      </div>
    );
  }

  type ItemRow = RoomState["items"][number];
  type ItemGroup = { copies: ItemRow[]; mine: ItemRow[]; available: ItemRow[]; others: ItemRow[] };

  /** Build a (description+price+shareCount) key so identical copies group together. */
  function groupKey(it: ItemRow): string {
    return `${it.description}|${it.priceOre}|${it.shareCount ?? ""}`;
  }

  /** Render one group of identical (non-shared) copies as a single claim row.
   *  Single-copy groups fall through to the existing claimItemRow so nothing
   *  changes for them; multi-copy groups show a counter when the user has any. */
  function renderClaimGroup(g: ItemGroup) {
    const rep = g.copies[0];
    const editingCopy = g.copies.find((c) => c.id === editingItemId);
    if (editingCopy) return claimItemRow(editingCopy);
    if (g.copies.length === 1) return claimItemRow(rep);

    const mineCount = g.mine.length;
    const availableCount = g.available.length;
    const totalCount = g.copies.length;
    const taken = mineCount > 0;
    const myTotalOre = mineCount * rep.priceOre;

    const claimOne = () => g.available.length > 0 && toggleClaim(g.available[0].id);
    const releaseOne = () => g.mine.length > 0 && toggleClaim(g.mine[g.mine.length - 1].id);
    const tapRow = () => {
      if (availableCount > 0) claimOne();
      else if (mineCount > 0) releaseOne();
    };

    return (
      <div key={rep.id} className="flex flex-col gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={tapRow}
            disabled={availableCount === 0 && mineCount === 0}
            className={`relative flex min-w-0 w-full items-center gap-2.5 rounded-2xl p-3 text-left shadow-sm ring-1 transition ${
              taken ? "bg-[#f4e6ee] ring-swish" : "bg-white ring-black/5"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                taken ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
              <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none"><ItemEmoji description={rep.description} hint={rep.category} modelEmoji={rep.emoji} /></span>
              <span className="min-w-0 truncate">
                {rep.description}
                {availableCount > 0 && <span className="ml-1 text-xs font-normal text-gray-400">×{availableCount}</span>}
              </span>
            </span>
            <Money
              ore={taken ? myTotalOre : rep.priceOre}
              className="shrink-0 text-right text-base font-semibold"
            />
          </button>
          {/* Floating pencil on the card's top-right corner — matches the
              single-copy claim row. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEdit(rep); }}
            aria-label={t.editRow}
            className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-500 shadow-md ring-1 ring-black/10 active:bg-gray-100 active:text-swish-dark"
          >
            <PencilIcon />
          </button>
        </div>
        {taken && (
          <div className="flex items-center justify-center gap-3 py-1">
            <button
              type="button"
              disabled={mineCount === 0}
              onClick={releaseOne}
              aria-label="−"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-3xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-semibold tabular-nums text-gray-700">{mineCount}</span>
            <button
              type="button"
              disabled={availableCount === 0}
              onClick={claimOne}
              aria-label="+"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-3xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <FxProvider value={roomFx}>
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-32">
      {/* Sticky nav. Solid backdrop-blur background + bottom border so the
          header reads as a fixed surface above the scrolling content. The
          KvittLogo drops out on the room page — three buttons in 28 rem
          want every pixel — but it still appears on the home + history
          pages. */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <nav className="flex items-center justify-between gap-2">
          <a
            href="/"
            aria-label={t.newReceipt}
            title={t.newReceipt}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-swish text-2xl font-semibold leading-none text-white shadow-sm active:bg-swish-dark"
          >
            +
          </a>
          <div className="flex items-center gap-2">
            <a
              href="/history"
              aria-label={t.history}
              title={t.history}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl text-swish-dark active:bg-gray-200"
            >
              🕘
            </a>
            <LangToggle lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
          </div>
        </nav>
      </header>

      {/* Share / invite — top of the room reads as a header / title now:
          place name as the hero, date subtitle, a small live QR with the
          share CTA underneath (tap either to open the full share
          dialog), and host name / Swish number / group size as
          always-visible inputs for the host. Guests see the host row
          read-only. */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          {/* Title block. min-w-0 + truncate so a long restaurant name
              can shrink instead of pushing the QR off the card. */}
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate text-xl font-bold text-ink">{state.place || "Kvitt"}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{formatReceiptDate(state.date, lang)}</p>
            {state.imageCount > 0 && (
              <button
                type="button"
                onClick={openReceipt}
                aria-label={t.showReceipt}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-swish-dark active:bg-gray-200"
              >
                🧾 {t.showReceipt}
              </button>
            )}
          </div>
          {/* QR + share — paired column on the right. QR is tappable;
              the link CTA underneath matches its width so they read as
              one control. */}
          <div className="flex w-24 shrink-0 flex-col items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label={t.share}
              className="overflow-hidden rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/10 active:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/room/${code}/qr`} alt="" className="block h-[88px] w-[88px]" />
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isPayee || !personId ? "bg-swish text-white active:bg-swish-dark" : "bg-swish/10 text-swish-dark ring-1 ring-swish/30 active:bg-swish/20"}`}
            >
              {t.share}
            </button>
          </div>
        </div>
        {isPayee ? (
          <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
            {/* Host's name. */}
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
                </svg>
              </span>
              <input
                ref={payeeNameInputRef}
                value={payeeNameDraft}
                onChange={(e) => setPayeeNameDraft(e.target.value)}
                onBlur={savePayeeDrafts}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder={tx.yourName}
                className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-base shadow-sm ring-1 ring-black/5 outline-none"
              />
            </div>
            {/* Host's Swish number. */}
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <path d="M12 18h.01" />
                </svg>
              </span>
              <input
                ref={payeeNumberInputRef}
                value={payeeNumberDraft}
                onChange={(e) => setPayeeNumberDraft(e.target.value)}
                onBlur={savePayeeDrafts}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                inputMode="tel"
                placeholder={tx.swishNumber}
                className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-base shadow-sm ring-1 ring-black/5 outline-none"
              />
            </div>
            {/* Group size — +/− stepper in the same input surface. */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white py-1.5 pl-3 pr-2 shadow-sm ring-1 ring-black/5">
              <span className="text-sm font-medium text-ink">{tx.groupSizeLabel}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => updateGroupSize(groupSize - 1)}
                  disabled={groupSize <= 2 || groupSize <= state.people.length}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-6 text-center text-lg font-bold tabular-nums text-ink">{groupSize}</span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => updateGroupSize(groupSize + 1)}
                  disabled={groupSize >= 50}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500">
            <span aria-hidden className="text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
              </svg>
            </span>
            <span className="min-w-0 truncate">
              {state.payeeName}
              {state.payeeNumber && <span className="text-gray-400"> · {state.payeeNumber}</span>}
            </span>
          </p>
        )}
        {roomFx && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {state.country ? `${flagEmoji(state.country)} ${regionName(state.country, lang)} · ` : ""}
            {`1 ${roomFx.currency} ≈ ${formatOre(Math.round(roomFx.rate * 100))} SEK`}
          </p>
        )}
      </section>

      {/* Host's primary view: a focused collection summary + diner list at
          the top of the page so the host lands on "what's still owed and
          who hasn't paid" rather than the items grid. Replaces the old
          sticky bottom footer. */}
      {personId && isPayee && (() => {
        const empty = otherShares.length === 0;
        const allPaid = !empty && unpaidOthersOre === 0 && unassignedOre === 0;
        const subtitle = empty
          ? t.waitingForGuests
          : allPaid
          ? t.nobodyOwes
          : t.paidProgress(paidCount, otherShares.length);
        return (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.remainingToCollect}</span>
            <div className="mt-1">
              <Money ore={toCollectOre} className="block text-4xl font-bold text-swish-dark" />
            </div>
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
            {!empty && (
              <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                {otherShares.map((s) => {
                  const isPaid = paidSet.has(s.dinerId);
                  const isDone = (state.doneBy ?? []).includes(s.dinerId);
                  return (
                    <li key={s.dinerId} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-swish/15 text-xs font-bold text-swish-dark">
                        {initials(nameById.get(s.dinerId) ?? "?")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {nameById.get(s.dinerId)}
                          {isDone && <span className="ml-1.5 text-[10px] text-emerald-600">{t.doneOn}</span>}
                        </span>
                        <Money
                          ore={s.totalOre}
                          className={`text-[11px] tabular-nums ${isPaid ? "text-gray-400 line-through" : "text-gray-500"}`}
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePaid(s.dinerId)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-white text-gray-600 ring-gray-300 active:bg-gray-100"
                        }`}
                      >
                        {isPaid ? `✓ ${t.paid}` : t.markPaid}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}

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
                // Anything that isn't "shared by everyone" lives in the
                // category sections — including partial shares, which the
                // diner can claim a share of like a multi-copy item.
                const all = state.items.filter(
                  (it) => !isFullyShared(it, groupSize) && categoryFor(it.description, it.category) === cat,
                );
                if (all.length === 0) return null;
                // Group identical copies (same description, price and share count)
                // so "3 × Bryggkaffe" reads as one row with a counter.
                const groupMap = new Map<string, ItemRow[]>();
                for (const it of all) {
                  const k = groupKey(it);
                  const arr = groupMap.get(k) ?? [];
                  arr.push(it);
                  groupMap.set(k, arr);
                }
                const mainGroups: ItemGroup[] = [];
                const othersGroups: ItemGroup[] = [];
                for (const copies of groupMap.values()) {
                  const mine = copies.filter((c) => personId !== null && c.claimedBy.includes(personId));
                  const available = copies.filter((c) => c.claimedBy.length === 0);
                  const others = copies.filter((c) => c.claimedBy.length > 0 && !(personId !== null && c.claimedBy.includes(personId)));
                  const g: ItemGroup = { copies, mine, available, others };
                  if (mine.length > 0 || available.length > 0) mainGroups.push(g);
                  else othersGroups.push(g);
                }
                const othersClaimerNames = (g: ItemGroup) =>
                  Array.from(new Set(g.copies.flatMap((c) => c.claimedBy)))
                    .map((id) => (id === personId ? t.you : nameById.get(id) ?? "?"))
                    .join(", ");
                const othersTotal = othersGroups.reduce((acc, g) => acc + g.copies.length, 0);
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-700">
                      <span aria-hidden className="text-2xl leading-none">{CATEGORY_EMOJI[cat]}</span>
                      <span>{CATEGORY_LABEL[lang][cat]}</span>
                    </div>
                    {mainGroups.map(renderClaimGroup)}
                    {othersGroups.length > 0 && (
                      <details className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                        <summary className="cursor-pointer text-xs font-medium text-gray-500">{t.claimedTitle(othersTotal)}</summary>
                        <div className="mt-2 space-y-1">
                          {othersGroups.map((g) => {
                            const rep = g.copies[0];
                            const totalCount = g.copies.length;
                            return (
                              <button
                                key={rep.id}
                                type="button"
                                onClick={() => toggleClaim(rep.id)}
                                disabled={busyItem === rep.id}
                                className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm active:bg-gray-100"
                              >
                                <span className="text-emerald-500">✓</span>
                                <span className="min-w-0 flex-1 truncate text-gray-400 line-through">
                                  {rep.description}
                                  {totalCount > 1 && <span className="ml-1">×{totalCount}</span>}
                                </span>
                                <span className="shrink-0 text-xs text-gray-400">{othersClaimerNames(g)}</span>
                                <span className="shrink-0 text-gray-400 line-through">{formatOre(rep.priceOre)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
              {/* "Shared by everyone" lives at the BOTTOM of the items
                  list. Categories carry the diner's eye first because
                  each diner usually has at least one row of their own
                  there; the shared pile is a summary the whole table
                  participates in equally, so it earns its place under
                  the per-category sections. */}
              {state.items.some((it) => isFullyShared(it, groupSize)) && (() => {
                const sharedItems = state.items.filter((it) => isFullyShared(it, groupSize));
                const mySharedOre = sharedItems.reduce((acc, it) => {
                  if (!personId || !it.claimedBy.includes(personId)) return acc;
                  const divisor = it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize;
                  return acc + Math.floor(it.priceOre / divisor);
                }, 0);
                return (
                  <div className="space-y-2">
                    <button
                      ref={sharedHeaderRef}
                      type="button"
                      onClick={() => setSharedOpen((v) => !v)}
                      aria-expanded={sharedOpen}
                      className="flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left text-base font-bold text-gray-700"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronRightIcon
                          className={`shrink-0 text-gray-400 transition-transform duration-200 ease-out ${sharedOpen ? "rotate-90" : ""}`}
                        />
                        <span aria-hidden className="text-2xl leading-none">🤝</span>
                        <span className="truncate">
                          {t.sharedSection} <span className="font-medium text-gray-400">({sharedItems.length})</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end leading-tight">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                          {t.yourTotal}
                        </span>
                        <Money ore={mySharedOre} className="font-bold text-swish-dark" nativeClassName="ml-1 text-xs font-normal text-gray-400" />
                      </span>
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        sharedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="-mx-2 min-h-0 overflow-hidden px-2">
                        <div className="space-y-2 pt-1">{sharedItems.map(claimItemRow)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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

          {/* Guest's own share + pay QR. Hosts get the collection summary
              + diner list at the top of the page instead. */}
          {!isPayee && myShare && (
            myShare.totalOre > 0 ? (
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

          {/* Everyone — guest view only. Hosts have a dedicated diner list
              at the top of the page. */}
          {!isPayee && (
          <section>
            <h2 className="mb-2 text-base font-bold text-gray-700">{t.peopleTitle}</h2>
            <div className="space-y-2">
              {shares.map((s) => {
                const isHostRow = s.dinerId === state.payeePersonId;
                const isPaid = (state.paidBy ?? []).includes(s.dinerId);
                // The host (collector) or the person themselves can settle a share.
                const canToggle = !isHostRow && s.totalOre > 0 && (isPayee || s.dinerId === personId);
                const claimed = claimedNamesFor(s.dinerId);
                const isDone = !isHostRow && (state.doneBy ?? []).includes(s.dinerId);
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
                        {isDone && <span className="ml-1.5 text-xs text-emerald-600">{t.doneOn}</span>}
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
          )}
        </>
      )}
      {!isPayee && myShare && myShare.totalOre > 0 && (() => {
        const iAmDone = !!personId && (state.doneBy ?? []).includes(personId);
        // What I've claimed, aggregated by description so "3 × Bryggkaffe"
        // reads as one cart row.
        const cart: { description: string; count: number; oreEach: number; shared: boolean }[] = [];
        const cartMap = new Map<string, { description: string; count: number; oreEach: number; shared: boolean }>();
        for (const it of state.items) {
          if (!personId || !it.claimedBy.includes(personId)) continue;
          const oreEach = it.shared
            ? Math.floor(it.priceOre / (it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize))
            : Math.floor(it.priceOre / Math.max(1, it.claimedBy.length));
          const k = `${it.description}|${oreEach}|${it.shared ? 1 : 0}`;
          const ex = cartMap.get(k);
          if (ex) ex.count++;
          else cartMap.set(k, { description: it.description, count: 1, oreEach, shared: !!it.shared });
        }
        for (const v of cartMap.values()) cart.push(v);
        cart.sort((a, b) => b.oreEach * b.count - a.oreEach * a.count);
        const cartItemCount = cart.reduce((acc, g) => acc + g.count, 0);
        const canSwish = !!state.payeeNumber;
        const swishUri = canSwish
          ? buildSwishUri({
              payee: state.payeeNumber!,
              amountOre: myShare.totalOre,
              message: `${myShare.name} - ${state.message ?? ""}`.slice(0, 50),
            })
          : null;
        // Pay-and-done: flip done locally, fire a keepalive POST so the action
        // sticks even when the browser hands off to the Swish app.
        const payAndDone = () => {
          if (iAmDone || !personId) return;
          setState((prev) =>
            prev ? { ...prev, doneBy: [...(prev.doneBy ?? []), personId] } : prev,
          );
          try {
            fetch(`/api/room/${code}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "done", personId }),
              keepalive: true,
            });
          } catch {
            /* navigation continues; next refresh reconciles */
          }
        };
        return (
          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/10 bg-ink/95 text-white shadow-lg backdrop-blur">
            {cartOpen && (
              <div className="max-h-[42vh] overflow-y-auto border-b border-white/10 px-4 py-3 text-sm">
                {cart.length === 0 ? (
                  <p className="py-2 text-center text-white/60">{t.cartEmpty}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cart.map((g, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right text-white/60 tabular-nums">{g.count}×</span>
                        <span className="min-w-0 flex-1 truncate">
                          {g.description}
                          {g.shared && <span className="ml-1 text-xs text-white/40">· {tx.sharedToggle.toLowerCase()}</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-white/85">{formatOre(g.count * g.oreEach)} SEK</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left active:bg-white/5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t.yourTotal}</span>
                <span className="truncate text-xs text-white/70">{t.cartCount(cartItemCount)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Money ore={myShare.totalOre} className="text-lg font-bold" nativeClassName="ml-1 text-[11px] font-normal text-white/60" />
                <span className={`text-2xl leading-none text-white/50 transition-transform ${cartOpen ? "rotate-180" : ""}`}>▾</span>
              </span>
            </button>
            {canSwish && swishUri ? (
              <a
                href={swishUri}
                onClick={payAndDone}
                className={`flex items-center justify-center gap-3 border-t border-white/10 px-5 py-4 text-base font-semibold ${
                  iAmDone ? "bg-emerald-500/20 text-emerald-200" : "bg-swish text-white active:bg-swish-dark"
                }`}
              >
                {iAmDone ? (
                  <span>{t.doneOn}</span>
                ) : (
                  <>
                    <SwishIcon size={28} className="shrink-0" />
                    <span>{t.payWithSwishAmt(formatOre(myShare.totalOre))}</span>
                  </>
                )}
              </a>
            ) : (
              <button
                type="button"
                onClick={toggleDone}
                className={`w-full border-t border-white/10 px-5 py-4 text-base font-semibold ${
                  iAmDone ? "bg-emerald-500/20 text-emerald-200" : "text-white/90 active:bg-white/10"
                }`}
              >
                {iAmDone ? t.doneOn : t.imDone}
              </button>
            )}
          </div>
        );
      })()}
      {pendingUndo && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto max-w-md px-4">
          {/* key on description so the countdown restarts when the user removes
              another item before the previous toast expires. */}
          <div key={pendingUndo.description} className="relative overflow-hidden rounded-xl bg-red-600 px-3 py-2.5 text-sm text-white shadow-lg ring-1 ring-red-700/40">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">🗑 {t.removedItem(pendingUndo.description || t.editRow)}</span>
              <button
                type="button"
                onClick={undoRemoval}
                className="shrink-0 rounded-lg bg-white px-3 py-1 font-semibold text-red-700 active:bg-red-50"
              >
                {t.undo}
              </button>
            </div>
            <span aria-hidden className="undo-countdown absolute inset-x-0 bottom-0 h-0.5 bg-white/80" />
          </div>
        </div>
      )}
      {/* Ghost: a card-shaped chip pinned to the source row's bounding
          rect that animates over to the shared-section header via the
          fly-to-shared useLayoutEffect. Lives in a fixed layer so it
          can travel across the page (and off-screen if the shared
          section isn't currently in view). */}
      {flyingItem && (
        <div
          ref={flyingRef}
          aria-hidden
          className="pointer-events-none fixed z-[60] flex items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl ring-2 ring-swish/70"
          style={{
            left: flyingItem.source.x,
            top: flyingItem.source.y,
            width: flyingItem.source.w,
            transformOrigin: "center",
          }}
        >
          <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none">
            <ItemEmoji description={flyingItem.description} hint={flyingItem.category} modelEmoji={flyingItem.emoji} />
          </span>
          <span className="min-w-0 truncate text-base font-medium text-ink">{flyingItem.description}</span>
          <span aria-hidden className="ml-auto shrink-0 text-xl leading-none">🤝</span>
        </div>
      )}
      {/* Positive sister to the undo toast: surfaces when an edit
          promotes a row into the "shared by everyone" pile, so the
          host knows where the item just went. The FLIP animation runs
          the row down to the bottom on its own. */}
      {markedSharedToast && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto max-w-md px-4">
          <div
            key={markedSharedToast.description}
            className="relative overflow-hidden rounded-xl bg-swish px-3 py-2.5 text-sm text-white shadow-lg ring-1 ring-swish-dark/40"
          >
            <p className="pr-1 leading-snug">{t.markedShared(markedSharedToast.description)}</p>
            <span
              aria-hidden
              className="undo-countdown absolute inset-x-0 bottom-0 h-0.5 bg-white/80"
              style={{ animationDuration: "4.2s" }}
            />
          </div>
        </div>
      )}
      {receiptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReceiptOpen(false)}
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
            <span className="text-sm font-medium">{t.showReceipt}</span>
            <button
              type="button"
              onClick={() => setReceiptOpen(false)}
              className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium active:bg-white/25"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6" onClick={(e) => e.stopPropagation()}>
            {receiptImages === null ? (
              <p className="pt-10 text-center text-sm text-white/60">{t.receiptLoading}</p>
            ) : receiptImages.length === 0 ? (
              <p className="pt-10 text-center text-sm text-white/60">—</p>
            ) : (
              <div className="space-y-3">
                {receiptImages.map((src, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={src} alt={`${t.showReceipt} ${i + 1}`} className="w-full rounded-lg" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <QrDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        qrSrc={`/api/room/${code}/qr`}
        title={state.place || "Kvitt"}
        subtitle={`${t.scanToJoin} · ${code}`}
        shareUrl={shareUrl}
        shareTitle={state.place || "Kvitt"}
        shareText={shareText}
        download={`kvitt-${code}.png`}
        labels={{ share: t.share, copied: t.copied, copyLink: t.copyLink, close: t.close, save: t.saveQr }}
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

// Lucide "pencil" — flat stroked icon. Used for the per-item edit buttons.
function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

// Lucide "chevron-right" — used for the collapsible shared section header.
function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
