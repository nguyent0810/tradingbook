import { describe, expect, it } from "vitest";
import { buildGate2ScanDiagnosticsSummary } from "./gate2-scan-diagnostics";
import type { BreakoutPullbackEvaluation } from "./gate2/types";

function invalidEv(
  overrides: Partial<BreakoutPullbackEvaluation> = {}
): BreakoutPullbackEvaluation {
  return {
    quality: "INVALID",
    rankScore: 0,
    breakoutLevel: 0,
    pullbackZoneLow: 0,
    pullbackZoneHigh: 0,
    stopLevel: 0,
    close: 50,
    reasons: ["step", "Participation too thin—today’s volume is 0.50× the 20-day median."],
    terminalCode: "volume_ratio",
    barDate: new Date(Date.UTC(2026, 4, 25)),
    ...overrides,
  };
}

describe("buildGate2ScanDiagnosticsSummary", () => {
  it("uses terminalCode on closest rows when present", () => {
    const summary = buildGate2ScanDiagnosticsSummary([
      {
        symbol: "HPG",
        symbolId: "1",
        evaluation: invalidEv(),
      },
    ]);
    expect(summary.closestToValidSymbols[0]?.terminalCode).toBe("volume_ratio");
    expect(summary.invalidCountByCategory.volume_ratio).toBe(1);
  });

  it("falls back to message inference for legacy evaluations without terminalCode", () => {
    const summary = buildGate2ScanDiagnosticsSummary([
      {
        symbol: "FPT",
        symbolId: "2",
        evaluation: invalidEv({
          terminalCode: undefined,
          reasons: ["x", "No qualifying breakout in the last 10 sessions—need a fresh push."],
        }),
      },
    ]);
    expect(summary.closestToValidSymbols[0]?.terminalCategory).toBe("breakout_recency");
    expect(summary.invalidCountByCategory.breakout_recency).toBe(1);
  });
});
