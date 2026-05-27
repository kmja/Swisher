import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchRateToSek } from "../lib/fx";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/** Install a fetch stub; returns the list of URLs requested. */
function mockFetch(handler: (url: string) => { ok: boolean; body?: unknown }) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const { ok, body } = handler(String(url));
    return { ok, json: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

describe("fetchRateToSek", () => {
  it("short-circuits SEK without any network call", async () => {
    const calls = mockFetch(() => ({ ok: false }));
    expect(await fetchRateToSek("SEK")).toEqual({ rate: 1, approx: false });
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed currency codes", async () => {
    mockFetch(() => ({ ok: false }));
    expect(await fetchRateToSek("EU")).toBeNull();
    expect(await fetchRateToSek("eur1")).toBeNull();
  });

  it("uses the historical rate for the receipt date", async () => {
    const calls = mockFetch((url) =>
      url.includes("frankfurter") ? { ok: true, body: { date: "2017-01-16", rates: { SEK: 9.52 } } } : { ok: false },
    );
    const fx = await fetchRateToSek("EUR", "2017-01-16");
    expect(fx).toEqual({ rate: 9.52, approx: false, date: "2017-01-16" });
    expect(calls[0]).toContain("/2017-01-16?from=EUR&to=SEK");
  });

  it("falls back to the latest rate when no date is given", async () => {
    const calls = mockFetch(() => ({ ok: true, body: { date: "2026-05-26", rates: { SEK: 11.4 } } }));
    const fx = await fetchRateToSek("EUR");
    expect(fx?.rate).toBe(11.4);
    expect(fx?.approx).toBe(false);
    expect(calls[0]).toContain("/latest?from=EUR&to=SEK");
  });

  it("ignores a future receipt date and uses latest", async () => {
    const calls = mockFetch(() => ({ ok: true, body: { date: "2026-05-26", rates: { SEK: 11.4 } } }));
    await fetchRateToSek("EUR", "2099-01-01");
    expect(calls[0]).toContain("/latest");
  });

  it("marks the rate approximate when historical lookup misses and latest is used", async () => {
    mockFetch((url) =>
      url.includes("/latest") ? { ok: true, body: { date: "2026-05-26", rates: { SEK: 11.4 } } } : { ok: false },
    );
    const fx = await fetchRateToSek("EUR", "2017-01-16");
    expect(fx).toEqual({ rate: 11.4, approx: true, date: "2026-05-26" });
  });

  it("falls back to open.er-api, flagged approximate", async () => {
    mockFetch((url) =>
      url.includes("open.er-api") ? { ok: true, body: { result: "success", rates: { SEK: 0.3 } } } : { ok: false },
    );
    const fx = await fetchRateToSek("THB");
    expect(fx).toEqual({ rate: 0.3, approx: true });
  });

  it("uses the static table only when every provider fails", async () => {
    mockFetch(() => ({ ok: false }));
    const eur = await fetchRateToSek("EUR");
    expect(eur?.approx).toBe(true);
    expect(eur?.rate).toBeGreaterThan(0);
    expect(await fetchRateToSek("ZZZ")).toBeNull(); // unknown + no live rate
  });
});
