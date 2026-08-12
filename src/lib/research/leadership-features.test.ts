import { describe, expect, it } from "vitest";
import {
  computeAbsorptionProxy,
  computeRsInflection,
  computeStructureRecovery,
  detectUndercutReclaim,
  rollingMean,
  type Bars,
} from "./leadership-features";
import { classifyMarketState, computeBreadth, marketPhase } from "./market-state";
import { computeRelativeReturnAtSession } from "../scanner/gate2/relative-strength";
import type { Gate2BarInput } from "../scanner/gate2/types";

const DAY = 86_400_000;

/** Deterministic wiggly path; no randomness so failures are reproducible. */
function path(n: number, seed: number, drift = 0.0004): Bars {
  const out: Bars = [];
  let p = 100 + seed;
  let t = Date.parse("2019-01-01T00:00:00.000Z");
  for (let i = 0; i < n; i++) {
    p *= 1 + drift + Math.sin((i + seed) / 11) * 0.012 + Math.cos((i + seed) / 4.3) * 0.006;
    const o = p * (1 + Math.sin(i / 3) * 0.003);
    const h = Math.max(o, p) * 1.008;
    const l = Math.min(o, p) * 0.991;
    out.push({ date: new Date(t), open: o, high: h, low: l, close: p, volume: 500_000 + ((i * 7919) % 400_000) });
    t += DAY;
  }
  return out;
}

describe("point-in-time — a feature at T must not move when the future is deleted", () => {
  // This is the same standard the replay engine is held to. Every feature takes
  // full arrays plus an end index; if any of them read past `end`, truncating
  // the input would change the answer.
  const full = path(400, 3);
  const idx = path(400, 1, 0.0002).map((b) => b.close);
  const END = 300;
  const truncated = full.slice(0, END + 1);
  const idxTrunc = idx.slice(0, END + 1);

  const closes = full.map((b) => b.close);
  const closesT = truncated.map((b) => b.close);

  it("rollingMean", () => {
    expect(rollingMean(closesT, 50)[END]).toBe(rollingMean(closes, 50)[END]);
  });

  it("computeRsInflection", () => {
    expect(computeRsInflection(closesT, idxTrunc, END, 20, 50)).toEqual(
      computeRsInflection(closes, idx, END, 20, 50)
    );
  });

  it("detectUndercutReclaim", () => {
    expect(detectUndercutReclaim(truncated, END, 20, 5)).toEqual(detectUndercutReclaim(full, END, 20, 5));
  });

  it("computeAbsorptionProxy", () => {
    expect(computeAbsorptionProxy(truncated, END, 20, END - 3)).toEqual(
      computeAbsorptionProxy(full, END, 20, END - 3)
    );
  });

  it("computeStructureRecovery", () => {
    const args = (b: Bars) =>
      [b, END, rollingMean(b.map((x) => x.close), 10), rollingMean(b.map((x) => x.close), 20), rollingMean(b.map((x) => x.close), 50), 20, 0.01, 2] as const;
    expect(computeStructureRecovery(...args(truncated))).toEqual(computeStructureRecovery(...args(full)));
  });

  it("holds at many different end indices, not just one lucky one", () => {
    for (const e of [120, 180, 250, 333, 399]) {
      const t = full.slice(0, e + 1);
      expect(computeRsInflection(t.map((b) => b.close), idx.slice(0, e + 1), e, 20, 50)).toEqual(
        computeRsInflection(closes, idx, e, 20, 50)
      );
      expect(detectUndercutReclaim(t, e, 20, 5)).toEqual(detectUndercutReclaim(full, e, 20, 5));
    }
  });
});

describe("computeRsInflection", () => {
  it("matches the repo's own relative-return definition", () => {
    // The fast path recomputes RS from arrays for speed; it must agree with
    // `computeRelativeReturnAtSession`, or this study is measuring a different
    // quantity than the rest of the codebase.
    const stock = path(200, 5);
    const index = path(200, 2, 0.0002);
    const END = 150;
    const toG2 = (b: Bars): Gate2BarInput[] => b as unknown as Gate2BarInput[];
    const repo = computeRelativeReturnAtSession(toG2(stock), toG2(index), stock[END]!.date, 20);
    const mine = computeRsInflection(
      stock.map((b) => b.close),
      index.map((b) => b.close),
      END,
      20,
      50
    );
    expect(mine.rs20).toBeCloseTo(repo!.rsSpreadPct, 9);
  });

  it("separates improving-from-behind from already-strong", () => {
    // The hypothesis is about the first shape. The RS audit found the top RS
    // quintile has the WORST forward return, so conflating them would test the
    // thing already known not to work.
    const idx = Array.from({ length: 60 }, (_, i) => 100 * 1.002 ** i);
    // Lags by a steady 0.4%/session, then merely STOPS lagging for the last
    // five. Over 20 sessions it is still behind, but less so than it was five
    // sessions ago — negative level, positive slope.
    const lagging = idx.map((v, i) => v * (1 - 0.004 * Math.min(i, 55)));
    const r = computeRsInflection(lagging, idx, 59, 20, 50);
    expect(r.rs20).toBeLessThan(0);
    expect(r.rs20Delta5).toBeGreaterThan(0);
    expect(r.earlyRsImproving).toBe(true);
    expect(r.alreadyExtendedRs).toBe(false);
  });

  it("counts consecutive outperformance, and stops at the first miss", () => {
    const idx = [100, 101, 102, 103, 104];
    const stk = [100, 102, 104, 104.1, 107];
    expect(computeRsInflection(stk, idx, 4, 2, 3).consecutiveOutperformDays).toBe(1);
  });
});

describe("detectUndercutReclaim", () => {
  it("finds a support break that was taken back", () => {
    const bars: Bars = [];
    let t = Date.parse("2020-01-01T00:00:00.000Z");
    const push = (o: number, h: number, l: number, c: number) => {
      bars.push({ date: new Date(t), open: o, high: h, low: l, close: c, volume: 1e6 });
      t += DAY;
    };
    for (let i = 0; i < 30; i++) push(100, 101, 99.5, 100); // shelf at 99.5
    push(99, 99.2, 97, 97.5); // undercut
    push(97.6, 98, 96.5, 97.8); // still below
    push(98, 100.5, 97.9, 100.2); // reclaim
    for (let i = 0; i < 3; i++) push(100.3, 101.5, 100.1, 101); // holds, higher lows
    const r = detectUndercutReclaim(bars, bars.length - 1, 20, 5);
    expect(r.present).toBe(true);
    expect(r.supportLevel).toBeCloseTo(99.5, 6);
    expect(r.undercutPct).toBeLessThan(0);
    expect(r.reclaimPct).toBeGreaterThan(0);
    expect(r.higherLowAfterReclaim).toBe(true);
  });

  it("does not fire on a clean uptrend that never broke support", () => {
    const bars = path(120, 9, 0.004);
    expect(detectUndercutReclaim(bars, bars.length - 1, 20, 5).present).toBe(false);
  });

  it("returns absent rather than throwing on short history", () => {
    expect(detectUndercutReclaim(path(10, 1), 9, 20, 5).present).toBe(false);
  });
});

describe("classifyMarketState", () => {
  const base = {
    close: 100,
    ma10: 98,
    ma20: 99,
    ma50: 105,
    sessionsSinceMa50Reclaim: null,
    ma20Falling: true,
    madeRecentNewLow: false,
  };

  it("ranks the ladder from worst to best", () => {
    expect(classifyMarketState({ ...base, close: 90, ma10: 95, madeRecentNewLow: true })).toBe("DETERIORATING");
    expect(classifyMarketState({ ...base, close: 90, ma10: 95, madeRecentNewLow: false })).toBe("STABILIZING");
    expect(classifyMarketState({ ...base, close: 98.5, ma20Falling: true })).toBe("EARLY_RECOVERY");
    expect(classifyMarketState({ ...base, close: 98.5, ma20Falling: false })).toBe("APPROACHING_SHORT_MA");
    expect(classifyMarketState({ ...base, close: 99.5 })).toBe("APPROACHING_MA50");
    expect(classifyMarketState({ ...base, close: 106, sessionsSinceMa50Reclaim: 2 })).toBe("FRESH_MA50_RECLAIM");
    expect(classifyMarketState({ ...base, close: 106, sessionsSinceMa50Reclaim: 40 })).toBe("EXTENDED_AFTER_RECOVERY");
  });

  it("returns null rather than guessing before the averages are warm", () => {
    expect(classifyMarketState({ ...base, ma50: null })).toBeNull();
  });

  it("groups states into phases for cohorting", () => {
    expect(marketPhase("DETERIORATING")).toBe("DETERIORATING");
    expect(marketPhase("STABILIZING")).toBe("DETERIORATING");
    expect(marketPhase("EARLY_RECOVERY")).toBe("RECOVERING");
    expect(marketPhase("APPROACHING_MA50")).toBe("RECOVERING");
    expect(marketPhase("FRESH_MA50_RECLAIM")).toBe("ABOVE_MA50");
  });
});

describe("computeBreadth", () => {
  const row = (o: Partial<Parameters<typeof computeBreadth>[0][number]> = {}) => ({
    aboveMa10: false,
    aboveMa20: false,
    aboveMa50: false,
    up20d: false,
    newHigh52w: null,
    newLow52w: null,
    structureImproving: false,
    rsImproving: false,
    ...o,
  });

  it("returns null on an empty universe instead of dividing by zero", () => {
    expect(computeBreadth([])).toBeNull();
  });

  it("counts 52-week extremes only among symbols that have a year of history", () => {
    const b = computeBreadth([
      row({ newHigh52w: true, newLow52w: false }),
      row({ newHigh52w: false, newLow52w: true }),
      row(), // no year of data
    ])!;
    expect(b.n).toBe(3);
    expect(b.nWithYear).toBe(2);
    expect(b.newHighs).toBe(1);
    expect(b.newLows).toBe(1);
  });

  it("reports participation as percentages of the whole universe", () => {
    const b = computeBreadth([row({ aboveMa50: true }), row(), row(), row()])!;
    expect(b.pctAboveMa50).toBe(25);
  });
});
