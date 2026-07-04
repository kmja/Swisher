import { DurableObject } from "cloudflare:workers";
import { isFullyShared } from "./money";

export type RoomItem = {
  id: string;
  description: string;
  priceOre: number;
  category?: string;
  /** Emoji the model picked for this item (brand-aware fallback). */
  emoji?: string;
  /** Split across the whole group (pre-claimed for everyone), not claim-one. */
  shared?: boolean;
  /** Fixed number of ways a shared item splits; falls back to the room size. */
  shareCount?: number;
  /** Person ids who claimed this item. Multiple claimers = split equally. */
  claimedBy: string[];
  /** Vertical position on the source photo as a 0–1 fraction from the top. */
  y?: number;
  /** Index into the room's stored receipt images array. */
  imgIndex?: number;
  /** English translation of the description when the receipt is in a foreign language. */
  translation?: string;
};

export type RoomPerson = { id: string; name: string };

export type RoomState = {
  id: string;
  createdAt: number;
  payeeName: string;
  payeeNumber: string;
  /** Payout rail the host collects on. */
  method: "swish" | "sepa";
  /** Beneficiary IBAN for SEPA/EPC payouts (empty for Swish). */
  payeeIban: string;
  /** The host's own person id — they collect, so they never get a QR. */
  payeePersonId: string;
  message: string;
  /** Restaurant/place and date read from the receipt, shown so everyone remembers. */
  place: string;
  date: string;
  tipOre: number;
  /** Foreign-currency context for display; amounts are always stored in SEK öre. */
  currency: string;
  /** SEK per 1 unit of `currency`; 1 for SEK receipts. */
  rate: number;
  /** ISO 3166-1 alpha-2 country the receipt was issued in, for the header flag. */
  country: string;
  /** Number of receipt photos stored separately under the "images" key. */
  imageCount: number;
  /** Host's intended head count. Used as the fallback divisor for shared items
   *  before everyone has joined, and as the upper bound for the share-count
   *  stepper so the host can't accidentally split a dish more ways than the
   *  table actually has people. */
  groupSize?: number;
  items: RoomItem[];
  people: RoomPerson[];
  /** Person ids the host (or the person themselves) has marked as settled. */
  paidBy: string[];
  /** Person ids who've ticked "I'm done claiming" — a social signal, not auth. */
  doneBy?: string[];
};

export type RoomInit = {
  id: string;
  /** Optional client-provided host person id. Lets the items page
   *  navigate to the room with an optimistic state whose
   *  payeePersonId matches what the server eventually stores, so the
   *  bootstrap state and the first server poll don't disagree on
   *  who the host is. Falls back to a fresh uid() when absent. */
  hostId?: string;
  payeeName: string;
  payeeNumber: string;
  method?: "swish" | "sepa";
  payeeIban?: string;
  message: string;
  place?: string;
  date?: string;
  tipOre: number;
  currency?: string;
  rate?: number;
  country?: string;
  /** Receipt photos as base64 data URLs. Stored under a separate storage key so
   *  per-claim state writes stay small; fetched via the /images endpoint. */
  images?: string[];
  groupSize?: number;
  items: { id?: string; description: string; priceOre: number; category?: string; emoji?: string; shared?: boolean; shareCount?: number; y?: number; imgIndex?: number; translation?: string }[];
};

const uid = () => crypto.randomUUID();

/**
 * One live bill-splitting room. State is the single source of truth for who
 * joined and which items they claimed; the Durable Object's single-threaded
 * execution means concurrent claims can't race.
 */
export class RoomDO extends DurableObject {
  private async load(): Promise<RoomState | null> {
    return (await this.ctx.storage.get<RoomState>("state")) ?? null;
  }
  private async save(state: RoomState): Promise<void> {
    await this.ctx.storage.put("state", state);
    // Every mutation funnels through here, so broadcasting here keeps all
    // connected phones live without each action having to remember to.
    const msg = JSON.stringify({ type: "state", state });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* socket mid-close; it'll be reaped by webSocketClose */
      }
    }
  }

  /** WebSocket upgrade — reached directly from worker.ts (Next.js route
   *  handlers can't return 101s). Uses the hibernation API so idle rooms
   *  are evicted from memory while their sockets stay open. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  }

  /** Clients send "ping" as a keepalive; anything else is ignored — all
   *  mutations go through the HTTP actions, sockets are receive-only. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") {
      try {
        ws.send("pong");
      } catch {
        /* closing */
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }

  /** Idempotent: returns the existing room if already initialised. */
  async init(data: RoomInit): Promise<RoomState> {
    const existing = await this.load();
    if (existing) return existing;
    // Honour a client-supplied host id when it's well-formed (UUID),
    // so the items page's optimistic state lines up with what we
    // store. Falls back to a fresh id otherwise.
    const validUid = (s: unknown): s is string =>
      typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
    const hostId = validUid(data.hostId) ? data.hostId : uid();
    const host: RoomPerson = { id: hostId, name: data.payeeName.trim().slice(0, 40) || "Värd" };
    const state: RoomState = {
      id: data.id,
      createdAt: Date.now(),
      payeeName: host.name,
      payeeNumber: data.payeeNumber,
      method: data.method === "sepa" ? "sepa" : "swish",
      payeeIban: (data.payeeIban ?? "").slice(0, 40),
      payeePersonId: host.id,
      message: data.message.slice(0, 50),
      place: (data.place ?? "").slice(0, 60),
      date: (data.date ?? "").slice(0, 20),
      tipOre: Math.max(0, Math.round(data.tipOre || 0)),
      currency: (data.currency ?? "SEK").slice(0, 3).toUpperCase() || "SEK",
      rate: typeof data.rate === "number" && data.rate > 0 ? data.rate : 1,
      country: (data.country ?? "").slice(0, 2).toUpperCase(),
      imageCount: Array.isArray(data.images) ? Math.min(data.images.length, 5) : 0,
      groupSize:
        typeof data.groupSize === "number" && data.groupSize >= 2
          ? Math.min(50, Math.round(data.groupSize))
          : undefined,
      items: data.items.map((it) => {
        const shareCount =
          typeof it.shareCount === "number" && it.shareCount > 0 ? Math.round(it.shareCount) : undefined;
        // Only "fully shared" lines pre-claim the host. A partial share (e.g.
        // one bottle for 2 of 4 at the table) stays open so people opt in.
        const groupSize =
          typeof data.groupSize === "number" && data.groupSize >= 2 ? Math.round(data.groupSize) : 1;
        const fully = isFullyShared({ shared: it.shared === true, shareCount }, groupSize);
        return {
          id: validUid(it.id) ? it.id : uid(),
          description: it.description.slice(0, 80),
          priceOre: Math.max(0, Math.round(it.priceOre)),
          category: it.category,
          emoji: it.emoji,
          shared: it.shared === true,
          shareCount,
          claimedBy: fully ? [host.id] : [],
          y: typeof it.y === "number" && Number.isFinite(it.y) ? Math.max(0, Math.min(1, it.y)) : undefined,
          imgIndex: typeof it.imgIndex === "number" && it.imgIndex >= 0 ? it.imgIndex : undefined,
          translation: typeof it.translation === "string" && it.translation ? it.translation.slice(0, 120) : undefined,
        };
      }),
      people: [host],
      paidBy: [],
      doneBy: [],
    };
    await this.save(state);
    if (Array.isArray(data.images) && data.images.length > 0) {
      // Store each image under its own key so no single storage value has
      // to hold all of them at once (an array of several base64 photos can
      // exceed the per-value limit and throw). Guard so a storage hiccup
      // never fails room creation — the receipt photos are a nice-to-have,
      // not core state.
      try {
        const imgs = data.images.slice(0, 5);
        await Promise.all(imgs.map((img, i) => this.ctx.storage.put(`image:${i}`, img)));
      } catch {
        /* images are non-critical; the room still works without them */
      }
    }
    return state;
  }

  async getState(): Promise<RoomState | null> {
    return this.load();
  }

  /** Receipt photos, served via the /images endpoint (kept out of state for speed). */
  async getImages(): Promise<string[]> {
    // Per-image keys (image:0 … image:4), read in index order. We store at
    // most 5, so a fixed-range read avoids needing storage.list().
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = await this.ctx.storage.get<string>(`image:${i}`);
      if (typeof v === "string" && v) out.push(v);
    }
    if (out.length > 0) return out;
    // Fall back to the legacy single-array key for rooms created before the split.
    const legacy = await this.ctx.storage.get<string[]>("images");
    return Array.isArray(legacy) ? legacy : [];
  }

  async join(name: string): Promise<{ personId: string; state: RoomState } | null> {
    const state = await this.load();
    if (!state) return null;
    const person: RoomPerson = { id: uid(), name: name.trim().slice(0, 40) || "Gäst" };
    state.people.push(person);
    // Only pre-claim "fully shared" items (the kind everyone takes a share of
    // by default). Partial shares — one bottle for 2 of 4, etc. — stay open
    // so the newcomer has to opt in by tapping.
    const groupSize = Math.max(state.groupSize ?? 0, state.people.length);
    for (const it of state.items) {
      if (!isFullyShared(it, groupSize)) continue;
      if (!it.claimedBy.includes(person.id)) it.claimedBy.push(person.id);
    }
    await this.save(state);
    return { personId: person.id, state };
  }

  async toggleClaim(personId: string, itemId: string): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.people.some((p) => p.id === personId)) return state;
    const item = state.items.find((i) => i.id === itemId);
    if (item) {
      const idx = item.claimedBy.indexOf(personId);
      if (idx >= 0) item.claimedBy.splice(idx, 1);
      else item.claimedBy.push(personId);
      await this.save(state);
    }
    return state;
  }

  /**
   * Mark a person as having settled their share (or unmark). Only the host
   * (who collects) or the person themselves may change it — payment status is
   * bookkeeping; the app never moves money.
   */
  async togglePaid(actorId: string, targetId: string): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.paidBy) state.paidBy = [];
    const allowed = actorId === state.payeePersonId || actorId === targetId;
    const isPerson = state.people.some((p) => p.id === targetId);
    if (allowed && isPerson && targetId !== state.payeePersonId) {
      const idx = state.paidBy.indexOf(targetId);
      if (idx >= 0) state.paidBy.splice(idx, 1);
      else state.paidBy.push(targetId);
      await this.save(state);
    }
    return state;
  }

  /** A person marks themselves as done claiming items — a social signal so the
   *  host knows everyone's checked, nothing more. */
  async toggleDone(personId: string): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.doneBy) state.doneBy = [];
    if (!state.people.some((p) => p.id === personId)) return state;
    const idx = state.doneBy.indexOf(personId);
    if (idx >= 0) state.doneBy.splice(idx, 1);
    else state.doneBy.push(personId);
    await this.save(state);
    return state;
  }

  /** Any diner can fix a mis-read line (description, price in öre, shared/count). */
  async editItem(
    actorId: string,
    itemId: string,
    patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number | null },
  ): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.people.some((p) => p.id === actorId)) return state;
    const item = state.items.find((i) => i.id === itemId);
    if (item) {
      if (typeof patch.description === "string") item.description = patch.description.slice(0, 80);
      if (typeof patch.priceOre === "number" && Number.isFinite(patch.priceOre) && patch.priceOre >= 0) {
        item.priceOre = Math.round(patch.priceOre);
      }
      // shareCount has to land BEFORE the shared toggle decides whether to
      // pre-claim everyone — otherwise turning an unshared item into a
      // partial share (e.g. 3 ways in a 6-person room) sends shared+shareCount
      // in the same patch, the shared block reads the old (undefined)
      // shareCount, isFullyShared returns true, and we wrongly pre-claim the
      // whole room.
      if (patch.shareCount === null || patch.shareCount === 0) item.shareCount = undefined;
      else if (typeof patch.shareCount === "number" && patch.shareCount > 0) item.shareCount = Math.round(patch.shareCount);
      if (typeof patch.shared === "boolean" && patch.shared !== item.shared) {
        item.shared = patch.shared;
        // Turning shared on pre-claims it for everyone only when the result is
        // a *fully* shared item; partial shares stay open so the table opts in.
        if (patch.shared) {
          const groupSize = Math.max(state.groupSize ?? 0, state.people.length);
          item.claimedBy = isFullyShared(item, groupSize) ? state.people.map((p) => p.id) : [];
        }
      }
      // Catch promotions where `shared` didn't flip but shareCount alone
      // bumped the item into the fully-shared band — e.g. a partial 4/6
      // edited up to 6/6. The block above doesn't fire (patch.shared ===
      // item.shared), so without this sweep the row lands in the "Delas
      // av alla" section with an empty claimedBy. Anyone already on the
      // list stays; we just additively add everyone who's missing.
      {
        const groupSize = Math.max(state.groupSize ?? 0, state.people.length);
        if (item.shared && isFullyShared(item, groupSize)) {
          for (const p of state.people) {
            if (!item.claimedBy.includes(p.id)) item.claimedBy.push(p.id);
          }
        }
      }
      await this.save(state);
    }
    return state;
  }

  /** Only the host can change their displayed name or Swish number — the
   *  payment messages and QRs the diners scan are pinned to those. */
  async editPayee(
    actorId: string,
    patch: { name?: string; number?: string; groupSize?: number },
  ): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (actorId !== state.payeePersonId) return state;
    if (typeof patch.name === "string") {
      const next = patch.name.trim().slice(0, 40);
      if (next) {
        state.payeeName = next;
        const host = state.people.find((p) => p.id === state.payeePersonId);
        if (host) host.name = next;
      }
    }
    if (typeof patch.number === "string") {
      state.payeeNumber = patch.number.slice(0, 20);
    }
    if (typeof patch.groupSize === "number" && Number.isFinite(patch.groupSize) && patch.groupSize >= 2) {
      const oldGroupSize = state.groupSize ?? 0;
      state.groupSize = Math.min(50, Math.round(patch.groupSize));
      // Items get their shareCount frozen at room-creation time so the
      // host-only "1 person at the table" headcount doesn't divide
      // shares 1-way. When the host re-tunes groupSize after the fact
      // we want the *fully shared* items to follow — partial shares
      // (a bottle for 2 of 4) keep their intent. "Fully shared" here
      // means the shareCount matched the previous groupSize, or there
      // was no shareCount (which already defaults to groupSize).
      for (const it of state.items) {
        if (!it.shared) continue;
        if (it.shareCount == null || it.shareCount === oldGroupSize) {
          it.shareCount = state.groupSize;
        }
      }
      // Re-evaluate fully-shared items: anyone in the room should be
      // auto-claimed on items the whole table shares. A bigger
      // groupSize might mean a previously-fully-shared row is now only
      // partial — leave the existing claimedBy alone in that case
      // (partial-share state surfaces via isFullyShared on read).
      for (const it of state.items) {
        if (!it.shared) continue;
        if (isFullyShared(it, state.groupSize)) {
          for (const p of state.people) {
            if (!it.claimedBy.includes(p.id)) it.claimedBy.push(p.id);
          }
        }
      }
    }
    await this.save(state);
    return state;
  }

  /** Any diner can drop a line OCR invented or that doesn't belong. */
  async removeItem(actorId: string, itemId: string): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.people.some((p) => p.id === actorId)) return state;
    state.items = state.items.filter((i) => i.id !== itemId);
    await this.save(state);
    return state;
  }

  /** Any diner can add a line OCR missed. Shared lines are pre-claimed for all.
   *  Optional fields let an "undo remove" call round-trip the item's category,
   *  emoji and share-count so the restored row looks identical. An optional
   *  `index` inserts the item at that position instead of appending — used by
   *  undo to put a removed item back where it was. */
  async addItem(
    actorId: string,
    data: {
      description: string;
      priceOre: number;
      shared?: boolean;
      shareCount?: number;
      category?: string;
      emoji?: string;
      index?: number;
    },
  ): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    if (!state.people.some((p) => p.id === actorId)) return state;
    const priceOre = Math.max(0, Math.round(Number(data.priceOre) || 0));
    if (!data.description?.trim() || priceOre <= 0) return state;
    const shareCount =
      typeof data.shareCount === "number" && data.shareCount > 0 ? Math.round(data.shareCount) : undefined;
    const groupSize = Math.max(state.groupSize ?? 0, state.people.length);
    const fully = isFullyShared({ shared: data.shared === true, shareCount }, groupSize);
    const newItem: RoomItem = {
      id: uid(),
      description: String(data.description).slice(0, 80),
      priceOre,
      category: typeof data.category === "string" ? data.category : undefined,
      emoji: typeof data.emoji === "string" ? data.emoji : undefined,
      shared: data.shared === true,
      shareCount,
      claimedBy: fully ? state.people.map((p) => p.id) : [],
    };
    const insertAt =
      typeof data.index === "number" && data.index >= 0 && data.index <= state.items.length
        ? Math.floor(data.index)
        : state.items.length;
    state.items.splice(insertAt, 0, newItem);
    await this.save(state);
    return state;
  }
}
