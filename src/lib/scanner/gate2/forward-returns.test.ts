import { describe, expect, it } from "vitest";
import { computeForwardReturnLabels } from "./forward-returns";
import type { Gate2BarInput } from "./types";

function bar(day: string, close: number, high = close, low = close): Gate2BarInput {
  const [y, m, d] = day.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    open: close,
    high,
    low,
    close,
    volume: 1_000_000,
  };
}

function ascendingCloses(startDay: string, count: number, startClose: number, step: number): Gate2BarInput[] {
  const [y, m, d] = startDay.split("-").map(Number);
  let t = Date.UTC(y!, m! - 1, d!);
  const out: Gate2BarInput[] = [];
  for (let i = 0; i < count; i++) {
    const c = startClose + i * step;
    out.push({
      date: new Date(t),
      open: c,
      high: c,
      low: c,
      close: c,
      volume: 1_000_000,
    });
    t += 86400000;
  }
  return out;
}

describe("computeForwardReturnLabels", () => {
  it("computes 5/10/20 session forward returns from evaluation close", () => {
    const bars = ascendingCloses("2026-01-01", 40, 100, 1);
    const evalDate = bars[10]!.date;
    const labels = computeForwardReturnLabels(bars, evalDate)!;
    expect(labels.entryClose).toBe(110);
    expect(labels.forwardReturnPct[5]).toBeCloseTo(((115 / 110) - 1) * 100, 5);
    expect(labels.forwardReturnPct[10]).toBeCloseTo(((120 / 110) - 1) * 100, 5);
    expect(labels.forwardReturnPct[20]).toBeCloseTo(((130 / 110) - 1) * 100, 5);
  });

  it("returns null horizons when insufficient future bars", () => {
    const bars = ascendingCloses("2026-01-01", 16, 100, 1);
    const evalDate = bars[5]!.date;
    const labels = computeForwardReturnLabels(bars, evalDate)!;
    expect(labels.forwardReturnPct[5]).not.toBeNull();
    expect(labels.forwardReturnPct[20]).toBeNull();
    expect(labels.maxFavorableExcursion20Pct).toBeNull();
  });

  it("computes max favorable and adverse excursion over 20 sessions", () => {
    const base = ascendingCloses("2026-01-01", 30, 100, 1);
    const bars = base.map((b, i) => {
      const session = i - 5;
      const spikeHigh = session > 5 && session <= 15 ? 10 : 0;
      const dipLow = session > 10 && session <= 13 ? 8 : 0;
      return {
        ...b,
        high: b.close + spikeHigh,
        low: b.close - dipLow,
      };
    });
    const evalDate = bars[5]!.date;
    const labels = computeForwardReturnLabels(bars, evalDate)!;
    expect(labels.maxFavorableExcursion20Pct).not.toBeNull();
    expect(labels.maxAdverseExcursion20Pct).not.toBeNull();
    expect(labels.maxFavorableExcursion20Pct!).toBeGreaterThan(labels.maxAdverseExcursion20Pct!);
  });

  it("hit +5% before -3% when gain day occurs first", () => {
    const entry = 100;
    const evalDay = "2026-01-01";
    const bars: Gate2BarInput[] = [bar(evalDay, entry)];
    for (let i = 1; i <= 20; i++) {
      const day = `2026-01-${String(i + 1).padStart(2, "0")}`;
      if (i === 3) {
        bars.push(bar(day, entry, entry * 1.06, entry));
      } else if (i === 10) {
        bars.push(bar(day, entry, entry, entry * 0.96));
      } else {
        bars.push(bar(day, entry));
      }
    }
    const labels = computeForwardReturnLabels(bars, bars[0]!.date)!;
    expect(labels.hitPlus5BeforeMinus3).toBe(true);
  });

  it("hit +5% before -3% is false when -3% comes first", () => {
    const entry = 100;
    const bars: Gate2BarInput[] = [bar("2026-01-01", entry)];
    for (let i = 1; i <= 20; i++) {
      const day = `2026-01-${String(i + 1).padStart(2, "0")}`;
      if (i === 2) {
        bars.push(bar(day, entry, entry, entry * 0.96));
      } else if (i === 8) {
        bars.push(bar(day, entry, entry * 1.06, entry));
      } else {
        bars.push(bar(day, entry));
      }
    }
    const labels = computeForwardReturnLabels(bars, bars[0]!.date)!;
    expect(labels.hitPlus5BeforeMinus3).toBe(false);
  });

  it("returns null when evaluation session missing", () => {
    const bars = ascendingCloses("2026-01-01", 25, 100, 1);
    expect(computeForwardReturnLabels(bars, new Date(Date.UTC(2026, 5, 1)))).toBeNull();
  });
});
