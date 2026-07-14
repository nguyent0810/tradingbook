import { describe, expect, it } from "vitest";
import {
  computePortfolioGuardrails,
  DEFAULT_MAX_CONCURRENT_POSITIONS,
  PORTFOLIO_HEAT_ELEVATED_PCT_OF_EQUITY,
  PORTFOLIO_HEAT_UNKNOWN_MAJORITY_THRESHOLD,
  type PortfolioGuardrailTrade,
} from "./portfolio-guardrails";

function trade(overrides: Partial<PortfolioGuardrailTrade>): PortfolioGuardrailTrade {
  return {
    status: "OPEN",
    symbol: "AAA",
    entryPrice: 100,
    quantity: 1000,
    stopLoss: 95,
    ...overrides,
  };
}

describe("computePortfolioGuardrails — max concurrent positions", () => {
  it("flags atOrOverLimit when OPEN count crosses the default cap", () => {
    const trades = Array.from({ length: DEFAULT_MAX_CONCURRENT_POSITIONS }, (_, i) =>
      trade({ symbol: `S${i}`, status: "OPEN" })
    );
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.maxConcurrentPositions.count).toBe(DEFAULT_MAX_CONCURRENT_POSITIONS);
    expect(result.maxConcurrentPositions.limit).toBe(DEFAULT_MAX_CONCURRENT_POSITIONS);
    expect(result.maxConcurrentPositions.atOrOverLimit).toBe(true);
  });

  it("does not flag when under the cap and ignores PLANNED trades in the count", () => {
    const trades = [
      trade({ symbol: "A", status: "OPEN" }),
      trade({ symbol: "B", status: "OPEN" }),
      trade({ symbol: "C", status: "PLANNED" }),
      trade({ symbol: "D", status: "PLANNED" }),
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.maxConcurrentPositions.count).toBe(2);
    expect(result.maxConcurrentPositions.atOrOverLimit).toBe(false);
  });
});

describe("computePortfolioGuardrails — portfolio heat", () => {
  it("sums (entryPrice - stopLoss) * quantity across OPEN trades with a known valid stop", () => {
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }), // 5,000
      trade({ symbol: "B", entryPrice: 50, stopLoss: 48, quantity: 2000 }), // 4,000
      trade({ symbol: "C", status: "CLOSED", entryPrice: 100, stopLoss: 10, quantity: 100 }), // excluded (not OPEN)
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.portfolioHeat.portfolioHeatVnd).toBe(9000);
    expect(result.portfolioHeat.isPartial).toBe(false);
    expect(result.portfolioHeat.unknownStopRiskTradeCount).toBe(0);
    expect(result.portfolioHeat.invalidStopTradeCount).toBe(0);
  });

  it("excludes OPEN trades with unknown (null) stop loss and counts them, without treating them as zero risk", () => {
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }), // 5,000
      trade({ symbol: "B", entryPrice: 50, stopLoss: null, quantity: 2000 }),
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.portfolioHeat.portfolioHeatVnd).toBe(5000);
    expect(result.portfolioHeat.unknownStopRiskTradeCount).toBe(1);
    expect(result.portfolioHeat.unknownStopRiskSymbols).toEqual(["B"]);
    expect(result.portfolioHeat.isPartial).toBe(true);
    expect(result.portfolioHeat.statusCopy).toMatch(/no stop loss set/);
  });

  it("excludes OPEN trades with an invalid stop (>= entry) and counts them separately, without producing negative risk", () => {
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }), // 5,000
      trade({ symbol: "B", entryPrice: 50, stopLoss: 55, quantity: 2000 }), // stop above entry
      trade({ symbol: "C", entryPrice: 30, stopLoss: 30, quantity: 500 }), // stop == entry
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.portfolioHeat.portfolioHeatVnd).toBe(5000);
    expect(result.portfolioHeat.invalidStopTradeCount).toBe(2);
    expect(result.portfolioHeat.invalidStopSymbols).toEqual(["B", "C"]);
    expect(result.portfolioHeat.isPartial).toBe(true);
    expect(result.portfolioHeat.statusCopy).toMatch(/stop loss at or above entry/);
  });

  it("falls back gracefully when equity is not configured — pct-of-equity is null, not NaN, no crash", () => {
    const trades = [trade({ entryPrice: 100, stopLoss: 95, quantity: 1000 })];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.portfolioHeat.portfolioHeatPctOfEquity).toBeNull();
    expect(result.portfolioHeat.isElevated).toBe(false);
  });

  it("computes portfolioHeatPctOfEquity and flags isElevated at/above the threshold when equity is configured", () => {
    const equity = 100_000; // heat 9,000 / 100,000 = 9% >= 6% threshold
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }), // 5,000
      trade({ symbol: "B", entryPrice: 50, stopLoss: 48, quantity: 2000 }), // 4,000
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: equity });
    expect(result.portfolioHeat.portfolioHeatPctOfEquity).toBeCloseTo(0.09);
    expect(result.portfolioHeat.portfolioHeatPctOfEquity).toBeGreaterThanOrEqual(
      PORTFOLIO_HEAT_ELEVATED_PCT_OF_EQUITY
    );
    expect(result.portfolioHeat.isElevated).toBe(true);
    expect(result.portfolioHeat.dataQuality).toBe("reliable");
  });

  it("fail-closed: reports dataQuality 'mostly_unknown' when most OPEN trades have no stop, even though the tracked heat number itself is small and non-elevated", () => {
    // 5 open trades, 4 with no stop at all, 1 with a small known stop-risk.
    // portfolioHeatVnd correctly excludes the 4 unknowns (100,000 only) and, against
    // a realistic equity base, is nowhere near the elevated threshold — but 4/5
    // positions carry completely untracked risk, so the low number must not be
    // allowed to read as "portfolio heat is low".
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: null, quantity: 1000 }),
      trade({ symbol: "B", entryPrice: 100, stopLoss: null, quantity: 1000 }),
      trade({ symbol: "C", entryPrice: 100, stopLoss: null, quantity: 1000 }),
      trade({ symbol: "D", entryPrice: 100, stopLoss: null, quantity: 1000 }),
      trade({ symbol: "E", entryPrice: 1000, stopLoss: 900, quantity: 1000 }), // 100,000
    ];
    const equity = 500_000_000; // heat 100,000 / 500,000,000 = 0.02% — nowhere near elevated
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: equity });

    expect(result.portfolioHeat.portfolioHeatVnd).toBe(100_000);
    expect(result.portfolioHeat.isElevated).toBe(false);
    expect(result.portfolioHeat.unknownStopRiskTradeCount).toBe(4);
    expect(result.portfolioHeat.dataQuality).toBe("mostly_unknown");
  });

  it("does not flag dataQuality as mostly_unknown when unknown/invalid trades are a minority", () => {
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }),
      trade({ symbol: "B", entryPrice: 100, stopLoss: 95, quantity: 1000 }),
      trade({ symbol: "C", entryPrice: 100, stopLoss: 95, quantity: 1000 }),
      trade({ symbol: "D", entryPrice: 100, stopLoss: null, quantity: 1000 }), // 1 of 4 = 25%
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.portfolioHeat.unknownStopRiskTradeCount).toBe(1);
    expect(result.portfolioHeat.dataQuality).toBe("reliable");
  });

  it("treats exactly the threshold fraction as mostly_unknown (>= not >)", () => {
    const trades = [
      trade({ symbol: "A", entryPrice: 100, stopLoss: 95, quantity: 1000 }),
      trade({ symbol: "B", entryPrice: 100, stopLoss: null, quantity: 1000 }), // 1 of 2 = 50%
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(1 / 2).toBeGreaterThanOrEqual(PORTFOLIO_HEAT_UNKNOWN_MAJORITY_THRESHOLD);
    expect(result.portfolioHeat.dataQuality).toBe("mostly_unknown");
  });
});

describe("computePortfolioGuardrails — duplicate symbol exposure", () => {
  it("detects a symbol with both a PLANNED and an OPEN row and sums combined notional", () => {
    const trades = [
      trade({ symbol: "HPG", status: "PLANNED", entryPrice: 20, quantity: 1000 }), // 20,000
      trade({ symbol: "HPG", status: "OPEN", entryPrice: 21, quantity: 500 }), // 10,500
      trade({ symbol: "VNM", status: "OPEN", entryPrice: 80, quantity: 100 }),
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.duplicateSymbolExposure).toHaveLength(1);
    expect(result.duplicateSymbolExposure[0]).toEqual({
      symbol: "HPG",
      plannedCount: 1,
      openCount: 1,
      combinedNotionalVnd: 30_500,
    });
  });

  it("does not flag a symbol with only a single non-terminal row, and ignores CLOSED/CANCELLED duplicates", () => {
    const trades = [
      trade({ symbol: "A", status: "OPEN" }),
      trade({ symbol: "A", status: "CLOSED" }),
      trade({ symbol: "A", status: "CANCELLED" }),
      trade({ symbol: "B", status: "PLANNED" }),
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.duplicateSymbolExposure).toEqual([]);
  });

  it("does not silently merge/dedupe — multiple PLANNED rows for the same symbol are still flagged", () => {
    const trades = [
      trade({ symbol: "A", status: "PLANNED", entryPrice: 10, quantity: 100 }),
      trade({ symbol: "A", status: "PLANNED", entryPrice: 11, quantity: 100 }),
    ];
    const result = computePortfolioGuardrails({ trades, accountEquityVnd: null });
    expect(result.duplicateSymbolExposure).toEqual([
      { symbol: "A", plannedCount: 2, openCount: 0, combinedNotionalVnd: 2100 },
    ]);
  });
});
