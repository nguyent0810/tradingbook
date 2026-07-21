import { describe, expect, it } from "vitest";
import { bar } from "./__fixtures__/bar-series";
import { applyCalibrationVariant } from "./calibration";
import type { EarlyEntryEvaluationResult } from "./types";

function mockEvaluation(
  overrides: Partial<EarlyEntryEvaluationResult> = {}
): EarlyEntryEvaluationResult {
  return {
    earlyReversalScore: 60,
    proposedTradeState: "PILOT_BUY",
    entryType: "Early Reclaim",
    reasonCodes: ["RR_ACCEPTABLE", "RS_IMPROVING"],
    transitionReasonCodes: [],
    invalidLevel: 20,
    invalidLevelReason: "swing_low",
    stopDistancePct: 4,
    targetPrice: 24,
    targetReason: "prior_60d_high",
    estimatedRewardPct: 10,
    estimatedRiskReward: 2.2,
    suggestedPilotSizePct: 25,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: null,
    metrics: {
      sessionDate: "2026-05-14",
      close: 22,
      ma20: 21,
      ma50: 20,
      volume: 1e6,
      volumeMa20: 800_000,
      volumeRatio: 1.25,
      rs20SpreadPct: 2,
      rs20Delta3d: 1.2,
      bodyPct: 0.02,
      atr14: 0.5,
      closeNearHighPct: 0.8,
      distFromMa20Pct: 4.5,
      distFromMa50Pct: 8,
      stopLevel: 20,
      stopDistancePct: 4,
      rewardTarget: 24,
      targetPrice: 24,
      targetReason: "prior_60d_high",
      invalidLevelReason: "swing_low",
      riskRewardRatio: 2.2,
      estimatedRewardPct: 10,
      priorCompression: true,
      reclaimMa20: true,
      reclaimMa50: false,
    },
    extensionRiskScore: 10,
    riskRewardScore: 80,
    ...overrides,
  };
}

describe("early-entry calibration variants", () => {
  it("baseline leaves PILOT_BUY unchanged", () => {
    const r = applyCalibrationVariant(mockEvaluation(), "baseline", {
      gate1Level: "PASS",
      gate1Trend: "bullish",
      sector: "bank",
      nextBar: null,
      nextNextBar: null,
      indexRs20Positive: true,
    });
    expect(r.state).toBe("PILOT_BUY");
    expect(r.demotedFromPilot).toBe(false);
  });

  it("rr_min_2_5 demotes when R:R below 2.5", () => {
    const r = applyCalibrationVariant(
      mockEvaluation({ metrics: { ...mockEvaluation().metrics, riskRewardRatio: 2.1 } }),
      "rr_min_2_5",
      { gate1Level: "PASS", gate1Trend: null, sector: null, nextBar: null, nextNextBar: null, indexRs20Positive: null }
    );
    expect(r.state).toBe("WATCH");
    expect(r.demotedFromPilot).toBe(true);
  });

  it("demote_weak_regime blocks PILOT when Gate1 not PASS", () => {
    const r = applyCalibrationVariant(mockEvaluation(), "demote_weak_regime", {
      gate1Level: "WARNING",
      gate1Trend: null,
      sector: null,
      nextBar: null,
      nextNextBar: null,
      indexRs20Positive: null,
    });
    expect(r.state).toBe("WATCH");
  });

  it("next_day_confirmation requires higher next close", () => {
    const next = bar("2026-05-15", 22, 22.5, 21.8, 21.9, 1e6);
    const r = applyCalibrationVariant(mockEvaluation(), "next_day_confirmation", {
      gate1Level: "PASS",
      gate1Trend: null,
      sector: null,
      nextBar: next,
      nextNextBar: null,
      indexRs20Positive: null,
    });
    expect(r.state).toBe("WATCH");
  });
});
