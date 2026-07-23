import { describe, expect, it } from "vitest";
import {
  computeGate2RankBreakdown,
  formatGate2RankBreakdownLines,
} from "./rank-components";
import { computeGate2RankScore } from "./breakout-pullback";
import { evaluateWatchHealth, computeAtr14 } from "@/lib/setup-health/evaluate-watch-health";
import type { OhlcvBar } from "@/lib/setup-health/types";

describe("computeGate2RankBreakdown", () => {
  const params = {
    volRatio: 2.1,
    close: 210,
    breakoutLevel: 200,
    ma50: 190,
    minLowSinceBreakout: 198,
  };

  it("matches legacy computeGate2RankScore exactly", () => {
    const breakdown = computeGate2RankBreakdown(params);
    const legacy = computeGate2RankScore(params);
    expect(breakdown.rankScore).toBe(legacy);
  });

  it("reconciles rankScore from component sum", () => {
    const b = computeGate2RankBreakdown(params);
    const sum = b.volumeTerm + b.extensionTerm + b.maDistanceTerm - b.depthPenalty;
    expect(b.rankScore).toBe(sum);
  });

  it("formats human-readable breakdown lines", () => {
    const b = computeGate2RankBreakdown(params);
    const lines = formatGate2RankBreakdownLines(b);
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/Điểm xếp hạng/);
    expect(lines[1]).toMatch(/Đầu vào:/);
  });
});

describe("computeGate2RankBreakdown — extension reward curve (reconciles F05)", () => {
  function withExtension(extPct: number) {
    const breakoutLevel = 100;
    const close = breakoutLevel * (1 + extPct / 100);
    // ma50 = close and minLowSinceBreakout = breakoutLevel hold maDistanceTerm and
    // depthPenalty at exactly 0 for every call, isolating extension as the only variable.
    return computeGate2RankBreakdown({
      volRatio: 2.0,
      breakoutLevel,
      close,
      ma50: close,
      minLowSinceBreakout: breakoutLevel,
    });
  }

  it("rewards extension 1:1 up to the healthy ceiling (matches setup-health's EXTENDED_PCT=5%)", () => {
    const at1pct = withExtension(1);
    const at5pct = withExtension(5);
    expect(at1pct.extensionTerm).toBeCloseTo(100, 6);
    expect(at5pct.extensionTerm).toBeCloseTo(500, 6);
  });

  it("no longer rewards extension past the healthy ceiling — 8% ranks below 5%, not above it", () => {
    const at5pct = withExtension(5);
    const at8pct = withExtension(8);
    // Old formula: 8% > 5% would always score higher (monotonic reward).
    // New formula: 8% is past the healthy ceiling and decaying toward CHASE_PCT (12%).
    expect(at8pct.extensionTerm).toBeLessThan(at5pct.extensionTerm);
    expect(at8pct.rankScore).toBeLessThan(at5pct.rankScore);
  });

  it("extension reward hits zero at/after CHASE_PCT (12%) — fully chased earns no rank bonus", () => {
    const atChase = withExtension(12);
    const pastChase = withExtension(20);
    expect(atChase.extensionTerm).toBeCloseTo(0, 6);
    expect(pastChase.extensionTerm).toBeCloseTo(0, 6);
  });

  it("two stocks identical except extension: the rank gap shrinks sharply once past the healthy ceiling", () => {
    // Stock A: 1% above breakout (near-fresh breakout). Stock B: 8% above breakout (past healthy ceiling).
    // Audited old formula (docs/audits/trading-algorithm-audit.md F05): rankScore gap was +700 in B's favor
    // (2950 vs 2250), purely from unbounded extension reward. New curve narrows this to ~186.
    const stockA = withExtension(1);
    const stockB = withExtension(8);
    const gap = stockB.rankScore - stockA.rankScore;
    expect(gap).toBeGreaterThan(0); // B still ranks above A — the curve decays, it doesn't invert
    expect(gap).toBeLessThan(200); // but nowhere near the old +700 gap
  });
});

describe("ATR vs flat threshold divergence (PARTIAL reconciliation only — see rank-components.ts comment on extensionRewardPct)", () => {
  // Both stocks: identical 6% raw extension above a breakout/pullback-zone-high
  // of 100 (close 106), identical 15-bar ramp shape (closes step up 0.4/day so
  // no single day's true range is inflated by the move itself), differing only
  // in daily range -> ATR%. firstSeenBarDate pinned to the eval bar so
  // AGING_SETUP never fires, isolating the extension flag as the only variable.
  function rampBars(halfRange: number): OhlcvBar[] {
    return Array.from({ length: 15 }, (_, i) => {
      const close = 100 + 0.4 * (i + 1); // ends at 106 on bar 15
      return {
        date: new Date(`2026-03-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`),
        open: close,
        high: close + halfRange,
        low: close - halfRange,
        close,
        volume: 1_000_000,
      };
    });
  }

  function health(halfRange: number) {
    const bars = rampBars(halfRange);
    const evalBarDate = bars[bars.length - 1]!.date;
    return evaluateWatchHealth({
      breakoutLevel: 100,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 100,
      firstSeenBarDate: evalBarDate,
      evalBarDate,
      barsAscThroughEval: bars,
    });
  }

  const rank6pct = computeGate2RankBreakdown({
    volRatio: 2,
    close: 106,
    breakoutLevel: 100,
    ma50: 106,
    minLowSinceBreakout: 100,
  });

  it("low-vol stock (ATR% ~0.94%): health calls the SAME 6% move a CHASE (DEAD) while rank's flat-threshold reward is still ~86% of max", () => {
    const bars = rampBars(0.5); // high-low=1 -> ATR14=1 -> atrPct ≈ 0.9434%
    expect(computeAtr14(bars)! / 106).toBeCloseTo(0.009434, 5);

    const h = health(0.5);
    expect(h.flags).toEqual(["CHASE"]);
    expect(h.level).toBe("DEAD");
    expect(h.meta.extensionThresholdSource).toBe("atr");

    // Rank's flat curve doesn't know this stock is low-vol: it still hands out
    // ~86% of the max extension reward for the exact same 6% move.
    expect(rank6pct.extensionTerm).toBeCloseTo(428.57, 1);
    expect(rank6pct.extensionTerm / 500).toBeGreaterThan(0.8);
  });

  it("high-vol stock (ATR% ~4.5%): health calls the SAME 6% move perfectly HEALTHY (no extension flag) while rank's flat-threshold reward is already decayed to the same ~86% of max", () => {
    const bars = rampBars(2.385); // high-low=4.77 -> ATR14=4.77 -> atrPct = 4.5%
    expect(computeAtr14(bars)! / 106).toBeCloseTo(0.045, 5);

    const h = health(2.385);
    expect(h.flags).toEqual([]);
    expect(h.level).toBe("HEALTHY");
    expect(h.meta.extensionThresholdSource).toBe("atr");
    expect(h.meta.extendedPct).toBeNull(); // no extension tier tripped at all

    // Same flat-threshold rank result as the low-vol case above, even though
    // health considers this stock's 6% move entirely unremarkable.
    expect(rank6pct.extensionTerm).toBeCloseTo(428.57, 1);
    expect(rank6pct.extensionTerm / 500).toBeGreaterThan(0.8);
  });
});
