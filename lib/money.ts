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

/** Convert öre to a kronor number (max 2 decimals) for the Swish amount field. */
export function oreToKronor(ore: number): number {
  return Math.round(ore) / 100;
}

/**
 * Split a single item's price across its sharers with exact öre accounting:
 * the base share is floored and the leftover öre are handed out one-by-one to
 * the first sharers, so the per-sharer amounts always sum back to priceOre.
 */
function splitItemOre(priceOre: number, count: number): number[] {
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
 * @param tipPercent applied per-person to that person's subtotal (moms is
 *   already price-inclusive on Swedish receipts, so no proportional tax math).
 * @param groupSize divisor for shared items. When > 0, shared items split that
 *   many ways (shares beyond the present diners count as unassigned); when 0,
 *   shared items split across the diners present.
 */
export function computeShares(
  items: LineItem[],
  diners: Diner[],
  tipPercent: number,
  groupSize = 0,
): { shares: Share[]; unassignedOre: number } {
  const subtotals = new Map<string, number>();
  for (const d of diners) subtotals.set(d.id, 0);

  let unassignedOre = 0;
  for (const item of items) {
    if (item.shared) {
      const divisor = groupSize > 0 ? groupSize : diners.length;
      if (divisor <= 0) {
        unassignedOre += item.priceOre;
        continue;
      }
      const parts = splitItemOre(item.priceOre, divisor);
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
    const parts = splitItemOre(item.priceOre, sharers.length);
    sharers.forEach((id, i) => {
      subtotals.set(id, (subtotals.get(id) ?? 0) + parts[i]);
    });
  }

  const shares: Share[] = diners.map((d) => {
    const subtotalOre = subtotals.get(d.id) ?? 0;
    const tipOre = Math.round((subtotalOre * tipPercent) / 100);
    return {
      dinerId: d.id,
      name: d.name,
      subtotalOre,
      tipOre,
      totalOre: subtotalOre + tipOre,
    };
  });

  return { shares, unassignedOre };
}

export function sumItemsOre(items: LineItem[]): number {
  return items.reduce((acc, item) => acc + item.priceOre, 0);
}
