import { describe, expect, it } from "vitest";
import {
  computeRsScoringV1,
  computeRsStrengthScoreV1,
  isRsScoringV1Enabled,
} from "./rs-scoring-v1";
import type { RsNearMissWatchlistRow } from "./rs-near-miss-watchlist";

function stubRow(overrides: Partial<RsNearMissWatchlistRow> = {}): RsNearMissWatchlistRow {
  return {
    symbol: "VND",
    sessionDate: "2026-05-28",
    rs20SpreadPct: 11.6,
    rs50SpreadPct: -0.2,
    terminalCode: "pullback_zone_interaction",
    terminalCategory: "pullback_zone_interaction",
    failedGate2Because: "x",
    topRejectionReason: "x",
    stageRank: 58,
    distanceToPullbackZoneFrac: 0.02,
    rankScore: 0,
    lastVolume: 1_000_000,
    rsDiagnosticSummary: "RS20 +11.6",
    ...overrides,
  };
}

describe("rs-scoring-v1", () => {
  it("is disabled by default", () => {
    const prev = process.env.RS_SCORING_V1_ENABLED;
    delete process.env.RS_SCORING_V1_ENABLED;
    expect(isRsScoringV1Enabled()).toBe(false);
    if (prev !== undefined) process.env.RS_SCORING_V1_ENABLED = prev;
  });

  it("increases RS strength score when RS20 rises holding RS50 fixed", () => {
    const low = computeRsStrengthScoreV1({
      row: stubRow({ rs20SpreadPct: 3 }),
      rsDiagnostic: null,
    });
    const high = computeRsStrengthScoreV1({
      row: stubRow({ rs20SpreadPct: 18 }),
      rsDiagnostic: null,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("flags low confidence when RS20 positive and RS50 negative", () => {
    const result = computeRsScoringV1({
      row: stubRow({ rs20SpreadPct: 12, rs50SpreadPct: -8 }),
      rsDiagnostic: null,
    });
    expect(result.rsConfidence).toBe("low");
  });

  it("scores setup readiness higher for pullback zone than trend_below_ma50", () => {
    const near = computeRsScoringV1({
      row: stubRow({
        terminalCode: "pullback_zone_interaction",
        stageRank: 58,
        distanceToPullbackZoneFrac: 0.02,
      }),
      rsDiagnostic: null,
    });
    const trend = computeRsScoringV1({
      row: stubRow({
        terminalCode: "trend_below_ma50",
        stageRank: 15,
        distanceToPullbackZoneFrac: null,
      }),
      rsDiagnostic: null,
    });
    expect(near.setupReadinessScore).toBeGreaterThan(trend.setupReadinessScore);
  });
});
