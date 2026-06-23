import { describe, expect, it } from "vitest";
import { bar } from "./__fixtures__/bar-series";
import {
  buildPaperSignal,
  evaluatePaperAcceptance,
  isPaperWorthySignal,
  mergeSignalsIntoStore,
  paperSignalId,
  paperSuggestedAction,
  resolvePaperSignalOutcomes,
  emptyPaperStore,
  buildPaperCalibrationMap,
} from "./paper-signals";
import type { EarlyEntryEvaluationResult } from "./types";

function mockEvaluation(): EarlyEntryEvaluationResult {
  return {
    earlyReversalScore: 60,
    proposedTradeState: "PILOT_BUY",
    entryType: "Early Reclaim",
    reasonCodes: ["RR_ACCEPTABLE"],
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
    metrics: {
      sessionDate: "2026-05-14",
      close: 22,
      ma20: 21,
      ma50: 20,
      volume: 1_500_000,
      volumeMa20: 1_000_000,
      volumeRatio: 1.5,
      rs20SpreadPct: 2,
      rs20Delta3d: 1.2,
      bodyPct: 0.02,
      atr14: 0.5,
      closeNearHighPct: 0.8,
      distFromMa20Pct: 4,
      distFromMa50Pct: 8,
      stopLevel: 20,
      stopDistancePct: 4,
      rewardTarget: 24,
      targetPrice: 24,
      targetReason: "prior_60d_high",
      invalidLevelReason: "swing_low",
      riskRewardRatio: 2.2,
      estimatedRewardPct: 10,
      priorCompression: false,
      reclaimMa20: true,
      reclaimMa50: false,
    },
    extensionRiskScore: 5,
    riskRewardScore: 80,
  };
}

describe("paper-signals", () => {
  it("paperSignalId is stable", () => {
    expect(paperSignalId("acb", "2026-05-14")).toBe("ACB|2026-05-14");
  });

  it("isPaperWorthySignal filters BLOCKED low-score", () => {
    expect(isPaperWorthySignal("BLOCKED", 10)).toBe(false);
    expect(isPaperWorthySignal("WATCH", 40)).toBe(true);
    expect(isPaperWorthySignal("EXTENDED_DO_NOT_CHASE", 5)).toBe(true);
    expect(isPaperWorthySignal("PILOT_BUY", 59)).toBe(true);
  });

  it("buildPaperSignal includes calibration variants", () => {
    const sig = buildPaperSignal({
      symbol: "ACB",
      sessionDate: "2026-05-14",
      evaluation: mockEvaluation(),
      calibrationCtx: {
        gate1Level: "PASS",
        gate1Trend: "bullish",
        sector: "bank",
        nextBar: null,
        nextNextBar: null,
        indexRs20Positive: true,
      },
      gate1RegimeLabel: "uptrend",
      gate2Quality: "INVALID",
      gate2TerminalCode: "breakout_recency",
    });
    expect(sig.calibration.baseline.pilotQualified).toBe(true);
    expect(sig.displayLabel).toBe("Pilot Candidate");
    expect(sig.suggestedAction).toMatch(/not a buy/i);
    expect(sig.calibration.demote_weak_regime).toBeDefined();
  });

  it("mergeSignalsIntoStore preserves resolved outcomes", () => {
    const store = emptyPaperStore();
    const sig = buildPaperSignal({
      symbol: "ACB",
      sessionDate: "2026-05-14",
      evaluation: mockEvaluation(),
      calibrationCtx: {
        gate1Level: "PASS",
        gate1Trend: null,
        sector: "bank",
        nextBar: null,
        nextNextBar: null,
        indexRs20Positive: null,
      },
      gate1RegimeLabel: "uptrend",
      gate2Quality: "INVALID",
      gate2TerminalCode: null,
    });
    sig.outcomes = {
      resolvedAt: "2026-06-01",
      ret5d: 1,
      ret10d: 2,
      ret20d: 3,
      mae10d: -2,
      mfe10d: 5,
      rMultiple: 1.2,
      invalidLevelHit: false,
      targetHit: false,
      gate2BecameAb: false,
      extendedAvoidedBad5d: null,
    };
    const merged = mergeSignalsIntoStore(store, [
      { ...sig, earlyReversalScore: 55 },
    ]);
    expect(merged.signals[0]!.outcomes?.ret10d).toBe(2);
    expect(merged.signals[0]!.earlyReversalScore).toBe(55);
  });

  it("resolvePaperSignalOutcomes computes forward metrics", () => {
    const bars = Array.from({ length: 80 }, (_, i) => {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return bar(dk, 20 + i * 0.01, 20.5 + i * 0.01, 19.5, 20 + i * 0.02, 1e6);
    });
    const sig = buildPaperSignal({
      symbol: "TST",
      sessionDate: bars[55]!.date.toISOString().slice(0, 10),
      evaluation: mockEvaluation(),
      calibrationCtx: {
        gate1Level: "PASS",
        gate1Trend: null,
        sector: "other",
        nextBar: bars[56]!,
        nextNextBar: bars[57]!,
        indexRs20Positive: null,
      },
      gate1RegimeLabel: "uptrend",
      gate2Quality: "INVALID",
      gate2TerminalCode: null,
    });
    const outcomes = resolvePaperSignalOutcomes({
      signal: sig,
      bars,
      sessionIdx: 55,
      gate2BecameAb: false,
    });
    expect(outcomes).not.toBeNull();
    expect(outcomes!.ret20d).not.toBeNull();
  });

  it("evaluatePaperAcceptance blocks until 20 resolved pilots", () => {
    const pilots = Array.from({ length: 5 }, (_, i) => ({
      ...buildPaperSignal({
        symbol: `S${i}`,
        sessionDate: `2026-01-${10 + i}`,
        evaluation: mockEvaluation(),
        calibrationCtx: {
          gate1Level: "PASS",
          gate1Trend: null,
          sector: "bank",
          nextBar: null,
          nextNextBar: null,
          indexRs20Positive: null,
        },
        gate1RegimeLabel: "uptrend",
        gate2Quality: "INVALID",
        gate2TerminalCode: null,
      }),
      outcomes: {
        resolvedAt: "2026-06-01",
        ret5d: 1,
        ret10d: 2,
        ret20d: 3,
        mae10d: -3,
        mfe10d: 5,
        rMultiple: 1.5,
        invalidLevelHit: false,
        targetHit: false,
        gate2BecameAb: false,
        extendedAvoidedBad5d: null,
      },
    }));
    const result = evaluatePaperAcceptance({
      variant: "baseline",
      resolvedPilots: pilots,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("20"))).toBe(true);
  });

  it("paperSuggestedAction for EXTENDED is defensive", () => {
    const cal = buildPaperCalibrationMap(mockEvaluation(), {
      gate1Level: "PASS",
      gate1Trend: null,
      sector: null,
      nextBar: null,
      nextNextBar: null,
      indexRs20Positive: null,
    });
    const action = paperSuggestedAction("EXTENDED_DO_NOT_CHASE", cal);
    expect(action).toMatch(/avoid chasing/i);
  });
});
