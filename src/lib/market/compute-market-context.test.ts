import { describe, expect, it } from "vitest";
import {
  computeMarketForeignRollup,
  computeSymbolForeignRollup,
  computeSymbolVolumeContext,
  type DailyBarPoint,
  type ForeignDailyPoint,
} from "@/lib/market/compute-market-context";
import { parseSessionDateUtc } from "@/lib/market/session-date";

function day(n: number): Date {
  return parseSessionDateUtc(`2026-01-${String(n).padStart(2, "0")}`);
}

function barsForDays(count: number, volume = 100_000): DailyBarPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: day(i + 1),
    open: 10,
    high: 11,
    low: 9,
    close: 10,
    volume,
  }));
}

function foreignPoint(n: number, net: number): ForeignDailyPoint {
  return {
    sessionDate: day(n),
    netValueVnd: net,
    dataQuality: "OK",
  };
}

describe("computeSymbolVolumeContext", () => {
  it("computes vol MA20 excluding eval bar", () => {
    const bars = barsForDays(25, 100_000);
    bars[24] = { ...bars[24]!, volume: 200_000 };
    const ctx = computeSymbolVolumeContext(bars, day(25));
    expect(ctx?.volMa20).toBe(100_000);
    expect(ctx?.volRatioMa20).toBe(2);
  });
});

describe("computeSymbolForeignRollup", () => {
  it("sets 1d from OK row and null 5d/10d with insufficient history", () => {
    const rollup = computeSymbolForeignRollup([foreignPoint(1, 100)], day(1));
    expect(rollup.foreignNetValue1d).toBe(100);
    expect(rollup.foreignNetValue5d).toBeNull();
    expect(rollup.foreignNetValue10d).toBeNull();
  });

  it("computes 5d when five OK sessions exist", () => {
    const history = [1, 2, 3, 4, 5].map((n) => foreignPoint(n, n * 10));
    const rollup = computeSymbolForeignRollup(history, day(5));
    expect(rollup.foreignNetValue5d).toBe(10 + 20 + 30 + 40 + 50);
    expect(rollup.foreignNetValue10d).toBeNull();
  });

  it("excludes ALL_ZERO rows from rolling sums", () => {
    const history: ForeignDailyPoint[] = [
      { sessionDate: day(1), netValueVnd: 0, dataQuality: "ALL_ZERO" },
      ...([2, 3, 4, 5, 6] as const).map((n) => foreignPoint(n, 100)),
    ];
    const rollup = computeSymbolForeignRollup(history, day(6));
    expect(rollup.foreignNetValue1d).toBe(100);
    expect(rollup.foreignNetValue5d).toBe(500);
  });
});

describe("computeMarketForeignRollup", () => {
  it("sums OK-only symbol 1d values", () => {
    const market = computeMarketForeignRollup({
      symbolRollups: [
        { foreignNetValue1d: 100, foreignNetValue5d: null, foreignNetValue10d: null, foreignDataQuality: "OK" },
        { foreignNetValue1d: null, foreignNetValue5d: null, foreignNetValue10d: null, foreignDataQuality: "ALL_ZERO" },
        { foreignNetValue1d: 50, foreignNetValue5d: null, foreignNetValue10d: null, foreignDataQuality: "OK" },
      ],
      marketHistory1d: [],
      sessionDate: day(1),
    });
    expect(market.foreignNetValue1d).toBe(150);
    expect(market.foreignSymbolsOk).toBe(2);
    expect(market.foreignSymbolsTotal).toBe(3);
    expect(market.foreignNetValue5d).toBeNull();
  });

  it("computes market 5d from prior market 1d history", () => {
    const market = computeMarketForeignRollup({
      symbolRollups: [
        { foreignNetValue1d: 10, foreignNetValue5d: null, foreignNetValue10d: null, foreignDataQuality: "OK" },
      ],
      marketHistory1d: [
        { sessionDate: day(1), foreignNetValue1d: 1 },
        { sessionDate: day(2), foreignNetValue1d: 2 },
        { sessionDate: day(3), foreignNetValue1d: 3 },
        { sessionDate: day(4), foreignNetValue1d: 4 },
      ],
      sessionDate: day(5),
    });
    expect(market.foreignNetValue1d).toBe(10);
    expect(market.foreignNetValue5d).toBe(1 + 2 + 3 + 4 + 10);
  });
});
