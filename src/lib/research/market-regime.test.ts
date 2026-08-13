import { describe, expect, it } from "vitest";
import {
  BREADTH_MAJORITY_PCT,
  classifyRegime,
  isDivergent,
  toRuns,
  transitionStats,
  type Regime,
} from "./market-regime";

const base = { indexClose: 100, indexMa50: 95, pctAboveMa50: 60, universeN: 300 };
const OPTS = { minUniverse: 100 };

describe("classifyRegime — the two axes stay independent", () => {
  it("names all four cells of the matrix", () => {
    expect(classifyRegime({ ...base, indexClose: 100, pctAboveMa50: 60 }, OPTS)?.regime).toBe("BROAD_ADVANCE");
    expect(classifyRegime({ ...base, indexClose: 100, pctAboveMa50: 40 }, OPTS)?.regime).toBe("NARROW_RALLY");
    expect(classifyRegime({ ...base, indexClose: 90, pctAboveMa50: 60 }, OPTS)?.regime).toBe("RECOVERY_UNDERNEATH");
    expect(classifyRegime({ ...base, indexClose: 90, pctAboveMa50: 40 }, OPTS)?.regime).toBe("SYSTEMIC_WEAKNESS");
  });

  it("changes the breadth axis without touching the index axis, and vice versa", () => {
    // If the axes were entangled, moving one input would move both labels.
    const a = classifyRegime({ ...base, pctAboveMa50: 60 }, OPTS)!;
    const b = classifyRegime({ ...base, pctAboveMa50: 40 }, OPTS)!;
    expect(a.index).toBe(b.index);
    expect(a.breadth).not.toBe(b.breadth);

    const c = classifyRegime({ ...base, indexClose: 90 }, OPTS)!;
    expect(c.breadth).toBe(a.breadth);
    expect(c.index).not.toBe(a.index);
  });

  it("splits breadth on the majority boundary, inclusive", () => {
    expect(classifyRegime({ ...base, pctAboveMa50: BREADTH_MAJORITY_PCT }, OPTS)?.breadth).toBe("BREADTH_STRONG");
    expect(classifyRegime({ ...base, pctAboveMa50: BREADTH_MAJORITY_PCT - 0.01 }, OPTS)?.breadth).toBe("BREADTH_WEAK");
  });

  it("splits the index on its own MA50, inclusive", () => {
    expect(classifyRegime({ ...base, indexClose: 95, indexMa50: 95 }, OPTS)?.index).toBe("INDEX_STRONG");
    expect(classifyRegime({ ...base, indexClose: 94.99, indexMa50: 95 }, OPTS)?.index).toBe("INDEX_WEAK");
  });

  it("refuses to classify rather than guessing when an axis is unmeasurable", () => {
    expect(classifyRegime({ ...base, indexMa50: null }, OPTS)).toBeNull();
    expect(classifyRegime({ ...base, pctAboveMa50: null }, OPTS)).toBeNull();
    // A breadth reading over a handful of symbols is not breadth.
    expect(classifyRegime({ ...base, universeN: 40 }, OPTS)).toBeNull();
  });

  it("flags exactly the two cells where the axes disagree", () => {
    const of = (c: number, b: number) => classifyRegime({ ...base, indexClose: c, pctAboveMa50: b }, OPTS)!;
    expect(isDivergent(of(100, 40))).toBe(true);  // narrow rally
    expect(isDivergent(of(90, 60))).toBe(true);   // recovery underneath
    expect(isDivergent(of(100, 60))).toBe(false);
    expect(isDivergent(of(90, 40))).toBe(false);
  });

  it("honours an alternative breadth cutoff for sensitivity runs only", () => {
    const i = { ...base, indexClose: 100, pctAboveMa50: 45 };
    expect(classifyRegime(i, { minUniverse: 100 })?.regime).toBe("NARROW_RALLY");
    expect(classifyRegime(i, { minUniverse: 100, breadthCutoffPct: 40 })?.regime).toBe("BROAD_ADVANCE");
  });
});

describe("toRuns / transitionStats — runs are the unit, not sessions", () => {
  const S = (x: string): Regime => x as Regime;
  const series: (Regime | null)[] = [
    S("SYSTEMIC_WEAKNESS"), S("SYSTEMIC_WEAKNESS"), S("SYSTEMIC_WEAKNESS"),
    S("RECOVERY_UNDERNEATH"),
    S("BROAD_ADVANCE"), S("BROAD_ADVANCE"),
  ];

  it("collapses consecutive sessions into runs", () => {
    const runs = toRuns(series);
    expect(runs.map((r) => [r.regime, r.length])).toEqual([
      ["SYSTEMIC_WEAKNESS", 3],
      ["RECOVERY_UNDERNEATH", 1],
      ["BROAD_ADVANCE", 2],
    ]);
  });

  it("skips unclassifiable sessions without joining across them", () => {
    const withGap: (Regime | null)[] = [S("BROAD_ADVANCE"), null, S("BROAD_ADVANCE")];
    // Two separate runs: the gap is missing data, not continuity.
    expect(toRuns(withGap).length).toBe(2);
  });

  it("counts transitions between consecutive runs", () => {
    const t = transitionStats(toRuns(series));
    expect(t.matrix["SYSTEMIC_WEAKNESS"]!["RECOVERY_UNDERNEATH"]).toBe(1);
    expect(t.matrix["RECOVERY_UNDERNEATH"]!["BROAD_ADVANCE"]).toBe(1);
    expect(t.matrix["BROAD_ADVANCE"]!["SYSTEMIC_WEAKNESS"]).toBe(0);
  });

  it("reports the one-session flip rate, which is what exposes a noisy classifier", () => {
    const t = transitionStats(toRuns(series));
    expect(t.oneDayFlipRate).toBeCloseTo(1 / 3, 6);
    expect(t.medianRunLength).toBe(2);
  });

  it("reports a flip rate of 1 for a classifier that changes every session", () => {
    const alternating: (Regime | null)[] = Array.from({ length: 10 }, (_, i) =>
      S(i % 2 === 0 ? "BROAD_ADVANCE" : "SYSTEMIC_WEAKNESS")
    );
    expect(transitionStats(toRuns(alternating)).oneDayFlipRate).toBe(1);
  });
});
