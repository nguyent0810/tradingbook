import { describe, expect, it } from "vitest";
import {
  closestExecutionActionHint,
  computeClosestExecutionStatus,
  computeDistanceAboveBreakoutFrac,
  computeDistanceToPullbackZoneFrac,
  compareClosestRowsExecutionOrder,
  computeRiskToStopFrac,
  pullbackProximityLabel,
} from "./closest-execution-metrics";

describe("computeDistanceToPullbackZoneFrac", () => {
  it("returns 0 inside zone", () => {
    expect(computeDistanceToPullbackZoneFrac(100, 95, 105)).toBe(0);
    expect(computeDistanceToPullbackZoneFrac(95, 95, 105)).toBe(0);
  });

  it("above zoneHigh uses (close - zoneHigh) / close", () => {
    expect(computeDistanceToPullbackZoneFrac(110, 95, 100)).toBeCloseTo((110 - 100) / 110);
  });

  it("below zoneLow uses (zoneLow - close) / close", () => {
    expect(computeDistanceToPullbackZoneFrac(90, 95, 100)).toBeCloseTo((95 - 90) / 90);
  });

  it("returns NaN for invalid inputs", () => {
    expect(computeDistanceToPullbackZoneFrac(0, 1, 2)).toBeNaN();
    expect(computeDistanceToPullbackZoneFrac(100, 102, 98)).toBeNaN();
    expect(computeDistanceToPullbackZoneFrac(100, 0, 0)).toBeNaN();
  });
});

describe("computeDistanceAboveBreakoutFrac", () => {
  it("computes extension vs breakout", () => {
    expect(computeDistanceAboveBreakoutFrac(103.2, 100)).toBeCloseTo(0.032);
  });

  it("returns NaN when breakout missing", () => {
    expect(computeDistanceAboveBreakoutFrac(100, 0)).toBeNaN();
  });
});

describe("computeRiskToStopFrac", () => {
  it("computes (close - stop) / close", () => {
    expect(computeRiskToStopFrac(100, 97.9)).toBeCloseTo(0.021);
  });
});

describe("computeClosestExecutionStatus", () => {
  it("READY when close in zone", () => {
    expect(computeClosestExecutionStatus("pullback_zone_interaction", 100, 98, 102)).toBe("READY");
  });

  it("INVALID when category breaks structure", () => {
    expect(computeClosestExecutionStatus("breakout_not_holding", 110, 98, 102)).toBe("INVALID");
  });

  it("WAIT when above zone but not broken", () => {
    expect(computeClosestExecutionStatus("pullback_zone_interaction", 110, 98, 102)).toBe("WAIT");
  });
});

describe("pullbackProximityLabel", () => {
  it("maps bands per UX spec", () => {
    expect(pullbackProximityLabel(0)).toBe("Very close");
    expect(pullbackProximityLabel(0.009)).toBe("Very close");
    expect(pullbackProximityLabel(0.01)).toBe("Near");
    expect(pullbackProximityLabel(0.032)).toBe("Near");
    expect(pullbackProximityLabel(0.039)).toBe("Near");
    expect(pullbackProximityLabel(0.04)).toBe("Moderate");
    expect(pullbackProximityLabel(0.06)).toBe("Moderate");
    expect(pullbackProximityLabel(0.061)).toBe("Far");
  });

  it("returns null for non-finite inputs", () => {
    expect(pullbackProximityLabel(Number.NaN)).toBeNull();
  });
});

describe("closestExecutionActionHint", () => {
  it("returns fixed copy per status", () => {
    expect(closestExecutionActionHint("READY")).toContain("Monitor");
    expect(closestExecutionActionHint("WAIT")).toContain("pullback");
    expect(closestExecutionActionHint("INVALID")).toContain("Do not consider");
  });
});

describe("compareClosestRowsExecutionOrder", () => {
  it("sorts by distance to zone first", () => {
    // rankScore is intentionally identical (0) on every row — these are all
    // INVALID-quality rows in production, where rankScore is always 0 (see
    // gate2/breakout-pullback.ts invalidBase()), so it can never differentiate them.
    const rows = [
      { rankScore: 0, close: 120, pullbackZoneLow: 110, pullbackZoneHigh: 115 },
      { rankScore: 0, close: 108, pullbackZoneLow: 110, pullbackZoneHigh: 115 },
      { rankScore: 0, close: 113, pullbackZoneLow: 110, pullbackZoneHigh: 115 },
    ];
    const sorted = [...rows].sort(compareClosestRowsExecutionOrder);
    expect(sorted[0]!.close).toBe(113);
    expect(sorted[1]!.close).toBe(108);
    expect(sorted[2]!.close).toBe(120);
  });

  it("does not use rankScore as a tie-breaker even when it varies (unrealistic input, but must not silently reorder on it)", () => {
    const rows = [
      { rankScore: 90, close: 112, pullbackZoneLow: 110, pullbackZoneHigh: 115, symbol: "BBB" },
      { rankScore: 10, close: 112, pullbackZoneLow: 110, pullbackZoneHigh: 115, symbol: "AAA" },
    ];
    // Both rows tie on distance (0, both inside the zone) and have no
    // partialPipelineScore/stageRank/reasonLineCount — falls all the way through
    // to the final alphabetical-by-symbol tie-break, never to the (unused)
    // differing rankScore. "AAA" (rankScore 10) sorts first despite the lower
    // score, proving rankScore plays no part in the ordering.
    const sorted = [...rows].sort(compareClosestRowsExecutionOrder);
    expect(sorted.map((r) => r.symbol)).toEqual(["AAA", "BBB"]);
  });

  it("tie-breaks distance+rankScore with partialPipelineScore then symbol", () => {
    const base = {
      rankScore: 80,
      close: 118,
      pullbackZoneLow: 110,
      pullbackZoneHigh: 115,
      partialPipelineScore: 10,
      reasonLineCount: 3,
    };
    const rows = [
      { ...base, symbol: "BBB", partialPipelineScore: 10 },
      { ...base, symbol: "AAA", partialPipelineScore: 12 },
      { ...base, symbol: "CCC", partialPipelineScore: 10 },
    ];
    const sorted = [...rows].sort(compareClosestRowsExecutionOrder);
    expect(sorted.map((r) => r.symbol)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("tie-breaks pipeline score ties with fewer reason lines", () => {
    const base = {
      rankScore: 80,
      close: 118,
      pullbackZoneLow: 110,
      pullbackZoneHigh: 115,
      partialPipelineScore: 10,
      stageRank: 50,
    };
    const rows = [
      { ...base, symbol: "Z", reasonLineCount: 5 },
      { ...base, symbol: "Y", reasonLineCount: 2 },
    ];
    const sorted = [...rows].sort(compareClosestRowsExecutionOrder);
    expect(sorted[0]!.symbol).toBe("Y");
    expect(sorted[1]!.symbol).toBe("Z");
  });
});
