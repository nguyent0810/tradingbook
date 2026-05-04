import type { Bar } from "@/lib/market/types";
import { sma } from "./indicators";

export type MarketRegime = {
  level: "PASS" | "WARNING" | "FAIL";
  reasons: string[];
};

type Trend = "bullish" | "bearish" | "neutral";
type Momentum = "up" | "down" | "neutral";

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
    return { level: "PASS", reasons };
  }

  if (trend === "bearish" && momentum === "down") {
    return { level: "FAIL", reasons };
  }

  return { level: "WARNING", reasons };
}
