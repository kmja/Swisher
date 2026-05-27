import { describe, it, expect } from "vitest";
import { emojiFor, sharedSuggestion } from "../lib/categories";

describe("sharedSuggestion", () => {
  it("auto-marks near-certain shared lines", () => {
    expect(sharedSuggestion("Flaska Rioja 75cl")).toBe("auto");
    expect(sharedSuggestion("Plankstek för 2")).toBe("auto");
    expect(sharedSuggestion("Antipasti")).toBe("auto");
    expect(sharedSuggestion("Skaldjursplateau att dela")).toBe("auto");
  });
  it("only suggests for often-but-not-always shared items", () => {
    expect(sharedSuggestion("Vitlöksbröd")).toBe("suggest");
    expect(sharedSuggestion("Nachos")).toBe("suggest");
    expect(sharedSuggestion("Flaska vatten")).toBe("suggest"); // a bottle, but maybe individual water
  });
  it("stays out of the way for individual servings", () => {
    expect(sharedSuggestion("Stor stark")).toBeNull();
    expect(sharedSuggestion("Glas rödvin")).toBeNull();
    expect(sharedSuggestion("Cappuccino")).toBeNull();
  });
});

describe("emojiFor", () => {
  it("maps common items to emoji", () => {
    expect(emojiFor("öl")).toBe("🍺");
    expect(emojiFor("kaffe")).toBe("☕");
    expect(emojiFor("ostron")).toBe("🦪");
    expect(emojiFor("ris")).toBe("🍜");
  });

  it("resolves custom hand-drawn icons to ci: sentinels", () => {
    expect(emojiFor("kanelbulle")).toBe("ci:bun");
    expect(emojiFor("risotto")).toBe("ci:risotto");
    expect(emojiFor("bao bun")).toBe("ci:bao");
  });

  it("does not let the soda rule swallow fläsk (suffix-match regression)", () => {
    expect(emojiFor("fläskkarré")).toBe("🥩");
  });

  it("doesn't let a short keyword prefix-match a brand (Bonaqua ≠ broccoli)", () => {
    expect(emojiFor("Bonaqua")).not.toBe("🥦");
    expect(emojiFor("S Softdrink nr 2 Bonaqua Glassf")).toBe("🥤");
    expect(emojiFor("broccoli")).toBe("🥦");
  });

  it("prefers a brand-aware model emoji over the category fallback", () => {
    // A wine brand the keyword rules don't know — the model's 🍷 should win
    // over the generic drink mug.
    expect(emojiFor("O'scuru", undefined, "🍷")).toBe("🍷");
  });
});
