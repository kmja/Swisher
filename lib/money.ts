import type { Diner, LineItem, Share } from "./types";

/**
 * Parse a Swedish-formatted amount into integer öre.
 * Accepts "185", "185,50", "185.50", "1 234,00", "1.234,50", "12kr".
 * Returns null when the input has no parseable number.
 */
export function parseAmountToOre(input: string): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase().replace(/kr|sek|:-/g, "").trim();
  if (!s) return null;

  // Strip spaces used as thousands separators.
  s = s.replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator; the other is grouping.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Format integer öre as a Swedish SEK string, e.g. 18550 -> "185,50". */
export function formatOre(ore: number): string {
  const sign = ore < 0 ? "-" : "";
  const abs = Math.abs(ore);
  const kronor = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = kronor.toLocaleString("sv-SE").replace(/ /g, " ");
  return `${sign}${grouped},${rest.toString().padStart(2, "0")}`;
}

/** Like formatOre but drops the ",00" tail for whole-kronor amounts, so
 *  user-facing displays read "185" instead of "185,00" while keeping
 *  "185,50" exact. Use formatOre for inputs/editing where the trailing
 *  zero matters. */
export function formatOreTrim(ore: number): string {
  const s = formatOre(ore);
  return s.endsWith(",00") ? s.slice(0, -3) : s;
}

/** Convert öre to a kronor number (max 2 decimals) for the Swish amount field. */
export function oreToKronor(ore: number): number {
  return Math.round(ore) / 100;
}

/**
 * "Fully shared" = everyone at the table is expected to take a share, so the
 * item gets pre-claimed for the host at room-creation and for each newcomer on
 * join. A partial share (e.g. one bottle split 2 ways at a table of 4) is NOT
 * fully shared — newcomers must opt in by tapping. shareCount is the source of
 * truth; if it isn't set the item defaults to the head count, which is the
 * definition of fully shared.
 */
export function isFullyShared(
  item: { shared?: boolean; shareCount?: number | null },
  groupSize: number,
): boolean {
  if (!item.shared) return false;
  if (!item.shareCount || item.shareCount <= 0) return true;
  return item.shareCount >= Math.max(1, groupSize);
}

/**
 * Split a single item's price across its sharers with exact öre accounting:
 * the base share is floored and the leftover öre are handed out one-by-one to
 * the first sharers, so the per-sharer amounts always sum back to priceOre.
 */
export function splitOre(priceOre: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(priceOre / count);
  let remainder = priceOre - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}

/**
 * Compute each diner's share.
 * @param tipOre total tip (dricks) read from the receipt, split equally across
 *   the whole group as an unskippable part of each person's share. Moms is
 *   already price-inclusive on Swedish receipts, so no proportional tax math.
 * @param groupSize divisor for shared items. When > 0, shared items split that
 *   many ways (shares beyond the present diners count as unassigned); when 0,
 *   shared items split across the diners present.
 */
export function computeShares(
  items: LineItem[],
  diners: Diner[],
  tipOre = 0,
  groupSize = 0,
): { shares: Share[]; unassignedOre: number } {
  const subtotals = new Map<string, number>();
  for (const d of diners) subtotals.set(d.id, 0);

  let unassignedOre = 0;
  for (const item of items) {
    if (item.shared) {
      const rawDivisor =
        item.shareCount && item.shareCount > 0 ? item.shareCount : groupSize > 0 ? groupSize : diners.length;
      // Cap to groupSize only when the host has declared one — a per-item
      // shareCount larger than diners.length is legitimate (people haven't
      // joined yet), but shareCount > declared groupSize is always a bug.
      const divisor = groupSize > 0 ? Math.min(rawDivisor, groupSize) : rawDivisor;
      if (divisor <= 0) {
        unassignedOre += item.priceOre;
        continue;
      }
      const parts = splitOre(item.priceOre, divisor);
      const covered = Math.min(diners.length, divisor);
      for (let i = 0; i < covered; i++) {
        subtotals.set(diners[i].id, (subtotals.get(diners[i].id) ?? 0) + parts[i]);
      }
      // Shares for people not present (group larger than the diner list).
      for (let i = covered; i < divisor; i++) unassignedOre += parts[i];
      continue;
    }
    const sharers = item.sharers.filter((id) => subtotals.has(id));
    if (sharers.length === 0) {
      unassignedOre += item.priceOre;
      continue;
    }
    const parts = splitOre(item.priceOre, sharers.length);
    sharers.forEach((id, i) => {
      subtotals.set(id, (subtotals.get(id) ?? 0) + parts[i]);
    });
  }

  const tipParts = diners.length > 0 ? splitOre(Math.max(0, Math.round(tipOre)), diners.length) : [];
  const shares: Share[] = diners.map((d, i) => {
    const subtotalOre = subtotals.get(d.id) ?? 0;
    const tipShare = tipParts[i] ?? 0;
    return {
      dinerId: d.id,
      name: d.name,
      subtotalOre,
      tipOre: tipShare,
      totalOre: subtotalOre + tipShare,
    };
  });

  return { shares, unassignedOre };
}

export function sumItemsOre(items: LineItem[]): number {
  return items.reduce((acc, item) => acc + item.priceOre, 0);
}

/**
 * Guess how many people are at the table from the individual (non-shared)
 * items, to seed the shared-item divisor. Mains track headcount best (≈ one per
 * person), so when there are any we trust their count (with dessert as a floor)
 * and ignore drinks, since people often have several. With no mains we fall
 * back to drinks (discounted for refills), then to a rough items count.
 * Clamped to 2–12; it's only a starting point the host can adjust.
 */
export function estimateGroupSize(counts: { food: number; drink: number; dessert: number; total: number }): number {
  let est: number;
  if (counts.food > 0) est = Math.max(counts.food, counts.dessert);
  else if (counts.drink > 0) est = Math.max(Math.round(counts.drink / 1.5), counts.dessert);
  else est = Math.max(counts.dessert, Math.round(counts.total / 4));
  return Math.min(12, Math.max(2, est));
}

/**
 * Live-room shares from per-item claims. A normal item splits equally among the
 * people who claimed it. A `shared` item splits across the WHOLE group (one
 * per-person share each), pre-claimed for everyone; a person who deselects it
 * simply drops their share (it becomes unassigned, not redistributed). Tip
 * splits equally across everyone.
 */
/** What one diner owes for one item: the öre and how many portions (shares)
 *  that covers — used to render a cart that reconciles exactly to the share. */
export type ItemOwe = { ore: number; portions: number };

export function computeRoomShares(
  items: { id?: string; priceOre: number; shared?: boolean; shareCount?: number; claimedBy: string[] }[],
  people: Diner[],
  tipOre = 0,
  /** Host-declared head count; used as the shared-item divisor when no
   *  per-item shareCount is set. Prevents a host-only room (n=1) from
   *  splitting "shared for 4" items 1-way. */
  groupSize = 0,
): {
  shares: Share[];
  unassignedOre: number;
  /** personId → (itemKey → what they owe). Sums (over items) to their subtotal,
   *  so a cart built from this + the tip reconciles to totalOre exactly. */
  perItem: Map<string, Map<string, ItemOwe>>;
} {
  const byId = new Map(people.map((p) => [p.id, p]));
  const seatsOf = (p: Diner) => Math.max(1, Math.round(p.seats ?? 1));
  const subtotals = new Map<string, number>();
  const perItem = new Map<string, Map<string, ItemOwe>>();
  for (const p of people) {
    perItem.set(p.id, new Map());
  }
  const owe = (pid: string, key: string, ore: number, portions: number) => {
    if (ore <= 0) return;
    perItem.get(pid)?.set(key, { ore, portions });
  };
  for (const p of people) subtotals.set(p.id, 0);
  // Effective head count = total seats (a diner paying for 2 counts as 2), so
  // shared items and the tip divide by real heads, not app users. With every
  // seats = 1 this is exactly the old people.length behaviour.
  const totalSeats = people.reduce((acc, p) => acc + seatsOf(p), 0);
  const fallbackDivisor = Math.max(1, groupSize, totalSeats);
  let unassignedOre = 0;

  items.forEach((item, idx) => {
    const key = item.id ?? String(idx);
    const claimers = item.claimedBy
      .map((id) => byId.get(id))
      .filter((p): p is Diner => !!p);
    if (item.shared) {
      const rawDivisor = item.shareCount && item.shareCount > 0 ? item.shareCount : fallbackDivisor;
      const divisor = groupSize > 0 ? Math.min(rawDivisor, fallbackDivisor) : rawDivisor;
      const parts = splitOre(item.priceOre, divisor);
      // Hand each claimer `seats` of the equal parts, in claim order, capped at
      // what's left — so a diner paying for 2 covers two of the shared portions.
      let cursor = 0;
      for (const p of claimers) {
        if (cursor >= parts.length) break;
        const take = Math.min(seatsOf(p), parts.length - cursor);
        let sum = 0;
        for (let k = 0; k < take; k++) sum += parts[cursor + k];
        cursor += take;
        subtotals.set(p.id, (subtotals.get(p.id) ?? 0) + sum);
        owe(p.id, key, sum, take);
      }
      const covered = parts.slice(0, cursor).reduce((a, b) => a + b, 0);
      unassignedOre += item.priceOre - covered;
    } else if (claimers.length === 0) {
      unassignedOre += item.priceOre;
    } else {
      // A specific (non-shared) dish splits by number of claimers, not seats.
      const parts = splitOre(item.priceOre, claimers.length);
      claimers.forEach((p, i) => {
        subtotals.set(p.id, (subtotals.get(p.id) ?? 0) + parts[i]);
        owe(p.id, key, parts[i], 1);
      });
    }
  });

  // Tip divides across all seats; each diner pays for the seats they cover.
  const tipParts = totalSeats > 0 ? splitOre(Math.max(0, Math.round(tipOre)), totalSeats) : [];
  let tipCursor = 0;
  const shares: Share[] = people.map((p) => {
    const subtotalOre = subtotals.get(p.id) ?? 0;
    let tip = 0;
    const take = seatsOf(p);
    for (let k = 0; k < take && tipCursor < tipParts.length; k++) tip += tipParts[tipCursor++];
    return { dinerId: p.id, name: p.name, subtotalOre, tipOre: tip, totalOre: subtotalOre + tip };
  });
  return { shares, unassignedOre, perItem };
}
