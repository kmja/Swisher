import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone, sanitizeMessage, buildSwishUri } from "../lib/swish";

describe("normalizePhone", () => {
  it("normalises Swedish mobile formats to 0XXXXXXXXX", () => {
    expect(normalizePhone("+46 70 123 45 67")).toBe("0701234567");
    expect(normalizePhone("0046701234567")).toBe("0701234567");
    expect(normalizePhone("070-123 45 67")).toBe("0701234567");
    expect(normalizePhone("0701234567")).toBe("0701234567");
  });
  it("rejects non-mobile / malformed numbers", () => {
    expect(normalizePhone("08-123456")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(isValidPhone("not a number")).toBe(false);
    expect(isValidPhone("0701234567")).toBe(true);
  });
});

describe("sanitizeMessage", () => {
  it("normalises dashes, drops unsafe chars and caps length", () => {
    expect(sanitizeMessage("Middag—2026")).toBe("Middag-2026");
    expect(sanitizeMessage("a".repeat(80)).length).toBe(50);
  });
});

describe("buildSwishUri", () => {
  it("builds a locked, non-editable swish:// deep link", () => {
    const uri = buildSwishUri({ payee: "0701234567", amountOre: 12550, message: "Middag" });
    expect(uri.startsWith("swish://payment?data=")).toBe(true);
    const data = JSON.parse(decodeURIComponent(uri.split("data=")[1]));
    expect(data.payee).toEqual({ value: "0701234567", editable: false });
    expect(data.amount).toEqual({ value: 125.5, editable: false });
    expect(data.message.editable).toBe(false);
  });
});
