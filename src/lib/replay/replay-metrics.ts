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

  return {
    overall: computeStats(trades),
    signalCounts: {
      surfaced: signals.length,
      scored: scored.length,
      unscored: signals.length - scored.length,
      unscoredByReason,
    },
    byYear: breakdownBy(signals, (s) => s.sessionDate.slice(0, 4)),
    byGate1Regime: breakdownBy(signals, (s) => s.gate1Level),
    byQuality: breakdownBy(signals, (s) => `Tier ${s.quality}`),
    bySymbol,
    concentration: {
      topSymbolsByTotalR: symbolTotals.slice(0, 10),
      bottomSymbolsByTotalR: symbolTotals.slice(-10).reverse(),
      topSymbolShareOfGrossR: grossAbs === 0 ? null : Number(((top5 / grossAbs) * 100).toFixed(1)),
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
  const share = report.concentration.topSymbolShareOfGrossR;
  if (share != null && share >= 50) {
    failure.push(`${share}% of gross R sits in 5 symbols — the result is not broad-based.`);
  }
  for (const [regime, st] of Object.entries(report.byGate1Regime)) {
    if (st.n >= 20 && st.expectancyR != null && st.expectancyR < 0) {
      failure.push(`Gate 1 ${regime}: ${st.expectancyR}R over ${st.n} trades.`);
    }
  }

  const verdict =
    o.n < 100
      ? "INCONCLUSIVE"
      : o.expectancyR != null && o.expectancyR > 0
        ? "EDGE"
        : "NO_EDGE";

  return { verdict, reasons, failureConcentration: failure };
}
