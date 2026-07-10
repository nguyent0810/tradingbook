import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  computeAtr14,
  computeMaAtIndex,
  volumeMa20AtIndex,
} from "@/lib/scanner/early-entry/bar-metrics";
import { evaluateEarlyEntrySession } from "@/lib/scanner/early-entry/evaluate-early-entry";
import {
  rawRangeHighLow,
  utcDayDiff,
} from "@/lib/paper-lab/context/build-market-context-bundle";

/**
 * Phase 0 bundle enrichment. These tests pin the deterministic math the market
 * context bundle now uses to populate ma20/ma50/atr14/range20d/volume-ratio and
 * holdingDays, plus the null-safety of the wired early-entry evaluator.
 */

/** Deterministic synthetic series: close = 100 + i, ±1 range, flat volume. */
function buildBars(count: number, lastVolume = 1000): Gate2BarInput[] {
  const base = Date.UTC(2026, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i;
    return {
      date: new Date(base + i * 86_400_000),
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: i === count - 1 ? lastVolume : 1000,
    };
  });
}

describe("utcDayDiff (holdingDays)", () => {
  it("counts whole UTC days between openedAt and the session", () => {
    const opened = new Date(Date.UTC(2026, 6, 1));
    const session = new Date(Date.UTC(2026, 6, 8));
    expect(utcDayDiff(session, opened)).toBe(7);
  });

  it("returns 0 for a same-day position", () => {
    const d = new Date(Date.UTC(2026, 6, 8, 9, 30));
    expect(utcDayDiff(d, new Date(Date.UTC(2026, 6, 8)))).toBe(0);
  });

  it("floors at 0 when openedAt is after the session", () => {
    const opened = new Date(Date.UTC(2026, 6, 9));
    const session = new Date(Date.UTC(2026, 6, 8));
    expect(utcDayDiff(session, opened)).toBe(0);
  });
});

describe("rawRangeHighLow (range20dHigh/Low)", () => {
  it("returns raw 20-session high/low from bars (not gate2 levels)", () => {
    const bars = buildBars(60);
    const { high, low } = rawRangeHighLow(bars, 59, 20);
    // window = bars[40..59]; highs 141..160, lows 139..158
    expect(high).toBe(160);
    expect(low).toBe(139);
  });

  it("is null-safe on an empty series", () => {
    expect(rawRangeHighLow([], 0, 20)).toEqual({ high: null, low: null });
  });
});

describe("indicator helpers used by the bundle", () => {
  const bars = buildBars(60, 2000);

  it("computes ma20 and ma50 at the evaluation index", () => {
    const { ma20, ma50 } = computeMaAtIndex(bars, 59);
    expect(ma20).toBeCloseTo(149.5); // mean of closes 140..159
    expect(ma50).toBeCloseTo(134.5); // mean of closes 110..159
  });

  it("computes atr14", () => {
    expect(computeAtr14(bars, 59)).toBeCloseTo(2); // constant true range of 2
  });

  it("returns null MA/ATR when there are too few bars", () => {
    const few = buildBars(10);
    expect(computeAtr14(few, 9)).toBeNull();
    expect(computeMaAtIndex(few, 9).ma20).toBeNull();
    expect(computeMaAtIndex(few, 9).ma50).toBeNull();
  });

  it("computes a volume MA20 fallback and volume ratio", () => {
    const volMa20 = volumeMa20AtIndex(bars, 59);
    expect(volMa20).toBe(1000); // prior 20 sessions all 1000
    const evalVolume = bars[59]!.volume; // 2000
    const volRatio = volMa20 && volMa20 > 0 ? evalVolume / volMa20 : null;
    expect(volRatio).toBe(2);
  });
});

describe("early-entry evaluator wiring (null-safe)", () => {
  it("returns null when there are fewer than 50 bars", () => {
    const bars = buildBars(30);
    const result = evaluateEarlyEntrySession({
      stockBars: bars,
      indexBars: bars,
      sessionDate: bars[bars.length - 1]!.date,
    });
    expect(result).toBeNull();
  });

  it("returns a metrics-bearing result when enough history exists", () => {
    const bars = buildBars(60);
    const result = evaluateEarlyEntrySession({
      stockBars: bars,
      indexBars: bars,
      sessionDate: bars[bars.length - 1]!.date,
    });
    expect(result).not.toBeNull();
    expect(result?.metrics).toBeDefined();
  });
});
