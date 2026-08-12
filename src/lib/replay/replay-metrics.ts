/**
 * Aggregate replay outcomes into the numbers a go/no-go rests on.
 *
 * Two rules shape everything here:
 *
 *  1. Expectancy is reported in R, not percent. Percent returns silently weight
 *     wide-stop signals more heavily than tight-stop ones; R is what the strategy
 *     actually risks per trade and is the only figure that composes.
 *  2. Every bucket carries its own `n`. A 100% win rate over 3 trades and over
 *     300 are different claims, and a breakdown that hides `n` invites reading
 *     the first as the second.
 */
import type { SimulatedTrade } from "./trade-model";

export type ReplaySignal = {
  symbol: string;
  sessionDate: string;
  quality: "A" | "B";
  gate1Level: "PASS" | "WARNING" | "FAIL";
  rankScore: number;
  trade: SimulatedTrade | null;
  /** Why a surfaced signal produced no trade. */
  unscoredReason: string | null;
  /**
   * Gate 1's inputs, recorded rather than re-derived.
   *
   * `gate1Level` is a three-way collapse of two independent conditions, so the
   * level alone cannot say which condition drives an outcome. Keeping the raw
   * inputs lets PASS be decomposed into (trend, momentum) without re-running the
   * replay or reimplementing the rule — reimplementing it in an analysis script
   * is how a decomposition ends up measuring the analysis instead of the gate.
   */
  gate1?: {
    trend: "bullish" | "bearish" | "neutral" | null;
    momentum: "up" | "down" | "neutral" | null;
    /** Index close vs its MA50, in percent. Signed: negative means below. */
    indexExtensionPct: number | null;
    /** Consecutive strictly-rising index closes ending at T. */
    indexUpStreak: number;
    /**
     * Index return over the same forward horizon as the trade. Read through the
     * outcome channel, never the decision channel. Present so "did the market
     * itself go up after this regime?" can be answered without conflating it
     * with the stock's own move.
     */
    indexFwdPct: number | null;
  };
};

export type PerformanceStats = {
  n: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  stopRatePct: number | null;
  avgR: number | null;
  medianR: number | null;
  expectancyR: number | null;
  totalR: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  profitFactor: number | null;
  avgMfePct: number | null;
  avgMaePct: number | null;
  avgSessionsHeld: number | null;
  /**
   * Percent-return figures sit beside the R figures deliberately. R divides by
   * the stop distance, so a degenerate stop inflates it without any extra profit
   * being made; percent return is immune to that and is the honesty check.
   */
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  totalReturnPct: number | null;
  avgRiskPct: number | null;
  minRiskPct: number | null;
  /** Trades whose stop was under 1% of entry — untradeable in practice. */
  degenerateRiskTrades: number;
};

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

function mean(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round(v: number | null, dp = 3): number | null {
  return v == null ? null : Number(v.toFixed(dp));
}

export function computeStats(trades: readonly SimulatedTrade[]): PerformanceStats {
  const n = trades.length;
  if (n === 0) {
    return {
      n: 0, wins: 0, losses: 0, winRatePct: null, stopRatePct: null, avgR: null,
      medianR: null, expectancyR: null, totalR: null, avgWinR: null, avgLossR: null,
      profitFactor: null, avgMfePct: null, avgMaePct: null, avgSessionsHeld: null,
      avgReturnPct: null, medianReturnPct: null, totalReturnPct: null,
      avgRiskPct: null, minRiskPct: null, degenerateRiskTrades: 0,
    };
  }

  const rs = trades.map((t) => t.rMultiple);
  const winners = trades.filter((t) => t.rMultiple > 0);
  const losers = trades.filter((t) => t.rMultiple <= 0);
  const stopped = trades.filter((t) => t.exitReason === "STOP_HIT");

  const grossWin = winners.reduce((a, t) => a + t.rMultiple, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.rMultiple, 0));

  return {
    n,
    wins: winners.length,
    losses: losers.length,
    winRatePct: round((winners.length / n) * 100, 2),
    stopRatePct: round((stopped.length / n) * 100, 2),
    avgR: round(mean(rs)),
    medianR: round(median(rs)),
    // With R already normalised per trade, expectancy is the mean. Stated
    // explicitly rather than recomputed from win rate x payoff, which drifts
    // from the realised mean whenever the two are estimated separately.
    expectancyR: round(mean(rs)),
    totalR: round(rs.reduce((a, b) => a + b, 0), 2),
    avgWinR: round(mean(winners.map((t) => t.rMultiple))),
    avgLossR: round(mean(losers.map((t) => t.rMultiple))),
    profitFactor: grossLoss === 0 ? null : round(grossWin / grossLoss),
    avgMfePct: round(mean(trades.map((t) => t.mfePct)), 2),
    avgMaePct: round(mean(trades.map((t) => t.maePct)), 2),
    avgSessionsHeld: round(mean(trades.map((t) => t.sessionsHeld)), 1),
    avgReturnPct: round(mean(trades.map((t) => t.returnPct)), 2),
    medianReturnPct: round(median(trades.map((t) => t.returnPct)), 2),
    totalReturnPct: round(trades.reduce((a, t) => a + t.returnPct, 0), 2),
    avgRiskPct: round(mean(trades.map((t) => t.riskPct)), 2),
    minRiskPct: round(Math.min(...trades.map((t) => t.riskPct)), 3),
    degenerateRiskTrades: trades.filter((t) => t.riskPct < 1).length,
  };
}

export type Breakdown = Record<string, PerformanceStats>;

export function breakdownBy(
  signals: readonly ReplaySignal[],
  key: (s: ReplaySignal) => string
): Breakdown {
  const groups = new Map<string, SimulatedTrade[]>();
  for (const s of signals) {
    if (!s.trade) continue;
    const k = key(s);
    const arr = groups.get(k) ?? [];
    arr.push(s.trade);
    groups.set(k, arr);
  }
  const out: Breakdown = {};
  for (const k of [...groups.keys()].sort()) out[k] = computeStats(groups.get(k)!);
  return out;
}

export type ReplayReport = {
  overall: PerformanceStats;
  signalCounts: {
    surfaced: number;
    scored: number;
    unscored: number;
    unscoredByReason: Record<string, number>;
  };
  byYear: Breakdown;
  byGate1Regime: Breakdown;
  byQuality: Breakdown;
  bySymbol: Breakdown;
  /** Symbols ranked by total R, both tails — where the result is concentrated. */
  concentration: {
    topSymbolsByTotalR: Array<{ symbol: string; n: number; totalR: number }>;
    bottomSymbolsByTotalR: Array<{ symbol: string; n: number; totalR: number }>;
    topSymbolShareOfGrossR: number | null;
    /**
     * Share of gross R contributed by the single best year. A strategy whose
     * result comes from one market regime has been measured once, not proven —
     * and symbol concentration alone will not reveal it.
     */
    bestYearShareOfGrossR: number | null;
    bestYear: string | null;
    /** Expectancy with the single best year removed. */
    expectancyExBestYearR: number | null;
    nExBestYear: number;
  };
};

export function buildReplayReport(signals: readonly ReplaySignal[]): ReplayReport {
  const scored = signals.filter((s) => s.trade != null);
  const trades = scored.map((s) => s.trade!);

  const unscoredByReason: Record<string, number> = {};
  for (const s of signals) {
    if (s.trade) continue;
    const r = s.unscoredReason ?? "unknown";
    unscoredByReason[r] = (unscoredByReason[r] ?? 0) + 1;
  }

  const bySymbol = breakdownBy(signals, (s) => s.symbol);
  const symbolTotals = Object.entries(bySymbol)
    .map(([symbol, st]) => ({ symbol, n: st.n, totalR: st.totalR ?? 0 }))
    .sort((a, b) => b.totalR - a.totalR);

  // How much of the gross result rides on a handful of names. A baseline carried
  // by three symbols is a different claim from one spread across the universe.
  const grossAbs = symbolTotals.reduce((a, s) => a + Math.abs(s.totalR), 0);
  const top5 = symbolTotals.slice(0, 5).reduce((a, s) => a + Math.abs(s.totalR), 0);

  const byYear = breakdownBy(signals, (s) => s.sessionDate.slice(0, 4));
  const yearTotals = Object.entries(byYear)
    .map(([year, st]) => ({ year, n: st.n, totalR: st.totalR ?? 0 }))
    .sort((a, b) => b.totalR - a.totalR);
  const best = yearTotals[0] ?? null;
  const yearGrossAbs = yearTotals.reduce((a, y) => a + Math.abs(y.totalR), 0);
  const totalR = trades.reduce((a, t) => a + t.rMultiple, 0);
  const nExBest = trades.length - (best?.n ?? 0);
  const rExBest = totalR - (best?.totalR ?? 0);

  return {
    overall: computeStats(trades),
    signalCounts: {
      surfaced: signals.length,
      scored: scored.length,
      unscored: signals.length - scored.length,
      unscoredByReason,
    },
    byYear,
    byGate1Regime: breakdownBy(signals, (s) => s.gate1Level),
    byQuality: breakdownBy(signals, (s) => `Tier ${s.quality}`),
    bySymbol,
    concentration: {
      topSymbolsByTotalR: symbolTotals.slice(0, 10),
      bottomSymbolsByTotalR: symbolTotals.slice(-10).reverse(),
      topSymbolShareOfGrossR: grossAbs === 0 ? null : Number(((top5 / grossAbs) * 100).toFixed(1)),
      bestYearShareOfGrossR:
        yearGrossAbs === 0 || best == null
          ? null
          : Number(((Math.abs(best.totalR) / yearGrossAbs) * 100).toFixed(1)),
      bestYear: best?.year ?? null,
      expectancyExBestYearR: nExBest > 0 ? Number((rExBest / nExBest).toFixed(3)) : null,
      nExBestYear: nExBest,
    },
  };
}

/**
 * Is there an edge, and where does the failure concentrate?
 *
 * Deliberately conservative: an edge must clear a sample-size floor as well as a
 * positive expectancy, because a handful of lucky trades is not evidence. The
 * thresholds are stated here rather than left implicit in a reader's head.
 */
export function judgeEdge(report: ReplayReport): {
  verdict: "EDGE" | "NO_EDGE" | "INCONCLUSIVE";
  reasons: string[];
  failureConcentration: string[];
} {
  const reasons: string[] = [];
  const failure: string[] = [];
  const o = report.overall;

  if (o.n < 100) {
    reasons.push(`Only ${o.n} scored trades — below the 100-trade floor for any claim about edge.`);
  }
  if (o.expectancyR != null && o.expectancyR <= 0) {
    reasons.push(`Expectancy is ${o.expectancyR}R per trade — the strategy loses on average.`);
  }
  if (o.stopRatePct != null && o.stopRatePct >= 60) {
    failure.push(`${o.stopRatePct}% of trades stop out — entries are structurally late or stops too tight.`);
  }
  if (o.avgMaePct != null && o.avgMfePct != null && Math.abs(o.avgMaePct) > o.avgMfePct) {
    failure.push(
      `Average adverse excursion (${o.avgMaePct}%) exceeds favourable (${o.avgMfePct}%) — ` +
        `trades go against the entry more than for it.`
    );
  }
  if (o.degenerateRiskTrades > 0) {
    const pct = ((o.degenerateRiskTrades / o.n) * 100).toFixed(1);
    failure.push(
      `${o.degenerateRiskTrades} trade(s) (${pct}%) have a stop under 1% of entry (min ${o.minRiskPct}%). ` +
        `R divides by that distance, so these inflate expectancy without earning more. Judge them on ` +
        `percent return, not R.`
    );
  }
  if (o.avgReturnPct != null && o.expectancyR != null && o.expectancyR > 0 && o.avgReturnPct <= 0) {
    reasons.push(
      `Expectancy is positive in R (${o.expectancyR}) but NEGATIVE in percent return ` +
        `(${o.avgReturnPct}%) — the R figure is an artefact of stop distance, not profit.`
    );
  }
  // Only meaningful across two or more years. With a single year the best year
  // holds 100% of gross R by construction, and the message would read "excluding
  // it, expectancy falls to nullR over 0 trades" — a vacuous flag that would
  // block every verdict computed on a one-year sample.
  const yearsCovered = Object.keys(report.byYear).length;
  const yearShare = yearsCovered >= 2 ? report.concentration.bestYearShareOfGrossR : null;
  if (yearShare != null && yearShare >= 40) {
    failure.push(
      `${yearShare}% of gross R comes from ${report.concentration.bestYear} alone. Excluding it, ` +
        `expectancy falls to ${report.concentration.expectancyExBestYearR}R over ` +
        `${report.concentration.nExBestYear} trades — the result reflects one market regime, not an edge.`
    );
  }
  const share = report.concentration.topSymbolShareOfGrossR;
  if (share != null && share >= 50) {
    failure.push(`${share}% of gross R sits in 5 symbols — the result is not broad-based.`);
  }
  for (const [regime, st] of Object.entries(report.byGate1Regime)) {
    if (st.n >= 20 && st.expectancyR != null && st.expectancyR < 0) {
      failure.push(`Gate 1 ${regime}: ${st.expectancyR}R over ${st.n} trades.`);
    }
  }

  // The verdict must follow the reasons, not be computed alongside them. Deriving
  // it independently let a blocking reason be recorded while the headline still
  // read EDGE — the failure mode this whole function exists to prevent.
  // Concentration does not prove the strategy loses, so it is not NO_EDGE — but
  // a result carried by one regime or a handful of names has not been measured
  // enough times to be called an edge either. That is exactly INCONCLUSIVE, and
  // leaving it as a footnote under an EDGE headline invites the wrong decision.
  const concentrated =
    (yearShare != null && yearShare >= 40) || (share != null && share >= 50);
  if (concentrated) {
    reasons.push(
      "Result is too concentrated to support an edge claim: see failure concentration. " +
        "More independent events are needed before this can be judged."
    );
  }

  // Precedence matters. A strategy that loses on average over a large sample has
  // been measured and found wanting — calling that INCONCLUSIVE because the
  // losses are concentrated would hide a definitive negative behind a hedge.
  // Disproof outranks "not yet proven"; INCONCLUSIVE is only for the cases where
  // the evidence genuinely does not settle the question.
  const disproved =
    o.n >= 100 &&
    ((o.expectancyR != null && o.expectancyR <= 0) ||
      (o.avgReturnPct != null && o.expectancyR != null && o.expectancyR > 0 && o.avgReturnPct <= 0));

  const verdict = disproved
    ? "NO_EDGE"
    : o.n < 100 || concentrated
      ? "INCONCLUSIVE"
      : reasons.length > 0
        ? "NO_EDGE"
        : "EDGE";

  return { verdict, reasons, failureConcentration: failure };
}
