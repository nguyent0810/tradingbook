import type { Bar } from "@/lib/market/types";
import { sma } from "./indicators";

export type RegimeTrend = "bullish" | "bearish" | "neutral";
export type RegimeMomentum = "up" | "down" | "neutral";

export type MarketRegime = {
  level: "PASS" | "WARNING" | "FAIL";
  reasons: string[];
  /** Present when MA50 and momentum were computed (not returned on insufficient bars / MA failure). */
  trend?: RegimeTrend;
  momentum?: RegimeMomentum;
};

type Trend = RegimeTrend;
type Momentum = RegimeMomentum;

function closesFromBars(bars: readonly Bar[]): number[] {
  return bars.map((b) => b.close);
}

/** Last 3 closes strictly rising: c[-1] > c[-2] > c[-3] */
function momentumFromCloses(closes: readonly number[]): Momentum {
  if (closes.length < 3) return "neutral";
  const a = closes[closes.length - 3];
  const b = closes[closes.length - 2];
  const c = closes[closes.length - 1];
  if (c > b && b > a) return "up";
  if (c < b && b < a) return "down";
  return "neutral";
}

function trendFromCloseVsMa50(lastClose: number, ma50: number): Trend {
  if (lastClose > ma50) return "bullish";
  if (lastClose < ma50) return "bearish";
  return "neutral";
}

/**
 * Gate 1 — market regime from daily index OHLCV bars + MA50 only.
 *
 * PASS:  bullish trend AND momentum up
 * FAIL:  bearish trend AND momentum down
 * WARNING: all other cases (including insufficient history)
 *
 * ---------------------------------------------------------------------------
 * SUSPECT — INSUFFICIENT EVIDENCE (audited 2026-08-12, unchanged deliberately)
 *
 * Replay over 4,024 sessions found PASS performing WORSE than WARNING on the
 * same tier. Holding `trend` at bullish and varying only `momentum`, the branch
 * PASS requires is the weakest of the three (−0.38% mean forward return, n=103,
 * vs +1.41%, n=231). Close-to-close index timing and index extension were both
 * tested as explanations and neither held.
 *
 * The rule is NOT changed, because the evidence does not support changing it:
 * the confidence interval crosses zero and removing 11 of 270 trades moves the
 * headline interval across zero too. n=103 is the binding limit.
 *
 * The `momentum` clause is the prime suspect — it demands the index be extended
 * (an up-streak of >=2 sessions) at the moment a breakout-PULLBACK setup demands
 * the stock be pulled back. Do not act on that reading until it is demonstrated.
 *
 * Full analysis: docs/trading/replay/GATE1-AND-STOP-AUDIT.md
 * ---------------------------------------------------------------------------
 */
export function evaluateMarketRegime(bars: Bar[]): MarketRegime {
  const reasons: string[] = [];
  const closes = closesFromBars(bars);

  if (closes.length < 50) {
    reasons.push(
      `Need at least 50 daily bars for MA50 (got ${closes.length}).`
    );
    return { level: "WARNING", reasons };
  }

  const maSeries = sma(closes, 50);
  const ma50 = maSeries[maSeries.length - 1];

  if (ma50 === undefined || Number.isNaN(ma50)) {
    reasons.push("Could not compute MA50.");
    return { level: "WARNING", reasons };
  }

  const lastClose = closes[closes.length - 1];
  const trend = trendFromCloseVsMa50(lastClose, ma50);
  const momentum = momentumFromCloses(closes);

  reasons.push(`Close ${lastClose.toFixed(2)} vs MA50 ${ma50.toFixed(2)} → ${trend}.`);
  reasons.push(
    `Last 3 closes momentum → ${momentum === "up" ? "rising" : momentum === "down" ? "falling" : "not strictly trending"}.`
  );

  if (trend === "bullish" && momentum === "up") {
    return { level: "PASS", reasons, trend, momentum };
  }

  if (trend === "bearish" && momentum === "down") {
    return { level: "FAIL", reasons, trend, momentum };
  }

  return { level: "WARNING", reasons, trend, momentum };
}
