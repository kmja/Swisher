import { describe, it, expect } from "vitest";
import { formatNative, formatEur, flagEmoji, regionName } from "../lib/currency";

// Intl emits non-breaking spaces (U+00A0 / U+202F); normalise for comparison.
const norm = (s: string | null) => (s == null ? s : s.replace(/\s/g, " "));

describe("formatNative", () => {
  it("reconstructs the original currency from SEK öre", () => {
    // €12.50 at 9.52 SEK/EUR -> 11900 öre
    expect(norm(formatNative(11900, { currency: "EUR", rate: 9.52 }))).toBe("12,50 €");
  });
  it("renders zero-decimal currencies without cents", () => {
    // 105 SEK at 0.067 SEK/JPY -> ~1567 yen
    expect(norm(formatNative(10500, { currency: "JPY", rate: 0.067 }))).toBe("1 567 ¥");
  });
  it("returns null for SEK or when there's no foreign context", () => {
    expect(formatNative(10000, { currency: "SEK", rate: 1 })).toBeNull();
    expect(formatNative(10000, null)).toBeNull();
    expect(formatNative(10000, { currency: "EUR", rate: 0 })).toBeNull();
  });
});

describe("formatEur", () => {
  it("formats euro cents", () => {
    expect(norm(formatEur(1250))).toBe("12,50 €");
    expect(norm(formatEur(5))).toBe("0,05 €");
  });
});

describe("flagEmoji / regionName", () => {
  it("maps alpha-2 codes to flags", () => {
    expect(flagEmoji("IT")).toBe("🇮🇹");
    expect(flagEmoji("se")).toBe("🇸🇪");
    expect(flagEmoji("bad")).toBe("");
  });
  it("localises country names", () => {
    expect(regionName("IT", "en")).toBe("Italy");
    expect(regionName("IT", "sv")).toBe("Italien");
  });
});
