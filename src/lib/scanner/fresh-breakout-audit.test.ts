import { describe, expect, it } from "vitest";
import {
  classifyFreshBreakout,
  computeFreshBreakoutMetrics,
} from "@/lib/scanner/fresh-breakout-audit";

function makeBars(closes: number[], volume = 1_000_000): Array<{
  date: Date;
  close: number;
  volume: number;
}> {
  return closes.map((close, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)),
    close,
    volume: volume + i * 10_000,
  }));
}

describe("fresh breakout audit helpers", () => {
  it("computes breakout metrics from latest bar", () => {
    const closes = Array.from({ length: 24 }, (_, i) => 10 + i * 0.2);
    const bars = makeBars([...closes, 20]);
    const latest = bars[bars.length - 1]!.date;

    const metrics = computeFreshBreakoutMetrics({
      bars,
      expectedLatestSession: latest,
      breakoutLookbackDays: 20,
    });

    expect(metrics).not.toBeNull();
    expect(metrics?.closeAbovePriorNDayHigh).toBe(true);
    expect(metrics?.priorNDayHigh).not.toBeNull();
  });

  it("classifies momentum ignition and adds extension/no-pullback risks", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 20 + i * 0.1);
    const bars = [...makeBars(closes, 1_000_000), {
      date: new Date(Date.UTC(2026, 0, 1 + closes.length)),
      close: 30,
      volume: 5_000_000,
    }];
    const latest = bars[bars.length - 1]!.date;
    const metrics = computeFreshBreakoutMetrics({
      bars,
      expectedLatestSession: latest,
      breakoutLookbackDays: 20,
    });
    expect(metrics).not.toBeNull();
    const tradability = { passed: true, reasons: [] };

    const out = classifyFreshBreakout({
      metrics: metrics!,
      tradability,
      recentBars: bars,
    });

    expect(out.labels).toContain("FRESH_BREAKOUT");
    expect(out.labels).toContain("MOMENTUM_IGNITION");
    expect(out.riskAnnotations).toContain("NO_PULLBACK");
  });

  it("marks low liquidity and stale risks", () => {
    const bars = makeBars(Array.from({ length: 130 }, (_, i) => 15 + i * 0.02), 50_000);
    const expectedLatestSession = new Date(Date.UTC(2026, 10, 1));
    const metrics = computeFreshBreakoutMetrics({
      bars,
      expectedLatestSession,
      breakoutLookbackDays: 20,
    });
    expect(metrics).not.toBeNull();

    const out = classifyFreshBreakout({
      metrics: metrics!,
      tradability: { passed: false, reasons: ["20D average volume below 100,000 shares"] },
      recentBars: bars,
    });

    expect(out.riskAnnotations).toContain("LOW_LIQUIDITY");
    expect(out.riskAnnotations).toContain("STALE_DATA");
  });
});
