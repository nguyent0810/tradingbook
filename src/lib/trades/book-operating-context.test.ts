import { describe, expect, it } from "vitest";
import {
  computePlannedRiskConcentration,
  countOperatingPostures,
  deriveBookOperatingContext,
} from "./book-operating-context";

describe("computePlannedRiskConcentration", () => {
  it("computes top shares", () => {
    const c = computePlannedRiskConcentration([
      { symbol: "AAA", plannedCapitalAtRisk: 60 },
      { symbol: "BBB", plannedCapitalAtRisk: 30 },
      { symbol: "CCC", plannedCapitalAtRisk: 10 },
    ]);
    expect(c.top1Share).toBeCloseTo(0.6, 5);
    expect(c.top2Share).toBeCloseTo(0.9, 5);
    expect(c.top1Symbol).toBe("AAA");
    expect(c.top2Symbol).toBe("BBB");
  });

  it("returns nulls when insufficient data", () => {
    const c = computePlannedRiskConcentration([
      { symbol: "AAA", plannedCapitalAtRisk: 100 },
    ]);
    expect(c.top2Share).toBeNull();
  });
});

describe("deriveBookOperatingContext", () => {
  const base = {
    activeOpenCount: 4,
    postureCounts: {
      stable: 2,
      cautious: 1,
      defensive: 1,
      high_attention: 0,
    },
    urgentQueueCount: 0,
    highAttentionQueueCount: 0,
    routinePendingQueueCount: 1,
    staleMarketOpenCount: 0,
    stopViolationsCount: 0,
    pendingCheckpointCount: 1,
    partialRiskFigures: false,
    concentration: {
      countWithRisk: 0,
      top1Share: null,
      top2Share: null,
      top1Symbol: null,
      top2Symbol: null,
      sumAtRisk: null,
    },
  };

  it("flags stable majority", () => {
    const ctx = deriveBookOperatingContext({
      ...base,
      activeOpenCount: 5,
      postureCounts: {
        stable: 4,
        cautious: 1,
        defensive: 0,
        high_attention: 0,
      },
      pendingCheckpointCount: 0,
    });
    expect(ctx.headline).toBe("Stable operating posture");
  });

  it("flags elevated pressure when urgent queue", () => {
    const ctx = deriveBookOperatingContext({
      ...base,
      urgentQueueCount: 2,
      postureCounts: {
        stable: 0,
        cautious: 2,
        defensive: 1,
        high_attention: 1,
      },
    });
    expect(ctx.headline).toBe("Elevated review pressure");
  });

  it("handles empty book", () => {
    const ctx = deriveBookOperatingContext({
      ...base,
      activeOpenCount: 0,
      postureCounts: {
        stable: 0,
        cautious: 0,
        defensive: 0,
        high_attention: 0,
      },
    });
    expect(ctx.headline).toBe("No open positions");
  });
});

describe("countOperatingPostures", () => {
  it("sums postures", () => {
    expect(
      countOperatingPostures([
        { operatingPosture: "stable" },
        { operatingPosture: "stable" },
        { operatingPosture: "cautious" },
      ])
    ).toEqual({
      stable: 2,
      cautious: 1,
      defensive: 0,
      high_attention: 0,
    });
  });
});
