import { describe, it, expect } from "vitest";
import { emojiFor } from "../lib/categories";

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

  it("prefers a brand-aware model emoji over the category fallback", () => {
    // A wine brand the keyword rules don't know — the model's 🍷 should win
    // over the generic drink mug.
    expect(emojiFor("O'scuru", undefined, "🍷")).toBe("🍷");
  });
});
