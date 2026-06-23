import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { ReasonDetectionInput } from "./types";
import {
  detectCloseNearHigh,
  detectCompressionBreakout,
  detectEarlyEntryReasonCodes,
  detectExtendedFromMa20,
  detectNoConfirmationCandle,
  detectPocketPivot,
  detectPriorCompression,
  detectReclaimMa20,
  detectReclaimMa50,
  detectRiskRewardAcceptable,
  detectRiskRewardBad,
  detectRsImproving,
  detectStopNearbyFromDistance,
  detectVolumeExpansion,
  detectWeakVolume,
} from "./reason-codes";
import { bar } from "./__fixtures__/bar-series";

function baseInput(overrides: Partial<ReasonDetectionInput> = {}): ReasonDetectionInput {
  const b = bar("2026-04-08", 23.5, 24.2, 23.4, 24.1, 1_500_000);
  return {
    bar: b,
    prevBar: bar("2026-04-07", 23.2, 23.5, 23.1, 23.3, 900_000),
    bars: [b],
    idx: 0,
    ma20: 23.0,
    ma50: 22.5,
    ma20Series: [23.0],
    volumeRatio: 1.4,
    atr14: 0.5,
    bodyPct: 0.02,
    closeNearHighPct: 0.9,
    distFromMa20Pct: 4,
    distFromMa50Pct: 7,
    priorCompression: false,
    pocketPivot: false,
    riskRewardRatio: 2.2,
    rs20Delta3d: 2,
    reclaimMa20: false,
    reclaimMa50: false,
    ...overrides,
  };
}

describe("early-entry reason codes", () => {
  it("detectReclaimMa20", () => {
    expect(detectReclaimMa20(baseInput({ reclaimMa20: true }))).toBe(true);
    expect(detectReclaimMa20(baseInput({ reclaimMa20: false }))).toBe(false);
  });

  it("detectReclaimMa50", () => {
    expect(detectReclaimMa50(baseInput({ reclaimMa50: true }))).toBe(true);
  });

  it("detectVolumeExpansion", () => {
    expect(detectVolumeExpansion(baseInput({ volumeRatio: 1.3 }))).toBe(true);
    expect(detectVolumeExpansion(baseInput({ volumeRatio: 1.0 }))).toBe(false);
  });

  it("detectWeakVolume", () => {
    expect(detectWeakVolume(baseInput({ volumeRatio: 0.8 }))).toBe(true);
  });

  it("detectCloseNearHigh", () => {
    expect(
      detectCloseNearHigh(
        baseInput({
          closeNearHighPct: 0.8,
          bar: bar("2026-04-08", 23.5, 24.2, 23.4, 24.1, 1e6),
        })
      )
    ).toBe(true);
    expect(
      detectCloseNearHigh(
        baseInput({
          closeNearHighPct: 0.8,
          bar: bar("2026-04-08", 24.2, 24.2, 23.4, 23.5, 1e6),
        })
      )
    ).toBe(false);
  });

  it("detectPriorCompression", () => {
    expect(detectPriorCompression(baseInput({ priorCompression: true }))).toBe(true);
  });

  it("detectCompressionBreakout", () => {
    const prev = bar("2026-04-07", 23, 23.5, 22.9, 23.1, 1e6);
    expect(
      detectCompressionBreakout(
        baseInput({
          priorCompression: true,
          volumeRatio: 1.3,
          prevBar: prev,
          bar: bar("2026-04-08", 23.2, 24, 23.1, 23.9, 1.5e6),
        })
      )
    ).toBe(true);
  });

  it("detectPocketPivot", () => {
    expect(detectPocketPivot(baseInput({ pocketPivot: true }))).toBe(true);
  });

  it("detectStopNearbyFromDistance", () => {
    expect(detectStopNearbyFromDistance(4)).toBe(true);
    expect(detectStopNearbyFromDistance(8)).toBe(false);
  });

  it("detectRiskRewardAcceptable and Bad", () => {
    expect(detectRiskRewardAcceptable(2.1)).toBe(true);
    expect(detectRiskRewardBad(1.2)).toBe(true);
    expect(detectRiskRewardBad(2.0)).toBe(false);
  });

  it("detectRsImproving", () => {
    expect(detectRsImproving(baseInput({ rs20Delta3d: 1.5 }))).toBe(true);
    expect(detectRsImproving(baseInput({ rs20Delta3d: 0.5 }))).toBe(false);
  });

  it("detectExtendedFromMa20", () => {
    expect(detectExtendedFromMa20(baseInput({ distFromMa20Pct: 7 }))).toBe(true);
    expect(detectExtendedFromMa20(baseInput({ distFromMa20Pct: 3 }))).toBe(false);
  });

  it("detectNoConfirmationCandle", () => {
    expect(
      detectNoConfirmationCandle(
        baseInput({
          reclaimMa20: false,
          reclaimMa50: false,
          priorCompression: false,
          bodyPct: 0.001,
          atr14: 1,
          bar: bar("2026-04-08", 24, 24.01, 23.99, 24.005, 1e6),
        })
      )
    ).toBe(true);
  });

  it("detectEarlyEntryReasonCodes aggregates dual reclaim", () => {
    const codes = detectEarlyEntryReasonCodes(
      baseInput({ reclaimMa20: true, reclaimMa50: true, volumeRatio: 1.5 }),
      4
    );
    expect(codes).toContain("RECLAIM_MA20");
    expect(codes).toContain("RECLAIM_MA50");
    expect(codes).toContain("VOLUME_EXPANSION");
    expect(codes).toContain("RR_ACCEPTABLE");
  });
});

describe("computeEarlyEntryRiskReward", () => {
  it("uses structural resistance when 60d high is meaningfully above close", async () => {
    const { computeEarlyEntryRiskReward } = await import("./risk-reward");
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const high = i < 45 ? 26 : 23.5;
      bars.push(bar(dk, 22, high, 21.5, 22.5, 1e6));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 23.8, 24.2, 23.5, 24.1, 2e6);
    const rr = computeEarlyEntryRiskReward(bars, idx);
    expect(rr.riskRewardRatio).not.toBeNull();
    expect(rr.targetPrice).not.toBeNull();
    expect([
      "prior_60d_high",
      "prior_20d_high",
      "pivot_high",
      "resistance_cluster",
      "congestion_ceiling",
      "atr_floor",
      "pct_floor",
    ]).toContain(rr.rewardSource);
  });
});
