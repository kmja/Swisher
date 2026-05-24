import { DurableObject } from "cloudflare:workers";

export type RoomItem = {
  id: string;
  description: string;
  priceOre: number;
  category?: string;
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
  tipPercent: number;
  items: RoomItem[];
  people: RoomPerson[];
};

export type RoomInit = {
  id: string;
  payeeName: string;
  payeeNumber: string;
  message: string;
  tipPercent: number;
  items: { description: string; priceOre: number; category?: string }[];
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
      tipPercent: Math.max(0, Math.min(100, Math.round(data.tipPercent || 0))),
      items: data.items.map((it) => ({
        id: uid(),
        description: it.description.slice(0, 80),
        priceOre: Math.max(0, Math.round(it.priceOre)),
        category: it.category,
        claimedBy: [],
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

  async setTip(percent: number): Promise<RoomState | null> {
    const state = await this.load();
    if (!state) return null;
    state.tipPercent = Math.max(0, Math.min(100, Math.round(percent)));
    await this.save(state);
    return state;
  }
}
