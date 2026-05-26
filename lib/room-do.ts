import { DurableObject } from "cloudflare:workers";

export type RoomItem = {
  id: string;
  description: string;
  priceOre: number;
  category?: string;
  /** Emoji the model picked for this item (brand-aware fallback). */
  emoji?: string;
  /** Split across the whole group (pre-claimed for everyone), not claim-one. */
  shared?: boolean;
  /** Person ids who claimed this item. Multiple claimers = split equally. */
  claimedBy: string[];
};

export type RoomPerson = { id: string; name: string };

export type RoomState = {
  id: string;
  createdAt: number;
  payeeName: string;
  payeeNumber: string;
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
  items: RoomItem[];
  people: RoomPerson[];
};

export type RoomInit = {
  id: string;
  payeeName: string;
  payeeNumber: string;
  message: string;
  place?: string;
  date?: string;
  tipOre: number;
  currency?: string;
  rate?: number;
  items: { description: string; priceOre: number; category?: string; emoji?: string; shared?: boolean }[];
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
  }

  /** Idempotent: returns the existing room if already initialised. */
  async init(data: RoomInit): Promise<RoomState> {
    const existing = await this.load();
    if (existing) return existing;
    const host: RoomPerson = { id: uid(), name: data.payeeName.trim().slice(0, 40) || "Värd" };
    const state: RoomState = {
      id: data.id,
      createdAt: Date.now(),
      payeeName: host.name,
      payeeNumber: data.payeeNumber,
      payeePersonId: host.id,
      message: data.message.slice(0, 50),
      place: (data.place ?? "").slice(0, 60),
      date: (data.date ?? "").slice(0, 20),
      tipOre: Math.max(0, Math.round(data.tipOre || 0)),
      currency: (data.currency ?? "SEK").slice(0, 3).toUpperCase() || "SEK",
      rate: typeof data.rate === "number" && data.rate > 0 ? data.rate : 1,
      items: data.items.map((it) => ({
        id: uid(),
        description: it.description.slice(0, 80),
        priceOre: Math.max(0, Math.round(it.priceOre)),
        category: it.category,
        emoji: it.emoji,
        shared: it.shared === true,
        // Shared items start claimed by the host (and each diner as they join).
        claimedBy: it.shared === true ? [host.id] : [],
      })),
      people: [host],
    };
    await this.save(state);
    return state;
  }

  async getState(): Promise<RoomState | null> {
    return this.load();
  }

  async join(name: string): Promise<{ personId: string; state: RoomState } | null> {
    const state = await this.load();
    if (!state) return null;
    const person: RoomPerson = { id: uid(), name: name.trim().slice(0, 40) || "Gäst" };
    state.people.push(person);
    // Shared items are split across the whole group, so pre-claim them for the
    // newcomer (they can deselect to opt out of their share).
    for (const it of state.items) if (it.shared && !it.claimedBy.includes(person.id)) it.claimedBy.push(person.id);
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
}
