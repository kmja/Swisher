import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { formatReceiptDate } from "../lib/date";

const FAKE_NOW = new Date("2026-05-30T12:00:00Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("formatReceiptDate", () => {
  it("formats a current-year date in Swedish as 'weekday den N:e/a month'", () => {
    // 2026-03-06 is a Friday.
    expect(formatReceiptDate("2026-03-06", "sv")).toBe("fredag den 6:e mars");
  });

  it("formats a current-year date in English as 'Weekday, Month Nth'", () => {
    expect(formatReceiptDate("2026-03-06", "en")).toBe("Friday, March 6th");
  });

  it("uses :a for 1 and 2, :e otherwise — Swedish", () => {
    expect(formatReceiptDate("2026-06-01", "sv")).toContain("1:a");
    expect(formatReceiptDate("2026-06-02", "sv")).toContain("2:a");
    expect(formatReceiptDate("2026-06-03", "sv")).toContain("3:e");
    expect(formatReceiptDate("2026-06-21", "sv")).toContain("21:a");
    expect(formatReceiptDate("2026-06-22", "sv")).toContain("22:a");
    // 11/12 take the :e teens exception.
    expect(formatReceiptDate("2026-06-11", "sv")).toContain("11:e");
    expect(formatReceiptDate("2026-06-12", "sv")).toContain("12:e");
  });

  it("picks the right English ordinal suffix", () => {
    expect(formatReceiptDate("2026-06-01", "en")).toContain("1st");
    expect(formatReceiptDate("2026-06-02", "en")).toContain("2nd");
    expect(formatReceiptDate("2026-06-03", "en")).toContain("3rd");
    expect(formatReceiptDate("2026-06-04", "en")).toContain("4th");
    expect(formatReceiptDate("2026-06-11", "en")).toContain("11th");
    expect(formatReceiptDate("2026-06-21", "en")).toContain("21st");
    expect(formatReceiptDate("2026-06-22", "en")).toContain("22nd");
    expect(formatReceiptDate("2026-06-23", "en")).toContain("23rd");
  });

  it("falls back to ISO for any earlier year", () => {
    expect(formatReceiptDate("2025-12-31", "sv")).toBe("2025-12-31");
    expect(formatReceiptDate("2025-12-31", "en")).toBe("2025-12-31");
    expect(formatReceiptDate("2024-01-15", "sv")).toBe("2024-01-15");
  });

  it("passes empty / garbage strings through untouched", () => {
    expect(formatReceiptDate("", "sv")).toBe("");
    expect(formatReceiptDate("not-a-date", "en")).toBe("not-a-date");
  });
});
