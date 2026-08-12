import { describe, expect, it } from "vitest";
import { runReplay, type SymbolSeries } from "./replay-engine";
import type { TradeBar } from "./trade-model";

/**
 * End-to-end proof that a replay decision at T is unaffected by anything after T.
 *
 * The guard tests prove the guard works on inputs already split by hand. That is
 * not the same claim: it leaves open whether `runReplay` routes the right bars to
 * the right channel. So this suite runs the ENGINE twice over the same history —
 * once truncated at T, once with the post-T half replaced by absurd values — and
 * requires the decisions to be identical.
 *
 * If any decision path read future BAR VALUES, the poisoned run would surface
 * different signals, so identical signals across the two runs rules that class
 * out.
 *
 * What this does NOT prove, so it is not claimed elsewhere:
 *   - Post-T dates and bar COUNTS are preserved by the poisoning, so a leak that
 *     keys on the existence or length of future history would survive it.
 *   - `tactical` is empty here, so current-state fields on tactical rows
 *     (`status`, `activeForScanner`) are never exercised.
 *   - The universe is a closed synthetic set, so it says nothing about the
 *     runner seeding from today's symbol roster.
 * Those are properties of the runner and the data, not of `runReplay`, and are
 * reported as limitations of the baseline rather than tested away here.
 */

const DAY = 86_400_000;

function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * A price path that genuinely produces breakout-pullback setups.
 *
 * Tiles the shape the repo's own Gate 2 fixture uses (base, breakout, shallow
 * digestion, retouch on volume) so several sessions across the history qualify.
 * A synthetic random walk does not clear Gate 2, and a fixture that surfaces
 * nothing would make the poisoned-vs-truncated comparison vacuously true.
 */
function buildRealisticPath(days: number, seed: number): TradeBar[] {
  const BASE = 200 + (seed % 7);
  const V = 1_000_000;
  const out: TradeBar[] = [];
  let t = Date.parse("2020-01-01T00:00:00.000Z");
  const push = (o: number, h: number, l: number, c: number, v: number) => {
    out.push({ date: new Date(t), open: o, high: h, low: l, close: c, volume: v });
    t += DAY;
  };
  for (let i = 0; i < days; i++) {
    const k = i % 70;
    if (k < 59) push(BASE, BASE, BASE - 1, BASE - 1, V);
    else if (k === 59) push(BASE, BASE + 2, BASE, BASE + 1, V);
    else if (k === 60) push(BASE + 1, BASE + 1, BASE - 3, BASE + 0.5, V);
    else if (k < 68) push(BASE, BASE + 0.6, BASE - 0.2, BASE, V);
    else if (k === 68) push(BASE, BASE + 0.6, BASE - 0.2, BASE + 0.5, V);
    else push(BASE + 5, BASE + 7, BASE - 1, BASE + 6, V * 2);
  }
  return out;
}

/** Replace every bar strictly after `cutoffMs` with wildly wrong values. */
function poisonAfter(bars: readonly TradeBar[], cutoffMs: number): TradeBar[] {
  return bars.map((b) =>
    b.date.getTime() > cutoffMs
      ? {
          date: b.date,
          open: 500_000,
          high: 900_000,
          low: 400_000,
          close: 800_000,
          volume: 9_999_999_999,
        }
      : b
  );
}

function truncateAt(bars: readonly TradeBar[], cutoffMs: number): TradeBar[] {
  return bars.filter((b) => b.date.getTime() <= cutoffMs);
}

function makeSeries(count: number, days: number): SymbolSeries[] {
  return Array.from({ length: count }, (_, i) => ({
    symbolId: `id-${i}`,
    symbol: `SY${String(i).padStart(2, "0")}`,
    bars: buildRealisticPath(days, i + 1),
  }));
}

/**
 * VNINDEX path that spends time in every Gate 1 regime, so surfacing is exercised
 * rather than pinned to one branch.
 */
function buildIndex(days: number): TradeBar[] {
  const bars: TradeBar[] = [];
  let v = 1000;
  let t = Date.parse("2020-01-01T00:00:00.000Z");
  for (let i = 0; i < days; i++) {
    v *= 1 + Math.sin(i / 23) * 0.004 + 0.0004;
    bars.push({ date: new Date(t), open: v, high: v * 1.004, low: v * 0.996, close: v, volume: 1e8 });
    t += DAY;
  }
  return bars;
}

describe("runReplay — the future cannot reach a decision", () => {
  const DAYS = 420;
  const series = makeSeries(6, DAYS);
  const indexBars = buildIndex(DAYS);
  // Cut two-thirds in, leaving a long poisoned tail and enough forward bars that
  // trades would still be scorable if the engine were reading them for decisions.
  const cutoffMs = indexBars[Math.floor(DAYS * 0.66)]!.date.getTime();
  const cutoff = iso(cutoffMs);

  it("produces the same decisions whether the future is poisoned or absent", () => {
    const truncated = runReplay({
      series: series.map((s) => ({ ...s, bars: truncateAt(s.bars, cutoffMs) })),
      indexBars: truncateAt(indexBars, cutoffMs),
      tactical: [],
      options: { maxSessionDate: cutoff, progressEvery: 1e9 },
    });

    const poisoned = runReplay({
      series: series.map((s) => ({ ...s, bars: poisonAfter(s.bars, cutoffMs) })),
      indexBars: poisonAfter(indexBars, cutoffMs),
      tactical: [],
      options: { maxSessionDate: cutoff, progressEvery: 1e9 },
    });

    expect(truncated.guardViolations).toBe(0);
    expect(poisoned.guardViolations).toBe(0);

    // The decision surface: which symbol was surfaced, on which session, at what
    // tier and regime. Trade outcomes legitimately differ — the poisoned run
    // scores against poisoned future bars — so they are excluded here.
    const decisions = (r: typeof truncated) =>
      r.signals.map((s) => `${s.sessionDate}|${s.symbol}|${s.quality}|${s.gate1Level}|${s.rankScore.toFixed(4)}`);

    expect(decisions(poisoned)).toEqual(decisions(truncated));
    expect(poisoned.universeSizeBySession).toEqual(truncated.universeSizeBySession);
  });

  it("actually exercised the strategy — otherwise the comparison proves nothing", () => {
    // A run that surfaced nothing would trivially match. Guard against a fixture
    // that silently stops testing anything.
    const r = runReplay({
      series,
      indexBars,
      tactical: [],
      options: { maxSessionDate: cutoff, progressEvery: 1e9 },
    });
    expect(r.sessionsEvaluated).toBeGreaterThan(100);
    expect(r.universeSizeBySession.some((u) => u.tradable > 0)).toBe(true);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it("scores trades only from bars strictly after the signal session", () => {
    const r = runReplay({ series, indexBars, tactical: [], options: { progressEvery: 1e9 } });
    const scored = r.signals.filter((s) => s.trade);
    expect(scored.length).toBeGreaterThan(0);
    for (const s of scored) {
      expect(s.trade!.entryDate > s.sessionDate).toBe(true);
      expect(s.trade!.exitDate >= s.trade!.entryDate).toBe(true);
    }
  });

  it("leaves v1 byte-identical when the executable stop floor is off", () => {
    // The floor is opt-in. If merely adding the option moved the baseline, every
    // v1-vs-v2 comparison would be measuring the plumbing.
    const base = { series, indexBars, tactical: [], options: { progressEvery: 1e9 } };
    const a = runReplay(base);
    const b = runReplay({ ...base, options: { progressEvery: 1e9, applyExecutableStopFloor: false } });
    expect(b.signals.map((s) => `${s.sessionDate}|${s.symbol}`)).toEqual(
      a.signals.map((s) => `${s.sessionDate}|${s.symbol}`)
    );
    expect(a.stopFloorRejections).toBe(0);
  });

  it("computes the stop floor without reading past the decision session", () => {
    // The floor needs ATR, which is the one new decision-time input. If it were
    // taken from the full series instead of the bounded window, the poisoned run
    // would reject a different set of candidates and the counts would diverge.
    const withFloor = { tactical: [], options: { maxSessionDate: cutoff, progressEvery: 1e9, applyExecutableStopFloor: true } };
    const truncated = runReplay({
      ...withFloor,
      series: series.map((s) => ({ ...s, bars: truncateAt(s.bars, cutoffMs) })),
      indexBars: truncateAt(indexBars, cutoffMs),
    });
    const poisoned = runReplay({
      ...withFloor,
      series: series.map((s) => ({ ...s, bars: poisonAfter(s.bars, cutoffMs) })),
      indexBars: poisonAfter(indexBars, cutoffMs),
    });
    expect(poisoned.guardViolations).toBe(0);
    expect(poisoned.stopFloorRejections).toBe(truncated.stopFloorRejections);
    expect(poisoned.signals.map((s) => `${s.sessionDate}|${s.symbol}`)).toEqual(
      truncated.signals.map((s) => `${s.sessionDate}|${s.symbol}`)
    );
  });

  it("refuses unsorted input rather than silently mis-slicing it", () => {
    // The binary search would return an arbitrary index on unsorted bars, and the
    // "through T" window could then contain future rows.
    const scrambled = series.map((s, i) =>
      i === 0 ? { ...s, bars: [...s.bars].reverse() } : s
    );
    expect(() =>
      runReplay({ series: scrambled, indexBars, tactical: [], options: { progressEvery: 1e9 } })
    ).toThrow(/not ascending/);
  });
});
