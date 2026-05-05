import type { TerminalCategory } from "./gate2-scan-diagnostics";

/** Gate 2 INVALID bucket key → trader-facing label (presentation only). */
export const REJECTION_BUCKET_LABELS: Record<string, string> = {
  trend_below_ma50: "Below long-term trend",
  trend_ma20_below_ma50: "Short-term trend weaker than long-term",
  breakout_recency: "No recent breakout",
  pullback_zone_interaction: "Not in pullback entry zone",
  breakout_not_holding: "Breakout failed to hold",
  digestion: "No consolidation after breakout",
  mid_pullback_below_ma50: "Pullback closed under the 50-day line",
  swept_breakout_weak_close: "Weak finish after sweeping breakout lows",
  pullback_zone_two_closes: "Two closes below pullback zone floor",
  pullback_zone_malformed: "Pullback zone structure unclear",
  volume_median_bad: "Volume baseline unreliable",
  volume_ratio: "Participation too thin vs median volume",
  extension_cap: "Chasing — extended too far above breakout",
  depth_cap: "Pullback deeper than playbook allows",
  stop_structure: "Entry/stop distance not actionable",
  insufficient_bars: "Insufficient history for Gate 2",
  stale_or_session_mismatch: "Session date misaligned with benchmark",
  ma_compute: "Moving averages unavailable",
  unknown: "Other template mismatch",
};

export function rejectionBucketLabel(categoryKey: string): string {
  return REJECTION_BUCKET_LABELS[categoryKey] ?? categoryKey.replace(/_/g, " ");
}

export type RejectionBucketTraderGuide = {
  /** What this Gate 2 bucket means in plain language */
  meaning: string;
  /** What to wait for before expecting a name to clear this check */
  waitFor: string;
};

const DEFAULT_GUIDE: RejectionBucketTraderGuide = {
  meaning: "This rule removed the name under today’s breakout-pullback template.",
  waitFor: "Structure or participation to improve so the next scan can clear this step.",
};

/** Trader-facing copy for diagnostics accordion (does not change Gate 2 rules). */
export function rejectionBucketTraderGuide(categoryKey: string): RejectionBucketTraderGuide {
  switch (categoryKey) {
    case "trend_below_ma50":
      return {
        meaning: "Price is on the wrong side of the long-term trend filter for this swing style.",
        waitFor: "Strength back above the slow trend line before treating bias as supportive.",
      };
    case "trend_ma20_below_ma50":
      return {
        meaning: "Shorter-term trend is weaker than the slower one — momentum isn’t confirming.",
        waitFor: "Short-term trend to firm up vs the long-term line before prioritizing breakouts.",
      };
    case "breakout_recency":
      return {
        meaning: "There hasn’t been a qualifying breakout in the recent session window.",
        waitFor: "A decisive push through resistance, then reassess digestion and pullback.",
      };
    case "breakout_not_holding":
      return {
        meaning: "Price pierced resistance but didn’t finish the session holding the break.",
        waitFor: "A close that holds above the breakout level so the level acts as support.",
      };
    case "pullback_zone_interaction":
      return {
        meaning: "The latest bar doesn’t touch or work inside the pullback box after the break.",
        waitFor: "A dip or reclaim into the pullback zone so entry timing matches the playbook.",
      };
    case "digestion":
      return {
        meaning: "Price went vertical without the pause/digestion the template expects after the impulse.",
        waitFor: "A controlled pullback or chop under the breakout-day close (digest) before entry.",
      };
    case "pullback_zone_two_closes":
      return {
        meaning: "Two closes in a row lost the floor of the pullback zone.",
        waitFor: "Reclaim above the zone floor so structure isn’t breaking down into the box.",
      };
    case "pullback_zone_malformed":
      return {
        meaning: "The pullback zone couldn’t be drawn cleanly from recent swings.",
        waitFor: "Cleaner swings so the zone anchors are well-defined.",
      };
    case "mid_pullback_below_ma50":
      return {
        meaning: "During the pullback phase, price violated the 50-day line.",
        waitFor: "Pullback that respects major trend support before continuation setups.",
      };
    case "swept_breakout_weak_close":
      return {
        meaning: "Weak close after sweeping under breakout-related lows — fragile structure.",
        waitFor: "A stronger close that rejects the sweep and defends the breakout area.",
      };
    case "volume_median_bad":
      return {
        meaning: "Volume baseline isn’t reliable enough to score participation.",
        waitFor: "More regular volume history so median comparisons are meaningful.",
      };
    case "volume_ratio":
      return {
        meaning: "Participation on the bar is too thin versus the playbook threshold.",
        waitFor: "Heavier volume on supportive price action at the level.",
      };
    case "extension_cap":
      return {
        meaning: "Price has stretched too far above the breakout — chasing risk.",
        waitFor: "A shallower pullback or reset so reward/risk isn’t stretched.",
      };
    case "depth_cap":
      return {
        meaning: "The pullback retraced deeper than this template allows.",
        waitFor: "A shallower digest or a fresh structure reset.",
      };
    case "stop_structure":
      return {
        meaning: "Stop vs entry doesn’t give an actionable risk definition.",
        waitFor: "Structure where a clear stop and entry separation exists.",
      };
    case "insufficient_bars":
      return {
        meaning: "Not enough daily history to run the full Gate 2 checklist.",
        waitFor: "More bars imported before evaluating this name.",
      };
    case "stale_or_session_mismatch":
      return {
        meaning: "Stock data isn’t aligned with the benchmark session date.",
        waitFor: "Up-to-date bars for the same session as the index.",
      };
    case "ma_compute":
      return {
        meaning: "Moving averages couldn’t be computed for this series.",
        waitFor: "Clean bar data without gaps that block MA calculation.",
      };
    case "unknown":
      return {
        meaning: "Stopped on a reason that wasn’t classified into a standard bucket.",
        waitFor: "Review closest-to-valid lines or re-scan after data fixes.",
      };
    default:
      return DEFAULT_GUIDE;
  }
}

export type InsightCopy = {
  headline: string;
  contextLine: string;
  explanation: string;
  action: string;
};

export function buildSetupsInsightCopy(params: {
  surfacedCount: number;
  dominantCategoryKey: string | null;
  tradableCount: number;
}): InsightCopy {
  const { surfacedCount, dominantCategoryKey, tradableCount } = params;

  if (surfacedCount > 0) {
    return {
      headline:
        surfacedCount === 1
          ? "One qualified breakout-pullback setup surfaced today."
          : `${surfacedCount} qualified breakout-pullback setups surfaced today.`,
      contextLine:
        tradableCount > 0
          ? `Evaluated against ${tradableCount} tradable symbol${tradableCount === 1 ? "" : "s"} on the latest session.`
          : "",
      explanation: "Review levels and reasons below before allocating risk.",
      action: "Confirm liquidity and your plan at each tier (A vs B).",
    };
  }

  const headline = "Market is not favorable for breakout setups.";
  const { explanation, action } = dominantInsightExplanationAndAction(dominantCategoryKey);

  return {
    headline,
    contextLine:
      tradableCount > 0
        ? `${tradableCount} symbol${tradableCount === 1 ? "" : "s"} passed tradability but none cleared every Gate 2 check.`
        : "No symbols met tradability on this session.",
    explanation,
    action,
  };
}

function dominantInsightExplanationAndAction(dominant: string | null): {
  explanation: string;
  action: string;
} {
  switch (dominant) {
    case "trend_below_ma50":
      return {
        explanation: "Most stocks are still below key trend levels.",
        action: "Wait for trend recovery before scanning for setups.",
      };
    case "trend_ma20_below_ma50":
      return {
        explanation: "Short-term momentum is weaker than the slower trend on many names.",
        action: "Wait for MA20 to regain MA50 before prioritizing breakouts.",
      };
    case "breakout_recency":
      return {
        explanation: "Few symbols printed a fresh breakout in the last 10 sessions.",
        action: "Watch for a decisive push above the 20-day range high.",
      };
    case "breakout_not_holding":
      return {
        explanation: "Several names lost the breakout level before qualifying.",
        action: "Prefer clean holds above resistance before pullback entries.",
      };
    case "pullback_zone_interaction":
    case "pullback_zone_two_closes":
    case "pullback_zone_malformed":
      return {
        explanation: "Price is not interacting cleanly with the pullback box.",
        action: "Wait for a touch or reclaim inside the pullback zone.",
      };
    case "digestion":
      return {
        explanation: "Straight-line breaks without consolidation are being skipped.",
        action: "Look for a digest dip under the breakout-day close first.",
      };
    case "volume_ratio":
    case "volume_median_bad":
      return {
        explanation: "Participation at the evaluation bar is softer than the playbook requires.",
        action: "Stand aside until volume confirms interest at the level.",
      };
    case "extension_cap":
      return {
        explanation: "Many closes sit too far above the breakout level for this swing template.",
        action: "Avoid chasing; wait for a shallower pullback structure.",
      };
    case "depth_cap":
      return {
        explanation: "Pullbacks are retracing too deeply versus the breakout anchor.",
        action: "Wait for shallower digestion or a cleaner reset.",
      };
    case "stop_structure":
      return {
        explanation: "Stop placement relative to entry does not meet minimum swing risk.",
        action: "Skip marginal structures until stops can be defined cleanly.",
      };
    default:
      return {
        explanation: "Filters are strict — several different checks are trimming the list.",
        action: "Stay patient until structure aligns with the full playbook.",
      };
  }
}

/** One-line “closest” copy per terminal category (arrow format). */
export function traderClosestOneLiner(symbol: string, category: TerminalCategory | string): string {
  const c = category;
  switch (c) {
    case "pullback_zone_interaction":
      return `${symbol} → Broke out but not yet in pullback entry zone`;
    case "breakout_not_holding":
      return `${symbol} → Breakout failed to hold above resistance`;
    case "trend_below_ma50":
      return `${symbol} → Still below the 50-day trend filter`;
    case "trend_ma20_below_ma50":
      return `${symbol} → Short-term trend weaker than long-term`;
    case "breakout_recency":
      return `${symbol} → No qualifying breakout in the last 10 sessions`;
    case "digestion":
      return `${symbol} → Needs consolidation after the impulse`;
    case "pullback_zone_two_closes":
      return `${symbol} → Lost pullback zone — needs reclaim`;
    case "volume_ratio":
      return `${symbol} → Participation below playbook threshold`;
    case "extension_cap":
      return `${symbol} → Extended too far vs breakout (chasing risk)`;
    case "depth_cap":
      return `${symbol} → Pullback deeper than playbook allows`;
    case "stop_structure":
      return `${symbol} → Entry/stop structure not actionable yet`;
    default:
      return `${symbol} → Close to template — one Gate 2 rule still blocking`;
  }
}
