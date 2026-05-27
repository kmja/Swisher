import { describe, it, expect, beforeEach } from "vitest";
import { readLocalSplit, saveLocalSplit, toggleLocalPaid, removeLocalSplit, type LocalSplit } from "../lib/local-split";

// The store guards on `window`; emulate a browser with an in-memory localStorage.
beforeEach(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  (globalThis as { window?: unknown }).window = globalThis;
  (globalThis as { localStorage?: Storage }).localStorage = ls;
});

const sample: LocalSplit = {
  id: "abc",
  createdAt: 1,
  place: "Trattoria",
  date: "2026-05-20",
  message: "Middag 2026-05-20",
  currency: "EUR",
  rate: 11.4,
  country: "IT",
  method: "sepa",
  payeeName: "Ada",
  payeeNumber: "",
  payeeIban: "DE89370400440532013000",
  shares: [
    { id: "B", name: "Bo", totalOre: 5000 },
    { id: "C", name: "Cy", totalOre: 3000 },
  ],
  paidBy: [],
};

describe("local split persistence", () => {
  it("round-trips a saved split", () => {
    saveLocalSplit(sample);
    expect(readLocalSplit("abc")?.shares).toHaveLength(2);
    expect(readLocalSplit("missing")).toBeNull();
  });

  it("toggles paid status on and off", () => {
    saveLocalSplit(sample);
    expect(toggleLocalPaid("abc", "B")?.paidBy).toEqual(["B"]);
    expect(readLocalSplit("abc")?.paidBy).toEqual(["B"]);
    expect(toggleLocalPaid("abc", "B")?.paidBy).toEqual([]);
  });

  it("removes a split", () => {
    saveLocalSplit(sample);
    removeLocalSplit("abc");
    expect(readLocalSplit("abc")).toBeNull();
  });
});
