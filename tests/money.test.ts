import { describe, it, expect } from "vitest";
import {
  parseAmountToOre,
  formatOre,
  splitOre,
  computeShares,
  computeRoomShares,
  sumItemsOre,
  estimateGroupSize,
  isFullyShared,
} from "../lib/money";
import type { Diner, LineItem } from "../lib/types";

describe("parseAmountToOre", () => {
  it("parses plain and decimal forms", () => {
    expect(parseAmountToOre("185")).toBe(18500);
    expect(parseAmountToOre("185,50")).toBe(18550);
    expect(parseAmountToOre("185.50")).toBe(18550);
    expect(parseAmountToOre("12kr")).toBe(1200);
    expect(parseAmountToOre("99:-")).toBe(9900);
  });
  it("handles grouping separators", () => {
    expect(parseAmountToOre("1 234,50")).toBe(123450);
    expect(parseAmountToOre("1.234,50")).toBe(123450);
    expect(parseAmountToOre("1,234.50")).toBe(123450);
  });
  it("rejects junk", () => {
    expect(parseAmountToOre("")).toBeNull();
    expect(parseAmountToOre("abc")).toBeNull();
  });
});

describe("formatOre", () => {
  it("formats kronor and öre", () => {
    expect(formatOre(18550)).toBe("185,50");
    expect(formatOre(0)).toBe("0,00");
    expect(formatOre(-500)).toBe("-5,00");
    expect(formatOre(5)).toBe("0,05");
  });
});

describe("splitOre", () => {
  it("distributes remainder so parts sum back to the total", () => {
    expect(splitOre(100, 3)).toEqual([34, 33, 33]);
    expect(splitOre(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(splitOre(10000, 7).reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it("returns empty for non-positive counts", () => {
    expect(splitOre(100, 0)).toEqual([]);
  });
});

const diners: Diner[] = [
  { id: "A", name: "Ada" },
  { id: "B", name: "Bo" },
];

describe("computeShares", () => {
  it("splits assigned items and leaves the rest unassigned", () => {
    const items: LineItem[] = [
      { id: "1", description: "shared dish", priceOre: 10000, sharers: ["A", "B"] },
      { id: "2", description: "solo", priceOre: 3000, sharers: ["A"] },
      { id: "3", description: "nobody", priceOre: 1500, sharers: [] },
    ];
    const { shares, unassignedOre } = computeShares(items, diners);
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(8000);
    expect(shares.find((s) => s.dinerId === "B")?.subtotalOre).toBe(5000);
    expect(unassignedOre).toBe(1500);
  });

  it("splits a shared item across the whole group, banking absent shares", () => {
    const items: LineItem[] = [{ id: "1", description: "bottle", priceOre: 10000, sharers: [], shared: true }];
    const { shares, unassignedOre } = computeShares(items, diners, 0, 4);
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(2500);
    expect(shares.find((s) => s.dinerId === "B")?.subtotalOre).toBe(2500);
    expect(unassignedOre).toBe(5000); // two of four group members aren't present
  });

  it("honours a per-item share count over the group size", () => {
    const items: LineItem[] = [{ id: "1", description: "bottle", priceOre: 12000, sharers: [], shared: true, shareCount: 4 }];
    const { shares, unassignedOre } = computeShares(items, diners); // 2 diners present
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(3000); // 12000 / 4
    expect(unassignedOre).toBe(6000); // two of the four shares aren't present
  });

  it("splits the tip equally on top", () => {
    const { shares } = computeShares([], diners, 6000);
    expect(shares.map((s) => s.tipOre)).toEqual([3000, 3000]);
    expect(shares.map((s) => s.totalOre)).toEqual([3000, 3000]);
  });
});

describe("computeRoomShares", () => {
  const people: Diner[] = [
    { id: "A", name: "Ada" },
    { id: "B", name: "Bo" },
    { id: "C", name: "Cy" },
  ];

  it("splits a fully-claimed shared item with nothing unassigned", () => {
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 9000, shared: true, claimedBy: ["A", "B", "C"] }],
      people,
    );
    expect(shares.map((s) => s.subtotalOre)).toEqual([3000, 3000, 3000]);
    expect(unassignedOre).toBe(0);
  });

  it("banks the share of someone who opts out of a shared item", () => {
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 9000, shared: true, claimedBy: ["A", "B"] }],
      people,
    );
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(3000);
    expect(shares.find((s) => s.dinerId === "C")?.subtotalOre).toBe(0);
    expect(unassignedOre).toBe(3000);
  });

  it("respects a per-item share count instead of the room size", () => {
    // shareCount 2 with the two who kept it claimed → fully covered, nothing banked
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 10000, shared: true, shareCount: 2, claimedBy: ["A", "B"] }],
      people,
    );
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(5000);
    expect(shares.find((s) => s.dinerId === "B")?.subtotalOre).toBe(5000);
    expect(unassignedOre).toBe(0);
  });

  it("splits a normal item among its claimers and the tip across everyone", () => {
    const { shares } = computeRoomShares([{ priceOre: 5000, claimedBy: ["A"] }], people, 3000);
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(5000);
    expect(shares.map((s) => s.tipOre)).toEqual([1000, 1000, 1000]);
  });

  it("uses the host's groupSize as the shared divisor before everyone joins", () => {
    // Host alone in a room that was created with groupSize=4. A shared bottle
    // shouldn't go 1-way and absorb the whole price — three of the four shares
    // are still owed by future joiners.
    const hostOnly: Diner[] = [{ id: "A", name: "Ada" }];
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 12000, shared: true, claimedBy: ["A"] }],
      hostOnly,
      0,
      4,
    );
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(3000);
    expect(unassignedOre).toBe(9000);
  });

  it("weights a diner's shared portion by the seats they're paying for", () => {
    // Ada pays for 2, Bo for 1. A shared bottle split 3 ways: Ada covers two of
    // the three portions, Bo one — fully covered, nothing banked.
    const seated: Diner[] = [
      { id: "A", name: "Ada", seats: 2 },
      { id: "B", name: "Bo", seats: 1 },
    ];
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 9000, shared: true, claimedBy: ["A", "B"] }],
      seated,
      0,
      3,
    );
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(6000);
    expect(shares.find((s) => s.dinerId === "B")?.subtotalOre).toBe(3000);
    expect(unassignedOre).toBe(0);
  });

  it("lets seats fully cover a shared item when not everyone uses the app", () => {
    // Table of 4, but only one guest joined — paying for all 4. With no host
    // groupSize the total seats (4) become the divisor and the item is covered.
    const solo: Diner[] = [{ id: "A", name: "Ada", seats: 4 }];
    const { shares, unassignedOre } = computeRoomShares(
      [{ priceOre: 12000, shared: true, claimedBy: ["A"] }],
      solo,
    );
    expect(shares.find((s) => s.dinerId === "A")?.subtotalOre).toBe(12000);
    expect(unassignedOre).toBe(0);
  });

  it("divides the tip across seats, not app users", () => {
    // Ada (2 seats) + Bo (1 seat): a 3000 tip splits 2000 / 1000 by head count.
    const seated: Diner[] = [
      { id: "A", name: "Ada", seats: 2 },
      { id: "B", name: "Bo", seats: 1 },
    ];
    const { shares } = computeRoomShares([], seated, 3000);
    expect(shares.find((s) => s.dinerId === "A")?.tipOre).toBe(2000);
    expect(shares.find((s) => s.dinerId === "B")?.tipOre).toBe(1000);
  });
});

describe("estimateGroupSize", () => {
  it("uses the number of mains when present, ignoring extra drinks", () => {
    // 4 mains, 6 drinks (some had two), 2 desserts → 4 people
    expect(estimateGroupSize({ food: 4, drink: 6, dessert: 2, total: 12 })).toBe(4);
    // a wine-heavy table shouldn't be over-counted by drinks
    expect(estimateGroupSize({ food: 4, drink: 12, dessert: 0, total: 16 })).toBe(4);
  });
  it("falls back to drinks (discounted) when there are no mains", () => {
    expect(estimateGroupSize({ food: 0, drink: 6, dessert: 0, total: 6 })).toBe(4);
  });
  it("keeps desserts as a floor", () => {
    expect(estimateGroupSize({ food: 3, drink: 0, dessert: 5, total: 8 })).toBe(5);
  });
  it("clamps to 2–12", () => {
    expect(estimateGroupSize({ food: 1, drink: 0, dessert: 0, total: 1 })).toBe(2);
    expect(estimateGroupSize({ food: 20, drink: 0, dessert: 0, total: 20 })).toBe(12);
  });
});

describe("isFullyShared", () => {
  it("treats no shareCount as fully shared (default = whole table)", () => {
    expect(isFullyShared({ shared: true }, 4)).toBe(true);
    expect(isFullyShared({ shared: true, shareCount: 0 }, 4)).toBe(true);
  });
  it("calls shareCount ≥ groupSize fully shared", () => {
    expect(isFullyShared({ shared: true, shareCount: 4 }, 4)).toBe(true);
    expect(isFullyShared({ shared: true, shareCount: 5 }, 4)).toBe(true);
  });
  it("calls shareCount < groupSize a partial share", () => {
    expect(isFullyShared({ shared: true, shareCount: 2 }, 4)).toBe(false);
    expect(isFullyShared({ shared: true, shareCount: 3 }, 4)).toBe(false);
  });
  it("ignores items that aren't shared at all", () => {
    expect(isFullyShared({ shared: false, shareCount: 2 }, 4)).toBe(false);
    expect(isFullyShared({}, 4)).toBe(false);
  });
});

describe("sumItemsOre", () => {
  it("sums priceOre", () => {
    expect(sumItemsOre([{ id: "1", description: "", priceOre: 100, sharers: [] }, { id: "2", description: "", priceOre: 250, sharers: [] }])).toBe(350);
  });
});
