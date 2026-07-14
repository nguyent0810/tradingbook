import { describe, expect, it } from "vitest";
import {
  buildMarkToMarketExposure,
  buildRiskToStopBreakdown,
  type DecisionCockpitOpenTradeSnapshot,
} from "./risk-exposure-breakdown";

function openTrade(
  overrides: Partial<DecisionCockpitOpenTradeSnapshot> = {}
): DecisionCockpitOpenTradeSnapshot {
  return {
    symbol: "HPG",
    entryPrice: 100,
    quantity: 1000,
    stopLoss: 97,
    ...overrides,
  };
}

describe("buildRiskToStopBreakdown", () => {
  it("sums known per-share risk × quantity for trades with a set stop", () => {
    const r = buildRiskToStopBreakdown([
      openTrade({ entryPrice: 100, stopLoss: 97, quantity: 1000 }),
      openTrade({ symbol: "VNM", entryPrice: 80, stopLoss: 76, quantity: 500 }),
    ]);
    expect(r.knownRiskVnd).toBe(3 * 1000 + 4 * 500);
    expect(r.knownStopCount).toBe(2);
    expect(r.unknownStopCount).toBe(0);
  });

  it("excludes a trade with stopLoss: null from the sum and counts it separately (not zero)", () => {
    const r = buildRiskToStopBreakdown([
      openTrade({ entryPrice: 100, stopLoss: 97, quantity: 1000 }),
      openTrade({ symbol: "SSI", entryPrice: 50, stopLoss: null, quantity: 2000 }),
    ]);
    expect(r.knownRiskVnd).toBe(3000);
    expect(r.knownStopCount).toBe(1);
    expect(r.unknownStopCount).toBe(1);
  });

  it("returns zeroes for an empty book", () => {
    const r = buildRiskToStopBreakdown([]);
    expect(r).toEqual({ knownRiskVnd: 0, knownStopCount: 0, unknownStopCount: 0 });
  });

  it("never lets a negative (entry below stop) reduce total risk", () => {
    const r = buildRiskToStopBreakdown([
      openTrade({ entryPrice: 100, stopLoss: 105, quantity: 1000 }), // inverted, shouldn't happen but must not go negative
    ]);
    expect(r.knownRiskVnd).toBe(0);
  });
});

describe("buildMarkToMarketExposure", () => {
  it("sums latestClose × quantity when all symbols resolve", () => {
    const closes = new Map([
      ["HPG", 105],
      ["VNM", 82],
    ]);
    const r = buildMarkToMarketExposure(
      [
        { symbol: "HPG", quantity: 1000 },
        { symbol: "VNM", quantity: 500 },
      ],
      closes
    );
    expect(r.available).toBe(true);
    expect(r.exposureVnd).toBe(105 * 1000 + 82 * 500);
    expect(r.missingCloseCount).toBe(0);
    expect(r.unavailableReason).toBeNull();
  });

  it("is partial (not unavailable) when only some symbols are missing a close", () => {
    const closes = new Map([["HPG", 105]]);
    const r = buildMarkToMarketExposure(
      [
        { symbol: "HPG", quantity: 1000 },
        { symbol: "SSI", quantity: 500 },
      ],
      closes
    );
    expect(r.available).toBe(true);
    expect(r.exposureVnd).toBe(105 * 1000);
    expect(r.missingCloseCount).toBe(1);
    expect(r.unavailableReason).toMatch(/1 of 2/);
  });

  it("is unavailable when no open symbol has a resolvable close", () => {
    const r = buildMarkToMarketExposure([{ symbol: "HPG", quantity: 1000 }], new Map());
    expect(r.available).toBe(false);
    expect(r.exposureVnd).toBeNull();
    expect(r.missingCloseCount).toBe(1);
    expect(r.unavailableReason).not.toBeNull();
  });

  it("is trivially available for an empty open book", () => {
    const r = buildMarkToMarketExposure([], new Map());
    expect(r).toEqual({
      available: true,
      exposureVnd: 0,
      missingCloseCount: 0,
      unavailableReason: null,
    });
  });

  it("matches symbols case-insensitively", () => {
    const closes = new Map([["HPG", 105]]);
    const r = buildMarkToMarketExposure([{ symbol: "hpg", quantity: 1000 }], closes);
    expect(r.exposureVnd).toBe(105_000);
  });
});
