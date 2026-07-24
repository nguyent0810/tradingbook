import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { bar } from "./__fixtures__/bar-series";
import {
  collectResistanceCandidates,
  collectStopCandidates,
  computeEarlyEntryRiskReward,
  isRiskRewardAcceptable,
  isRiskRewardBad,
  RR_ACCEPTABLE,
  selectRewardTarget,
  selectStopLevel,
} from "./risk-reward";

function buildBarsWithStructuralHigh(close: number, structuralHigh: number): {
  bars: Gate2BarInput[];
  idx: number;
} {
  const bars: Gate2BarInput[] = [];
  for (let i = 0; i < 55; i++) {
    const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const high = i < 45 ? structuralHigh : close * 0.98;
    bars.push(bar(dk, close * 0.95, high, close * 0.93, close * 0.96, 1e6));
  }
  const idx = bars.length - 1;
  bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), close * 0.99, close * 1.01, close * 0.97, close, 2e6);
  return { bars, idx };
}

describe("risk-reward Phase 3", () => {
  it("uses prior 60d high as structural target", () => {
    const close = 24;
    const { bars, idx } = buildBarsWithStructuralHigh(close, 28);
    const rr = computeEarlyEntryRiskReward(bars, idx);
    expect(rr.targetReason).toBe("prior_60d_high");
    expect(rr.targetPrice).toBe(28);
    expect(rr.riskRewardRatio).not.toBeNull();
  });

  it("uses resistance cluster when pivot highs cluster", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      let high = 22;
      if (i === 10 || i === 15 || i === 20) high = 26.1;
      if (i === 12 || i === 18) high = 26.0;
      bars.push(bar(dk, 21, high, 20.5, 21.5, 1e6));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 24, 24.5, 23.8, 24.2, 2e6);
    const candidates = collectResistanceCandidates(bars, idx, 24.2);
    const cluster = candidates.find((c) => c.reason === "resistance_cluster" || c.reason === "pivot_high");
    expect(cluster).toBeDefined();
    const { targetReason } = selectRewardTarget(candidates, 24.2, 0.5);
    expect(["resistance_cluster", "pivot_high", "prior_60d_high"]).toContain(targetReason);
  });

  it("selects the tightest (highest) valid stop candidate", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      bars.push(bar(dk, 22, 23, 21.5, 22.5, 1e6));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 24, 25, 23.5, 24.5, 2e6);
    for (let i = idx - 5; i <= idx; i++) {
      bars[i] = bar(bars[i]!.date.toISOString().slice(0, 10), 24, 24.5, 23.2, 24.2, 1e6);
    }
    const candidates = collectStopCandidates({
      bars,
      idx,
      close: 24.5,
      ma20: 23,
      ma50: 22,
      atr14: 0.8,
    });
    // Candidates here: swing_low ~21.29 (widest), reclaim_candle_low ~22.97
    // (the recent reclaim of ma20/ma50, tightest), ma20/ma50_failure ~22.5/21.6,
    // atr_stop_floor ~22.9 — selectStopLevel must pick the highest (tightest).
    const stop = selectStopLevel(candidates);
    expect(stop?.reason).toBe("reclaim_candle_low");
  });

  it("includes compression low in stop candidates", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      bars.push(bar(dk, 22, 22.05, 21.95, 22, 500_000));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 22, 22.8, 21.5, 22.6, 2_000_000);
    const candidates = collectStopCandidates({
      bars,
      idx,
      close: bars[idx]!.close,
      ma20: 22.1,
      ma50: 21.8,
      atr14: 0.15,
    });
    expect(candidates.some((c) => c.reason === "swing_low")).toBe(true);
    expect(candidates.some((c) => c.reason === "compression_low" || c.reason === "reclaim_candle_low")).toBe(true);
  });

  it("uses ATR floor when no meaningful structural resistance above", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      bars.push(bar(dk, 20, 20.15, 19.95, 20, 1e6));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 20, 20.2, 19.9, 20.05, 1e6);
    const rr = computeEarlyEntryRiskReward(bars, idx, 20, 19.5);
    expect(["atr_floor", "pct_floor"]).toContain(rr.targetReason);
  });

  it("BAD_RR rejection sets rrRejectionReason", () => {
    const close = 24;
    const { bars, idx } = buildBarsWithStructuralHigh(close, 25.2);
    const rr = computeEarlyEntryRiskReward(bars, idx);
    expect(isRiskRewardBad(rr.riskRewardRatio)).toBe(true);
    expect(rr.rrRejectionReason).not.toBeNull();
  });

  it("RR_ACCEPTABLE picks nearest resistance that clears threshold", () => {
    const close = 24;
    const stop = 23.2;
    const candidates = collectResistanceCandidates(
      buildBarsWithStructuralHigh(close, 32).bars,
      buildBarsWithStructuralHigh(close, 32).idx,
      close
    );
    const { targetPrice } = selectRewardTarget(candidates, close, 0.4, stop);
    const risk = close - stop;
    const reward = targetPrice - close;
    expect(reward / risk).toBeGreaterThanOrEqual(RR_ACCEPTABLE);
    expect(isRiskRewardAcceptable(reward / risk)).toBe(true);
  });

  it("reaches for the farther resistance only when the nearer one fails to clear RR_ACCEPTABLE off the selected (now tighter) stop", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) {
      const dk = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const high = i === 5 ? 30 : i === 25 ? 27 : 24;
      bars.push(bar(dk, 23, high, 22.5, 23.5, 1e6));
    }
    const idx = bars.length - 1;
    bars[idx] = bar(bars[idx]!.date.toISOString().slice(0, 10), 24, 24.5, 23.8, 24.2, 2e6);
    const rr = computeEarlyEntryRiskReward(bars, idx);
    // stopLevel is now the tightest candidate (swing_low ~22.275, risk ~1.93 off
    // close 24.2), so 27's reward (2.8) no longer clears RR_ACCEPTABLE (needs
    // >= ~3.85) — the algorithm correctly reaches to 30 (RR ~3.01) instead of
    // settling for a nearer level that doesn't justify the trade at 2:1.
    expect(rr.stopLevel).toBeCloseTo(22.275, 3);
    expect(rr.targetPrice).toBe(30);
    expect(rr.riskRewardRatio).toBeGreaterThanOrEqual(RR_ACCEPTABLE);
  });
});
