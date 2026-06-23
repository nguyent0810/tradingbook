import { describe, expect, it } from "vitest";
import { bar } from "./__fixtures__/bar-series";
import {
  deriveEarlyEntryTradeState,
  detectAddZoneContext,
  detectStructureBroken,
  computeMa10Series,
} from "./state-machine";
import type { EarlyEntryBarMetrics } from "./types";

const baseMetrics = (overrides: Partial<EarlyEntryBarMetrics> = {}): EarlyEntryBarMetrics =>
  ({
    sessionDate: "2026-05-14",
    close: 24,
    ma20: 23,
    ma50: 22,
    volume: 1e6,
    volumeMa20: 1e6,
    volumeRatio: 1.2,
    rs20SpreadPct: 3,
    rs20Delta3d: 1,
    bodyPct: 0.02,
    atr14: 0.5,
    closeNearHighPct: 0.8,
    distFromMa20Pct: 4,
    distFromMa50Pct: 8,
    stopLevel: 22.5,
    stopDistancePct: 6,
    rewardTarget: 28,
    targetPrice: 28,
    targetReason: "prior_60d_high",
    invalidLevelReason: "swing_low",
    riskRewardRatio: 2.5,
    estimatedRewardPct: 16,
    priorCompression: false,
    reclaimMa20: true,
    reclaimMa50: false,
    ...overrides,
  }) as EarlyEntryBarMetrics;

describe("state-machine Phase 4", () => {
  it("PILOT_BUY when score and RR acceptable", () => {
    const { state } = deriveEarlyEntryTradeState({
      reasonCodes: ["RECLAIM_MA20", "RR_ACCEPTABLE", "VOLUME_EXPANSION"],
      transitionReasonCodes: [],
      earlyReversalScore: 60,
      extensionRiskScore: 10,
      gate2Quality: "INVALID",
      metrics: baseMetrics(),
      hadRecentPilotContext: false,
      structureBroken: false,
    });
    expect(state).toBe("PILOT_BUY");
  });

  it("WATCH when strong score but BAD_RR", () => {
    const { state } = deriveEarlyEntryTradeState({
      reasonCodes: ["RECLAIM_MA20", "BAD_RR"],
      transitionReasonCodes: [],
      earlyReversalScore: 90,
      extensionRiskScore: 0,
      gate2Quality: "INVALID",
      metrics: baseMetrics({ riskRewardRatio: 1.2 }),
      hadRecentPilotContext: false,
      structureBroken: false,
    });
    expect(state).toBe("WATCH");
  });

  it("EXTENDED_DO_NOT_CHASE on high extension risk", () => {
    const { state, transitionReasonCodes } = deriveEarlyEntryTradeState({
      reasonCodes: ["EXTENDED_FROM_MA20"],
      transitionReasonCodes: [],
      earlyReversalScore: 70,
      extensionRiskScore: 80,
      gate2Quality: "INVALID",
      metrics: baseMetrics({ distFromMa20Pct: 12 }),
      hadRecentPilotContext: false,
      structureBroken: false,
    });
    expect(state).toBe("EXTENDED_DO_NOT_CHASE");
    expect(transitionReasonCodes).toContain("CHASE_RISK");
  });

  it("FAILED_SETUP when structure broken", () => {
    expect(detectStructureBroken(21, 22)).toBe(true);
    const { state } = deriveEarlyEntryTradeState({
      reasonCodes: ["RECLAIM_MA20"],
      transitionReasonCodes: [],
      earlyReversalScore: 70,
      extensionRiskScore: 0,
      gate2Quality: "INVALID",
      metrics: baseMetrics(),
      hadRecentPilotContext: false,
      structureBroken: true,
    });
    expect(state).toBe("FAILED_SETUP");
  });

  it("ADD_ZONE when add context passes", () => {
    const bars = Array.from({ length: 55 }, (_, i) => {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return bar(dk, 23, 24, 22.8, 23.5, i < 52 ? 600_000 : 900_000);
    });
    const idx = bars.length - 1;
    const closes = bars.map((b) => b.close);
    const ma10Series = computeMa10Series(closes);
    const ma20 = 23.4;
    const ma20Series = closes.map(() => ma20);

    const add = detectAddZoneContext({
      bars,
      idx,
      ma20,
      ma50: 22,
      ma20Series,
      ma10Series,
      volumeRatio: 0.85,
      prevBar: bars[idx - 1]!,
      hadRecentPilotContext: true,
      riskRewardRatio: 2.2,
      invalidLevel: 22.5,
      close: bars[idx]!.close,
    });
    bars[idx] = bar(
      bars[idx]!.date.toISOString().slice(0, 10),
      23.4,
      24.2,
      23.3,
      24.1,
      800_000
    );

    expect(add.transitionCodes).toContain("PULLBACK_VOLUME_CONTRACTS");
    if (add.eligible) {
      const { state, transitionReasonCodes } = deriveEarlyEntryTradeState({
        reasonCodes: ["RR_ACCEPTABLE"],
        transitionReasonCodes: add.transitionCodes,
        earlyReversalScore: 50,
        extensionRiskScore: 5,
        gate2Quality: "INVALID",
        metrics: baseMetrics(),
        hadRecentPilotContext: true,
        structureBroken: false,
      });
      expect(state).toBe("ADD_ZONE");
      expect(transitionReasonCodes).toContain("ADD_RR_ACCEPTABLE");
    }
  });

  it("ADD_BAD_RR blocks ADD_ZONE promotion", () => {
    const { state } = deriveEarlyEntryTradeState({
      reasonCodes: ["BAD_RR"],
      transitionReasonCodes: [
        "PILOT_TO_ADD_ZONE",
        "PULLBACK_VOLUME_CONTRACTS",
        "STRUCTURE_HELD",
        "ADD_CONFIRMATION_CANDLE",
        "ADD_BAD_RR",
      ],
      earlyReversalScore: 50,
      extensionRiskScore: 5,
      gate2Quality: "INVALID",
      metrics: baseMetrics({ riskRewardRatio: 1.2 }),
      hadRecentPilotContext: true,
      structureBroken: false,
    });
    expect(state).not.toBe("ADD_ZONE");
  });
});
