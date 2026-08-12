import { describe, expect, it } from "vitest";
import {
  breakdownBy,
  buildReplayReport,
  computeStats,
  judgeEdge,
  type ReplaySignal,
} from "./replay-metrics";
import type { SimulatedTrade } from "./trade-model";

function trade(over: Partial<SimulatedTrade> = {}): SimulatedTrade {
  return {
    entryDate: "2024-07-01",
    entryPrice: 100,
    stopPrice: 90,
    exitDate: "2024-07-29",
    exitPrice: 110,
    exitReason: "TIME_EXIT",
    sessionsHeld: 20,
    riskPerShare: 10,
    riskPct: 10,
    rMultiple: 1,
    returnPct: 10,
    mfePct: 12,
    maePct: -3,
    sessionsToStop: null,
    ...over,
  };
}

function sig(over: Partial<ReplaySignal> = {}): ReplaySignal {
  return {
    symbol: "FPT",
    sessionDate: "2024-06-28",
    quality: "A",
    gate1Level: "WARNING",
    rankScore: 2000,
    trade: trade(),
    unscoredReason: null,
    ...over,
  };
}

describe("computeStats", () => {
  it("returns an all-null shape for no trades rather than zeros", () => {
    // Zeros would read as "measured and flat"; null reads as "not measured".
    const s = computeStats([]);
    expect(s.n).toBe(0);
    expect(s.expectancyR).toBeNull();
    expect(s.winRatePct).toBeNull();
  });

  it("computes win rate, stop rate and expectancy over a mixed set", () => {
    const s = computeStats([
      trade({ rMultiple: 2 }),
      trade({ rMultiple: -1, exitReason: "STOP_HIT" }),
      trade({ rMultiple: -1, exitReason: "STOP_HIT" }),
      trade({ rMultiple: 1 }),
    ]);
    expect(s.n).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.winRatePct).toBe(50);
    expect(s.stopRatePct).toBe(50);
    expect(s.expectancyR).toBeCloseTo(0.25, 6);
    expect(s.totalR).toBeCloseTo(1, 6);
    expect(s.profitFactor).toBeCloseTo(1.5, 6);
  });

  it("treats an exactly-flat trade as a loss, not a win", () => {
    // A scratch is not a win; counting it as one inflates the headline rate.
    const s = computeStats([trade({ rMultiple: 0 })]);
    expect(s.wins).toBe(0);
    expect(s.winRatePct).toBe(0);
  });

  it("reports profit factor as null when nothing lost, instead of Infinity", () => {
    expect(computeStats([trade({ rMultiple: 1 })]).profitFactor).toBeNull();
  });

  it("separates median from mean so one outlier is visible", () => {
    const s = computeStats([
      trade({ rMultiple: -1 }),
      trade({ rMultiple: -1 }),
      trade({ rMultiple: 10 }),
    ]);
    expect(s.avgR).toBeCloseTo(2.667, 3);
    expect(s.medianR).toBe(-1);
  });
});

describe("breakdownBy", () => {
  it("groups only scored signals and sorts keys deterministically", () => {
    const b = breakdownBy(
      [
        sig({ symbol: "VCB" }),
        sig({ symbol: "ACB" }),
        sig({ symbol: "HPG", trade: null, unscoredReason: "insufficient_forward_bars" }),
      ],
      (s) => s.symbol
    );
    expect(Object.keys(b)).toEqual(["ACB", "VCB"]);
  });
});

describe("buildReplayReport", () => {
  it("counts unscored signals by reason rather than dropping them", () => {
    const r = buildReplayReport([
      sig(),
      sig({ trade: null, unscoredReason: "insufficient_forward_bars" }),
      sig({ trade: null, unscoredReason: "non_positive_risk" }),
    ]);
    expect(r.signalCounts).toMatchObject({ surfaced: 3, scored: 1, unscored: 2 });
    expect(r.signalCounts.unscoredByReason).toEqual({
      insufficient_forward_bars: 1,
      non_positive_risk: 1,
    });
  });

  it("breaks results down by year, regime and quality", () => {
    const r = buildReplayReport([
      sig({ sessionDate: "2019-05-02", gate1Level: "PASS", quality: "A" }),
      sig({ sessionDate: "2024-06-28", gate1Level: "WARNING", quality: "B" }),
    ]);
    expect(Object.keys(r.byYear)).toEqual(["2019", "2024"]);
    expect(Object.keys(r.byGate1Regime).sort()).toEqual(["PASS", "WARNING"]);
    expect(Object.keys(r.byQuality).sort()).toEqual(["Tier A", "Tier B"]);
  });

  it("surfaces how concentrated the result is across symbols", () => {
    const r = buildReplayReport([
      sig({ symbol: "BIG", trade: trade({ rMultiple: 50 }) }),
      sig({ symbol: "A", trade: trade({ rMultiple: 1 }) }),
      sig({ symbol: "B", trade: trade({ rMultiple: -1 }) }),
    ]);
    expect(r.concentration.topSymbolsByTotalR[0]).toMatchObject({ symbol: "BIG" });
    expect(r.concentration.topSymbolShareOfGrossR).toBeGreaterThan(90);
  });
});

describe("judgeEdge", () => {
  const many = (r: number, n: number, over: Partial<SimulatedTrade> = {}) =>
    Array.from({ length: n }, (_, i) =>
      sig({ symbol: `S${i % 40}`, trade: trade({ rMultiple: r, ...over }) })
    );

  it("refuses to call an edge on a small sample, however good it looks", () => {
    const j = judgeEdge(buildReplayReport(many(3, 20)));
    expect(j.verdict).toBe("INCONCLUSIVE");
    expect(j.reasons.join(" ")).toContain("100-trade floor");
  });

  it("calls NO_EDGE on a large sample with negative expectancy", () => {
    const j = judgeEdge(buildReplayReport(many(-0.5, 150, { exitReason: "STOP_HIT" })));
    expect(j.verdict).toBe("NO_EDGE");
    expect(j.reasons.join(" ")).toContain("loses on average");
  });

  it("calls EDGE only with both size and positive expectancy", () => {
    expect(judgeEdge(buildReplayReport(many(0.4, 150))).verdict).toBe("EDGE");
  });

  it("flags a high stop rate as where the failure concentrates", () => {
    const j = judgeEdge(buildReplayReport(many(-1, 150, { exitReason: "STOP_HIT" })));
    expect(j.failureConcentration.join(" ")).toContain("stop out");
  });

  it("flags adverse excursion exceeding favourable", () => {
    const j = judgeEdge(buildReplayReport(many(-0.2, 150, { mfePct: 2, maePct: -9 })));
    expect(j.failureConcentration.join(" ")).toContain("adverse excursion");
  });

  it("downgrades to INCONCLUSIVE when a few symbols carry the whole result", () => {
    // Positive expectancy that comes almost entirely from one trade has not been
    // observed enough times to be an edge. Reporting EDGE with the concentration
    // as a footnote invites exactly the wrong decision, so it blocks the verdict.
    const signals = [
      ...Array.from({ length: 149 }, () => sig({ symbol: "SPREAD", trade: trade({ rMultiple: 0.01 }) })),
      sig({ symbol: "ONE", trade: trade({ rMultiple: 200 }) }),
    ];
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.verdict).toBe("INCONCLUSIVE");
    expect(j.failureConcentration.join(" ")).toContain("not broad-based");
  });
});

describe("verdict precedence — disproof outranks 'not yet proven'", () => {
  const many = (r: number, n: number, over: Partial<SimulatedTrade> = {}) =>
    Array.from({ length: n }, (_, i) =>
      sig({ symbol: `S${i % 40}`, trade: trade({ rMultiple: r, ...over }) })
    );

  it("says NO_EDGE, not INCONCLUSIVE, when a large sample loses and the losses are concentrated", () => {
    // Losing 0.5R per trade over 150 trades is a measured negative. Hedging it to
    // INCONCLUSIVE because the damage clusters would bury a definitive answer.
    const signals = [
      ...Array.from({ length: 100 }, () => sig({ sessionDate: "2020-06-01", trade: trade({ rMultiple: -1.2, exitReason: "STOP_HIT" }) })),
      ...Array.from({ length: 50 }, (_, i) =>
        sig({ symbol: `S${i % 25}`, sessionDate: "2023-06-01", trade: trade({ rMultiple: 0.9 }) })
      ),
    ];
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.verdict).toBe("NO_EDGE");
  });

  it("still refuses NO_EDGE on a small losing sample", () => {
    // Too few trades to disprove anything either.
    expect(judgeEdge(buildReplayReport(many(-0.5, 30))).verdict).toBe("INCONCLUSIVE");
  });

  it("does not raise year concentration on a single-year sample", () => {
    // The best year holds 100% of gross R by construction when there is only one.
    const j = judgeEdge(buildReplayReport(many(0.4, 150)));
    expect(j.failureConcentration.join(" ")).not.toContain("one market regime");
    expect(j.verdict).toBe("EDGE");
  });
});

describe("degenerate stops — R is not trustworthy when the stop is a rounding error", () => {
  const near = (over: Partial<SimulatedTrade> = {}) =>
    sig({ trade: trade({ riskPct: 0.05, rMultiple: 286, returnPct: 14.1, ...over }) });

  it("counts trades whose stop is under 1% of entry", () => {
    const s = computeStats([trade({ riskPct: 0.05 }), trade({ riskPct: 4 })]);
    expect(s.degenerateRiskTrades).toBe(1);
    expect(s.minRiskPct).toBeCloseTo(0.05, 3);
  });

  it("flags them in the verdict, naming R as the artefact", () => {
    const signals = [
      ...Array.from({ length: 149 }, () => sig({ trade: trade({ rMultiple: 0.05, riskPct: 4 }) })),
      near(),
    ];
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.failureConcentration.join(" ")).toContain("stop under 1% of entry");
    expect(j.failureConcentration.join(" ")).toContain("percent return, not R");
  });

  it("reports percent return beside R so the inflation is visible", () => {
    // The real case: +14.1% is an ordinary gain; 286R is the same gain divided
    // by a 0.05% stop. Both must be on the page.
    const s = computeStats([trade({ riskPct: 0.05, rMultiple: 286, returnPct: 14.1 })]);
    expect(s.expectancyR).toBeCloseTo(286, 0);
    expect(s.avgReturnPct).toBeCloseTo(14.1, 2);
  });

  it("calls NO_EDGE when R is positive but percent return is not", () => {
    const signals = Array.from({ length: 150 }, (_, i) =>
      sig({ symbol: `S${i % 40}`, trade: trade({ rMultiple: 0.5, returnPct: -0.4, riskPct: 4 }) })
    );
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.verdict).toBe("NO_EDGE");
    expect(j.reasons.join(" ")).toContain("artefact of stop distance");
  });
});

describe("year concentration — one good regime is not an edge", () => {
  it("reports the best year's share and expectancy without it", () => {
    const signals = [
      ...Array.from({ length: 40 }, () => sig({ sessionDate: "2020-06-01", trade: trade({ rMultiple: 6 }) })),
      ...Array.from({ length: 110 }, (_, i) =>
        sig({ symbol: `S${i % 30}`, sessionDate: "2023-06-01", trade: trade({ rMultiple: 0.05 }) })
      ),
    ];
    const r = buildReplayReport(signals);
    expect(r.concentration.bestYear).toBe("2020");
    expect(r.concentration.bestYearShareOfGrossR).toBeGreaterThan(90);
    expect(r.concentration.expectancyExBestYearR).toBeCloseTo(0.05, 2);
  });

  it("flags it in the verdict even when overall expectancy is strongly positive", () => {
    const signals = [
      ...Array.from({ length: 40 }, () => sig({ sessionDate: "2020-06-01", trade: trade({ rMultiple: 6 }) })),
      ...Array.from({ length: 110 }, (_, i) =>
        sig({ symbol: `S${i % 30}`, sessionDate: "2023-06-01", trade: trade({ rMultiple: 0.05 }) })
      ),
    ];
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.failureConcentration.join(" ")).toContain("one market regime");
  });

  it("does not flag a result spread evenly across years", () => {
    const signals = ["2021", "2022", "2023", "2024"].flatMap((y) =>
      Array.from({ length: 40 }, (_, i) =>
        sig({ symbol: `S${i % 20}`, sessionDate: `${y}-06-01`, trade: trade({ rMultiple: 0.3 }) })
      )
    );
    const j = judgeEdge(buildReplayReport(signals));
    expect(j.failureConcentration.join(" ")).not.toContain("one market regime");
  });
});
