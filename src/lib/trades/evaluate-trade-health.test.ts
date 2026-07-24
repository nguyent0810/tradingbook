import { describe, expect, it } from "vitest";
import { evaluateTradeHealth, type TradeHealthEvalInput } from "./evaluate-trade-health";

const EVAL_DATE = new Date("2026-07-24T00:00:00.000Z");

function baseInput(overrides: Partial<TradeHealthEvalInput> = {}): TradeHealthEvalInput {
  return {
    direction: "LONG",
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 115,
    latestClose: 102,
    latestBarDate: EVAL_DATE,
    evalBarDate: EVAL_DATE,
    setupLevels: { breakoutLevel: 100, pullbackZoneLow: 95, pullbackZoneHigh: 100 },
    latestHealthLog: null,
    ...overrides,
  };
}

describe("evaluateTradeHealth", () => {
  it("marks a trade DEAD when the daily close breaches the stop", () => {
    const result = evaluateTradeHealth(baseInput({ latestClose: 94 }));
    expect(result.surface).toBe("stop_violated");
    expect(result.healthLevel).toBe("DEAD");
    expect(result.recommendedAction).toMatch(/cắt lỗ/);
  });

  it("marks a trade AT_RISK when structure weakens (close back under breakout anchor)", () => {
    const result = evaluateTradeHealth(
      baseInput({ latestClose: 99.5, stopLoss: 90 }) // below breakoutLevel*0.998=99.8, stop still clear
    );
    expect(result.surface).toBe("structure_weakening");
    expect(result.healthLevel).toBe("AT_RISK");
  });

  it("marks a trade WARNING when close is clear of stop but within the tight cushion band", () => {
    // entry 100, stop 98 -> distanceToStop small relative to entry when close is just above stop
    const result = evaluateTradeHealth(
      baseInput({
        entryPrice: 100,
        stopLoss: 98,
        latestClose: 99, // distanceToStop = 1, cushionPct = 1% < NEAR_STOP_CUSHION_PCT (2%)
        setupLevels: { breakoutLevel: 90, pullbackZoneLow: 85, pullbackZoneHigh: 99.5 }, // avoid structure hints
      })
    );
    expect(result.surface).toBe("under_pressure");
    expect(result.healthLevel).toBe("WARNING");
  });

  it("marks a trade WARNING when the latest bar is stale vs the eval session", () => {
    const staleDate = new Date("2026-07-22T00:00:00.000Z");
    const result = evaluateTradeHealth(
      baseInput({
        latestClose: 105,
        latestBarDate: staleDate,
        evalBarDate: EVAL_DATE,
        stopLoss: 90,
        setupLevels: { breakoutLevel: 90, pullbackZoneLow: 85, pullbackZoneHigh: 106 },
      })
    );
    expect(result.surface).toBe("stale_bar_review");
    expect(result.healthLevel).toBe("WARNING");
  });

  it("marks a trade HEALTHY when nothing is wrong (pending routine review)", () => {
    const result = evaluateTradeHealth(
      baseInput({
        entryPrice: 100,
        stopLoss: 90,
        latestClose: 103,
        setupLevels: { breakoutLevel: 90, pullbackZoneLow: 85, pullbackZoneHigh: 104 },
      })
    );
    expect(result.surface).toBe("review_needed");
    expect(result.healthLevel).toBe("HEALTHY");
    expect(result.recommendedAction).toBeNull();
  });

  it("returns null priceVsZone/structureStatus when there's no latest close or setup snapshot", () => {
    const result = evaluateTradeHealth(baseInput({ latestClose: null, latestBarDate: null, setupLevels: null }));
    expect(result.priceVsZone).toBeNull();
    expect(result.structureStatus).toBeNull();
  });
});
