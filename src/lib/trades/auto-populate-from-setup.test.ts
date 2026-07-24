import { describe, expect, it } from "vitest";
import { deriveAutoPopulatedTradeLevels, type SetupLevelsInput } from "./auto-populate-from-setup";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { utcDayKey } from "@/lib/scanner/early-entry/bar-metrics";

function bar(dayIndex: number, open: number, high: number, low: number, close: number, volume = 1_000_000): Gate2BarInput {
  const unixSec = 1_700_000_000 + dayIndex * 86_400;
  return { date: new Date(unixSec * 1000), open, high, low, close, volume };
}

/**
 * 65 quiet bars (index 0-64) around 100, with a single spike high (115) at
 * index 30 so it becomes a `prior_60d_high` resistance candidate for the
 * setup bar at index 64 (close=100). Last-bar high/low is a tight ±0.5 band
 * so entry-range-tightening tests have a small, predictable true range.
 */
function baselineBars(): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  for (let i = 0; i <= 64; i++) {
    if (i === 30) {
      out.push(bar(i, 100, 115, 99, 101));
    } else if (i === 64) {
      out.push(bar(i, 100, 100.5, 99.5, 100));
    } else {
      out.push(bar(i, 100, 100.5, 99.5, 100));
    }
  }
  return out;
}

function baseSetup(overrides: Partial<SetupLevelsInput> = {}): SetupLevelsInput {
  const bars = baselineBars();
  return {
    symbolId: "sym-1",
    close: 100,
    breakoutLevel: 100,
    pullbackZoneLow: 90,
    pullbackZoneHigh: 100,
    stopLevel: 95,
    barDate: bars[64]!.date,
    ...overrides,
  };
}

describe("deriveAutoPopulatedTradeLevels", () => {
  it("anchors take-profit to the given stopLevel using structural resistance, and R:R to the suggested entry (not the raw close)", () => {
    const result = deriveAutoPopulatedTradeLevels(baseSetup(), baselineBars());
    expect(result).not.toBeNull();
    expect(result!.stopLoss).toBe(95);
    expect(result!.takeProfit).toBeCloseTo(115, 5);
    expect(result!.targetReason).toBe("prior_60d_high");
    // Zone [90,100] tightens to [99.5,100] (see the tightening test below) -> suggestedEntry=99.75,
    // so R:R = (115-99.75)/(99.75-95) = 15.25/4.75, NOT (115-100)/(100-95)=3 off the raw close.
    expect(result!.suggestedEntry).toBeCloseTo(99.75, 5);
    expect(result!.riskRewardRatio).toBeCloseTo(15.25 / 4.75, 5);
  });

  it("tightens a pullback zone that's much wider than the prior session's true range", () => {
    const result = deriveAutoPopulatedTradeLevels(baseSetup(), baselineBars());
    expect(result).not.toBeNull();
    // Zone was [90, 100] (width 10); last bar true range is 1 (99.5-100.5) — tightened
    // around the boundary closest to close (100 == pullbackZoneHigh), not the full box.
    expect(result!.entryRangeHigh).toBeLessThanOrEqual(100);
    expect(result!.entryRangeLow).toBeGreaterThan(90);
    expect(result!.entryRangeHigh - result!.entryRangeLow).toBeLessThan(10);
    expect(result!.suggestedEntry).toBeGreaterThan(90);
    expect(result!.suggestedEntry).toBeLessThanOrEqual(100);
  });

  it("keeps the full pullback zone when it's already narrow relative to true range", () => {
    const narrowZoneSetup = baseSetup({ pullbackZoneLow: 99, pullbackZoneHigh: 100 });
    const result = deriveAutoPopulatedTradeLevels(narrowZoneSetup, baselineBars());
    expect(result).not.toBeNull();
    expect(result!.entryRangeLow).toBe(99);
    expect(result!.entryRangeHigh).toBe(100);
    // suggestedEntry = 99.5 here (not close=100) -> R:R must anchor to that, not to setup.close.
    expect(result!.suggestedEntry).toBe(99.5);
    expect(result!.riskRewardRatio).toBeCloseTo((115 - 99.5) / (99.5 - 95), 5);
  });

  it("returns null when there isn't enough bar history", () => {
    const shortBars = baselineBars().slice(-30);
    const setup = baseSetup({ barDate: shortBars[shortBars.length - 1]!.date });
    const result = deriveAutoPopulatedTradeLevels(setup, shortBars);
    expect(result).toBeNull();
  });

  it("ignores bars after the setup's barDate (no future leakage)", () => {
    const bars = baselineBars();
    // A much bigger spike after the setup's own session — must not affect the result.
    const withFuture = [...bars, bar(70, 100, 500, 100, 100)];
    const result = deriveAutoPopulatedTradeLevels(baseSetup(), withFuture);
    expect(result).not.toBeNull();
    expect(result!.takeProfit).toBeCloseTo(115, 5);
    // asOfBarDate comes back UTC-midnight-normalized (sortDedupeGate2Bars normalizes all
    // bar dates before processing), so compare calendar day rather than the exact instant.
    expect(utcDayKey(result!.asOfBarDate)).toBe(utcDayKey(bars[64]!.date));
  });
});
