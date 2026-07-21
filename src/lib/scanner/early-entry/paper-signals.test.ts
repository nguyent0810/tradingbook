import { describe, expect, it } from "vitest";
import { bar } from "./__fixtures__/bar-series";
import {
  buildPaperSafetySummary,
  buildPaperSignal,
  computeValidationStatus,
  emptyPaperStore,
  evaluatePaperAcceptance,
  filterSignalsBySource,
  isPaperWorthySignal,
  mergeSignalsIntoStore,
  normalizePaperStore,
  paperSignalId,
  paperSuggestedAction,
  resolvePaperSignalOutcomes,
  buildPaperCalibrationMap,
  computeLevelHitOrder,
} from "./paper-signals";
import type { EarlyEntryEvaluationResult } from "./types";
import { isEarlyEntryV1Enabled } from "./feature-flag";

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
    distFromMa20Pct: null,
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

function mockCtx() {
  return {
    gate1Level: "PASS" as const,
    gate1Trend: null,
    sector: "bank" as const,
    nextBar: null,
    nextNextBar: null,
    indexRs20Positive: null,
  };
}

function baseSignal(source: "historical_seed" | "live_paper" = "historical_seed") {
  return buildPaperSignal({
    symbol: "ACB",
    sessionDate: "2026-05-14",
    source,
    evaluation: mockEvaluation(),
    calibrationCtx: mockCtx(),
    gate1RegimeLabel: "uptrend",
    gate2Quality: "INVALID",
    gate2TerminalCode: null,
  });
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

  it("buildPaperSignal includes calibration variants and source", () => {
    const sig = baseSignal("live_paper");
    expect(sig.calibration.baseline.pilotQualified).toBe(true);
    expect(sig.displayLabel).toBe("Pilot Candidate");
    expect(sig.source).toBe("live_paper");
    expect(sig.dataSession).toBe("2026-05-14");
    expect(sig.validationStatus).toBe("open");
    expect(sig.isResolved).toBe(false);
    expect(sig.suggestedAction).toMatch(/not a buy/i);
  });

  it("mergeSignalsIntoStore is idempotent — no duplicate append", () => {
    const store = emptyPaperStore();
    const sig = baseSignal();
    const first = mergeSignalsIntoStore(store, [sig]);
    expect(first.added).toBe(1);
    expect(first.skipped).toBe(0);
    expect(first.store.signals).toHaveLength(1);

    const second = mergeSignalsIntoStore(first.store, [
      { ...sig, earlyReversalScore: 99 },
    ]);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.store.signals).toHaveLength(1);
    expect(second.store.signals[0]!.earlyReversalScore).toBe(60);
  });

  it("mergeSignalsIntoStore preserves existing resolved outcomes", () => {
    const sig = baseSignal();
    sig.outcomes = {
      updatedAt: "2026-06-01T00:00:00.000Z",
      ret5d: 1,
      ret10d: 2,
      ret20d: 3,
      mae10d: -2,
      mfe10d: 5,
      rMultiple: 1.2,
      invalidLevelHit: false,
      targetHit: false,
      invalidHitBeforeTarget: null,
      targetHitBeforeInvalid: null,
      gate2BecameAb: false,
      gate2BecameAbSession: null,
      extendedAvoidedBad5d: null,
    };
    sig.isResolved = true;
    sig.validationStatus = "resolved";
    const merged = mergeSignalsIntoStore(emptyPaperStore(), [sig]);
    const retry = mergeSignalsIntoStore(merged.store, [baseSignal()]);
    expect(retry.skipped).toBe(1);
    expect(retry.store.signals[0]!.outcomes?.ret10d).toBe(2);
  });

  it("normalizePaperStore migrates v1 records to historical_seed", () => {
    const legacy = {
      version: 1,
      lastUpdated: "2026-01-01",
      signals: [
        {
          ...baseSignal(),
          source: undefined,
        },
      ],
    };
    const normalized = normalizePaperStore(legacy as never);
    expect(normalized.version).toBe(2);
    expect(normalized.signals[0]!.source).toBe("historical_seed");
  });

  it("filterSignalsBySource separates live and historical", () => {
    const store = mergeSignalsIntoStore(emptyPaperStore(), [
      baseSignal("historical_seed"),
      buildPaperSignal({
        ...{
          symbol: "VCB",
          sessionDate: "2026-05-15",
          source: "live_paper" as const,
          evaluation: mockEvaluation(),
          calibrationCtx: mockCtx(),
          gate1RegimeLabel: "uptrend",
          gate2Quality: "INVALID",
          gate2TerminalCode: null,
        },
      }),
    ]).store;
    expect(filterSignalsBySource(store.signals, "live_paper")).toHaveLength(1);
    expect(filterSignalsBySource(store.signals, "historical_seed")).toHaveLength(1);
    expect(filterSignalsBySource(store.signals, "combined")).toHaveLength(2);
  });

  it("resolvePaperSignalOutcomes resolves horizons independently (partial)", () => {
    const bars = Array.from({ length: 66 }, (_, i) => {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return bar(dk, 20 + i * 0.01, 20.5 + i * 0.01, 19.5, 20 + i * 0.02, 1e6);
    });
    const sessionIdx = 55;
    const sig = buildPaperSignal({
      symbol: "TST",
      sessionDate: bars[sessionIdx]!.date.toISOString().slice(0, 10),
      source: "live_paper",
      evaluation: mockEvaluation(),
      calibrationCtx: mockCtx(),
      gate1RegimeLabel: "uptrend",
      gate2Quality: "INVALID",
      gate2TerminalCode: null,
    });
    const resolved = resolvePaperSignalOutcomes({
      signal: sig,
      bars,
      sessionIdx,
      gate2BecameAb: false,
      gate2BecameAbSession: null,
    });
    expect(resolved.outcomes?.ret5d).not.toBeNull();
    expect(resolved.outcomes?.ret10d).not.toBeNull();
    expect(resolved.outcomes?.ret20d).toBeNull();
    expect(resolved.validationStatus).toBe("partial");
    expect(resolved.isResolved).toBe(false);
  });

  it("resolvePaperSignalOutcomes fully resolves only after 20 sessions", () => {
    const bars = Array.from({ length: 80 }, (_, i) => {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return bar(dk, 20 + i * 0.01, 20.5 + i * 0.01, 19.5, 20 + i * 0.02, 1e6);
    });
    const resolved = resolvePaperSignalOutcomes({
      signal: baseSignal("live_paper"),
      bars,
      sessionIdx: 55,
      gate2BecameAb: false,
      gate2BecameAbSession: null,
    });
    expect(resolved.outcomes?.ret20d).not.toBeNull();
    expect(resolved.validationStatus).toBe("resolved");
    expect(resolved.isResolved).toBe(true);
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("computeLevelHitOrder tracks invalid before target", () => {
    const bars = [
      bar("2026-01-01", 22, 23, 21, 22, 1e6),
      bar("2026-01-02", 22, 23, 19, 20, 1e6),
      bar("2026-01-03", 20, 25, 20, 24, 1e6),
    ];
    const hits = computeLevelHitOrder(bars, 0, 20, 24, 20);
    expect(hits.invalidLevelHit).toBe(true);
    expect(hits.targetHit).toBe(true);
    expect(hits.invalidHitBeforeTarget).toBe(true);
    expect(hits.targetHitBeforeInvalid).toBe(false);
  });

  it("evaluatePaperAcceptance blocks live when sample size insufficient", () => {
    const pilots = Array.from({ length: 5 }, (_, i) => ({
      ...buildPaperSignal({
        symbol: `S${i}`,
        sessionDate: `2026-01-${10 + i}`,
        source: "live_paper",
        evaluation: mockEvaluation(),
        calibrationCtx: mockCtx(),
        gate1RegimeLabel: "uptrend",
        gate2Quality: "INVALID",
        gate2TerminalCode: null,
      }),
      isResolved: true,
      validationStatus: "resolved" as const,
      outcomes: {
        updatedAt: "2026-06-01T00:00:00.000Z",
        ret5d: 1,
        ret10d: 2,
        ret20d: 3,
        mae10d: -3,
        mfe10d: 5,
        rMultiple: 1.5,
        invalidLevelHit: false,
        targetHit: false,
        invalidHitBeforeTarget: null,
        targetHitBeforeInvalid: null,
        gate2BecameAb: false,
        gate2BecameAbSession: null,
        extendedAvoidedBad5d: null,
      },
    }));
    const liveResult = evaluatePaperAcceptance({
      variant: "baseline",
      resolvedPilots: pilots,
      scope: "live_only",
    });
    expect(liveResult.ready).toBe(false);
    expect(liveResult.blockers.some((b) => b.includes("20"))).toBe(true);

    const allResult = evaluatePaperAcceptance({
      variant: "baseline",
      resolvedPilots: pilots,
      scope: "all",
    });
    expect(allResult.ready).toBe(false);
  });

  it("evaluatePaperAcceptance ignores historical seed for live_only scope", () => {
    const historicalPilot = {
      ...baseSignal("historical_seed"),
      isResolved: true,
      validationStatus: "resolved" as const,
      outcomes: {
        updatedAt: "2026-06-01T00:00:00.000Z",
        ret5d: 5,
        ret10d: 10,
        ret20d: 15,
        mae10d: -1,
        mfe10d: 12,
        rMultiple: 3,
        invalidLevelHit: false,
        targetHit: true,
        invalidHitBeforeTarget: false,
        targetHitBeforeInvalid: true,
        gate2BecameAb: true,
        gate2BecameAbSession: "2026-05-20",
        extendedAvoidedBad5d: null,
      },
    };
    const result = evaluatePaperAcceptance({
      variant: "baseline",
      resolvedPilots: Array.from({ length: 25 }, () => historicalPilot),
      scope: "live_only",
    });
    expect(result.checks.minSignals).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("computeValidationStatus reflects partial vs resolved", () => {
    expect(computeValidationStatus(3, null)).toBe("open");
    expect(
      computeValidationStatus(6, {
        updatedAt: "x",
        ret5d: 1,
        ret10d: null,
        ret20d: null,
        mae10d: null,
        mfe10d: null,
        rMultiple: null,
        invalidLevelHit: false,
        targetHit: false,
        invalidHitBeforeTarget: null,
        targetHitBeforeInvalid: null,
        gate2BecameAb: false,
        gate2BecameAbSession: null,
        extendedAvoidedBad5d: null,
      })
    ).toBe("partial");
    expect(
      computeValidationStatus(20, {
        updatedAt: "x",
        ret5d: 1,
        ret10d: 2,
        ret20d: 3,
        mae10d: null,
        mfe10d: null,
        rMultiple: null,
        invalidLevelHit: false,
        targetHit: false,
        invalidHitBeforeTarget: null,
        targetHitBeforeInvalid: null,
        gate2BecameAb: false,
        gate2BecameAbSession: null,
        extendedAvoidedBad5d: null,
      })
    ).toBe("resolved");
  });

  it("buildPaperSafetySummary reports open live counts", () => {
    const store = mergeSignalsIntoStore(emptyPaperStore(), [
      baseSignal("live_paper"),
      buildPaperSignal({
        symbol: "VCB",
        sessionDate: "2026-05-15",
        source: "historical_seed",
        evaluation: mockEvaluation(),
        calibrationCtx: mockCtx(),
        gate1RegimeLabel: "uptrend",
        gate2Quality: "INVALID",
        gate2TerminalCode: null,
      }),
    ]).store;
    const summary = buildPaperSafetySummary(store);
    expect(summary.openSignals).toBe(2);
    expect(summary.openLiveSignals).toBe(1);
    expect(summary.anyVariantReady).toBe(false);
  });

  it("paperSuggestedAction for EXTENDED is defensive", () => {
    const cal = buildPaperCalibrationMap(mockEvaluation(), mockCtx());
    const action = paperSuggestedAction("EXTENDED_DO_NOT_CHASE", cal);
    expect(action).toMatch(/avoid chasing/i);
  });

  it("EARLY_ENTRY_V1_ENABLED defaults off (unchanged)", () => {
    const prev = process.env.EARLY_ENTRY_V1_ENABLED;
    delete process.env.EARLY_ENTRY_V1_ENABLED;
    expect(isEarlyEntryV1Enabled()).toBe(false);
    if (prev !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prev;
  });
});
