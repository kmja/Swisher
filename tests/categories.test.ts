import { describe, it, expect } from "vitest";
import { categoryFor, emojiFor, sharedSuggestion } from "../lib/categories";

describe("categoryFor — starter vs main", () => {
  it("classifies obvious starters", () => {
    expect(categoryFor("Förrätt")).toBe("starter");
    expect(categoryFor("Antipasti misto")).toBe("starter");
    expect(categoryFor("Tapas")).toBe("starter");
    expect(categoryFor("Bruschetta al pomodoro")).toBe("starter");
    expect(categoryFor("Carpaccio")).toBe("starter");
    expect(categoryFor("Toast Skagen")).toBe("starter");
    expect(categoryFor("Charkbricka")).toBe("starter");
  });
  it("keeps mains as food", () => {
    expect(categoryFor("Entrecôte 250g")).toBe("food");
    expect(categoryFor("Räkpasta")).toBe("food");
    expect(categoryFor("Vegetarisk lasagne")).toBe("food");
    expect(categoryFor("Varmrätt")).toBe("food");
  });
  it("respects the model's explicit category", () => {
    expect(categoryFor("Soppa", "starter")).toBe("starter");
    expect(categoryFor("Soppa", "food")).toBe("food");
  });
});

describe("sharedSuggestion", () => {
  it("auto-marks near-certain shared lines", () => {
    expect(sharedSuggestion("Flaska Rioja 75cl")).toBe("auto");
    expect(sharedSuggestion("Antipasti")).toBe("auto");
    expect(sharedSuggestion("Skaldjursplateau att dela")).toBe("auto");
  });
  it("leaves individual mains alone (plankstek is not shared)", () => {
    expect(sharedSuggestion("Plankstek")).toBeNull();
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
    // Lasagne has its own hand-drawn icon, not the generic 🍝 spaghetti.
    expect(emojiFor("Vegetarisk lasagne")).toBe("ci:lasagne");
    expect(emojiFor("Lasagna bolognese")).toBe("ci:lasagne");
  });

  it("does not let the soda rule swallow fläsk (suffix-match regression)", () => {
    // Pork now uses the pig emoji; the soda rule must still not steal it.
    expect(emojiFor("fläskkarré")).toBe("🐖");
  });

  it("maps meats to animal-specific emojis", () => {
    expect(emojiFor("lammracks")).toBe("🐑");
    expect(emojiFor("lammkotlett")).toBe("🐑");
    expect(emojiFor("entrecôte")).toBe("🐄");
    expect(emojiFor("ankbröst")).toBe("🦆");
    expect(emojiFor("kalkonfilé")).toBe("🦃");
    expect(emojiFor("kycklingfilé")).toBe("🐔");
    // Generic fallback still kicks in for unspecified meat words.
    expect(emojiFor("plankstek")).toBe("🥩");
  });

  it("doesn't let a short keyword prefix-match a brand (Bonaqua ≠ broccoli)", () => {
    expect(emojiFor("Bonaqua")).not.toBe("🥦");
    expect(emojiFor("S Softdrink nr 2 Bonaqua Glassf")).toBe("🥤");
    expect(emojiFor("broccoli")).toBe("🥦");
  });

  it("doesn't treat 'flaska' (bottle) as fläsk (pork)", () => {
    // Diacritic-stripped "fläsk" looks like the prefix of "flaska" — guard
    // against that collision so wines stay wines.
    expect(emojiFor("Flaska Barolo 75cl")).toBe("🍷");
    expect(emojiFor("Flaska vatten")).toBe("💧");
    // The compound forms still resolve to pork.
    expect(emojiFor("fläskfilé")).toBe("🐖");
    expect(emojiFor("fläskkarré")).toBe("🐖");
  });

  it("prefers a brand-aware model emoji over the category fallback", () => {
    // A wine brand the keyword rules don't know — the model's 🍷 should win
    // over the generic drink mug.
    expect(emojiFor("O'scuru", undefined, "🍷")).toBe("🍷");
  });
});
