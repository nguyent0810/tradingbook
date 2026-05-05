import type { RegimeMomentum, RegimeTrend } from "./gate1-market";
import type { MarketRegimeFromDbResult } from "./get-market-regime";
import {
  INSUFFICIENT_STORED_BARS_REASON,
  MARKET_DATA_UNAVAILABLE_REASON,
} from "./get-market-regime";

export type RegimePanelCopy = {
  primarySummary: string;
  actionGuidance: string | null;
  /** Original Gate 1 strings for advanced users (de-emphasized in UI). */
  technicalReasons: string[];
};

function actionGuidanceForLevel(level: "PASS" | "WARNING" | "FAIL"): string {
  switch (level) {
    case "PASS":
      return "Favorable conditions. Consider normal position sizing.";
    case "WARNING":
      return "Mixed conditions. Trade cautiously and reduce position size.";
    case "FAIL":
      return "Unfavorable conditions. Avoid new positions.";
  }
}

/**
 * Human-readable primary line from trend + momentum (same inputs Gate 1 uses; does not change thresholds).
 */
function primaryFromTrendMomentum(
  trend: RegimeTrend,
  momentum: RegimeMomentum
): string {
  if (trend === "bullish" && momentum === "up") {
    return "Uptrend with strengthening momentum.";
  }
  if (trend === "bearish" && momentum === "down") {
    return "Downtrend with increasing selling pressure.";
  }
  if (trend === "bullish" && momentum !== "up") {
    return "Uptrend, but momentum is weakening.";
  }
  if (trend === "bearish" && momentum !== "down") {
    return "Downtrend, but selling pressure is easing.";
  }
  return "Mixed signals: price is near the medium-term average.";
}

/**
 * Maps DB regime result to decision-focused copy for the dashboard strip.
 * Gate 1 evaluation logic is unchanged; this layer is presentation only.
 */
export function buildRegimePanelCopy(
  result: MarketRegimeFromDbResult
): RegimePanelCopy {
  const { level, reasons, trend, momentum, evaluatedBarsCount } = result;
  const first = reasons[0] ?? "";

  if (first === MARKET_DATA_UNAVAILABLE_REASON) {
    return {
      primarySummary: "Market data unavailable.",
      actionGuidance: null,
      technicalReasons: reasons,
    };
  }

  if (first === INSUFFICIENT_STORED_BARS_REASON) {
    return {
      primarySummary:
        "Not enough data to evaluate market conditions.",
      actionGuidance: null,
      technicalReasons: reasons,
    };
  }

  if (
    evaluatedBarsCount > 0 &&
    trend !== undefined &&
    momentum !== undefined
  ) {
    return {
      primarySummary: primaryFromTrendMomentum(trend, momentum),
      actionGuidance: actionGuidanceForLevel(level),
      technicalReasons: reasons,
    };
  }

  return {
    primarySummary: "Unable to fully evaluate market conditions.",
    actionGuidance: actionGuidanceForLevel(level),
    technicalReasons: reasons,
  };
}
