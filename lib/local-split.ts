/**
 * Persistence for splits done without a live room (the "split it yourself"
 * flow). A room lives server-side; a local split is saved only in this browser
 * so the host can reopen it, show the QR codes again, and tick off who's paid.
 */

export type LocalSplitShare = { id: string; name: string; totalOre: number };

export type LocalSplit = {
  id: string;
  createdAt: number;
  place: string;
  date: string;
  message: string;
  currency: string;
  rate: number;
  country: string;
  method: "swish" | "sepa";
  payeeName: string;
  payeeNumber: string;
  payeeIban: string;
  /** The people who owe the host (excludes the host's own share). */
  shares: LocalSplitShare[];
  /** Share ids marked settled. */
  paidBy: string[];
};

const key = (id: string) => `swisher-split:${id}`;

export function readLocalSplit(id: string): LocalSplit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.id !== "string" || !Array.isArray(v.shares)) return null;
    return { paidBy: [], ...v } as LocalSplit;
  } catch {
    return null;
  }
}

export function saveLocalSplit(split: LocalSplit): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(split.id), JSON.stringify(split));
  } catch {
    /* storage unavailable */
  }
}

export function removeLocalSplit(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* storage unavailable */
  }
}

export function toggleLocalPaid(id: string, shareId: string): LocalSplit | null {
  const split = readLocalSplit(id);
  if (!split) return null;
  const i = split.paidBy.indexOf(shareId);
  if (i >= 0) split.paidBy.splice(i, 1);
  else split.paidBy.push(shareId);
  saveLocalSplit(split);
  return split;
}
