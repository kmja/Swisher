/**
 * Local list of split receipts (live rooms) the user has hosted or joined, so
 * they can return to a past split and see what's still outstanding. Stored only
 * in the browser — the rooms themselves live server-side, keyed by code.
 */

const KEY = "swisher-history";
const MAX = 50;

export type HistoryEntry = {
  /** Room code. */
  id: string;
  place: string;
  date: string;
  role: "host" | "guest";
  /** When this entry was first added locally (ms). */
  addedAt: number;
};

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is HistoryEntry => e && typeof e.id === "string")
      .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  } catch {
    return [];
  }
}

/** Add or refresh an entry (deduped by room code), keeping the newest MAX. */
export function addHistory(entry: Omit<HistoryEntry, "addedAt"> & { addedAt?: number }): void {
  if (typeof window === "undefined" || !entry.id) return;
  try {
    const existing = readHistory();
    const prev = existing.find((e) => e.id === entry.id);
    const merged: HistoryEntry = {
      id: entry.id,
      place: entry.place || prev?.place || "",
      date: entry.date || prev?.date || "",
      role: entry.role || prev?.role || "guest",
      addedAt: prev?.addedAt ?? entry.addedAt ?? Date.now(),
    };
    const next = [merged, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function removeHistory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(readHistory().filter((e) => e.id !== id)));
  } catch {
    /* storage unavailable */
  }
}
