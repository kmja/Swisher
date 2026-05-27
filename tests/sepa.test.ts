import { describe, it, expect } from "vitest";
import { isValidIban, normalizeIban, formatIban, buildEpcPayload } from "../lib/sepa";

describe("isValidIban", () => {
  it("accepts valid IBANs (any spacing/case)", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("NL91ABNA0417164300")).toBe(true);
    expect(isValidIban("FI2112345600000785")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
  });
  it("rejects bad checksums and junk", () => {
    expect(isValidIban("DE88 3704 0044 0532 0130 00")).toBe(false);
    expect(isValidIban("not an iban")).toBe(false);
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("DE")).toBe(false);
  });
});

describe("normalizeIban / formatIban", () => {
  it("strips whitespace and uppercases", () => {
    expect(normalizeIban(" nl91 abna 0417164300 ")).toBe("NL91ABNA0417164300");
  });
  it("groups into blocks of four", () => {
    expect(formatIban("NL91ABNA0417164300")).toBe("NL91 ABNA 0417 1643 00");
  });
});

describe("buildEpcPayload", () => {
  it("produces a valid 11-line EPC069-12 SCT payload", () => {
    const payload = buildEpcPayload({
      name: "Café Müller AB",
      iban: "de89 3704 0044 0532 0130 00",
      eurCents: 1250,
      message: "Middag 2026-05-20",
    });
    const lines = payload.split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe("BCD");
    expect(lines[1]).toBe("002");
    expect(lines[2]).toBe("1");
    expect(lines[3]).toBe("SCT");
    expect(lines[4]).toBe(""); // BIC omitted
    expect(lines[5]).toBe("Café Müller AB");
    expect(lines[6]).toBe("DE89370400440532013000");
    expect(lines[7]).toBe("EUR12.50");
    expect(lines[10]).toBe("Middag 2026-05-20");
  });
  it("formats the amount with two decimals", () => {
    expect(buildEpcPayload({ name: "X", iban: "FI2112345600000785", eurCents: 5, message: "" }).split("\n")[7]).toBe("EUR0.05");
    expect(buildEpcPayload({ name: "X", iban: "FI2112345600000785", eurCents: 100000, message: "" }).split("\n")[7]).toBe("EUR1000.00");
  });
});
