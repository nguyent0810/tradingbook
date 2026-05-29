/** Terminal bucket keys for Gate 2 INVALID diagnostics (stable across UI and scan notes). */
export type TerminalCategory =
  | "insufficient_bars"
  | "stale_or_session_mismatch"
  | "ma_compute"
  | "trend_below_ma50"
  | "trend_ma20_below_ma50"
  | "breakout_recency"
  | "digestion"
  | "breakout_not_holding"
  | "mid_pullback_below_ma50"
  | "swept_breakout_weak_close"
  | "pullback_zone_two_closes"
  | "pullback_zone_interaction"
  | "pullback_zone_malformed"
  | "volume_median_bad"
  | "volume_ratio"
  | "extension_cap"
  | "depth_cap"
  | "stop_structure"
  | "unknown";

/**
 * Stable Gate 2 terminal rejection codes (persisted on evaluations / scan diagnostics).
 * Category keys remain `TerminalCategory` strings for backward-compatible scan notes buckets.
 */
export const GATE2_REJECTION_CODES = [
  "insufficient_bars",
  "stale_or_session_mismatch",
  "ma_compute",
  "trend_below_ma50",
  "trend_ma20_below_ma50",
  "breakout_recency",
  "digestion",
  "breakout_not_holding",
  "mid_pullback_below_ma50",
  "swept_breakout_weak_close",
  "pullback_zone_two_closes",
  "pullback_zone_interaction",
  "pullback_zone_malformed",
  "volume_median_bad",
  "volume_ratio",
  "extension_cap",
  "depth_cap",
  "stop_structure",
] as const;

export type Gate2RejectionCode = (typeof GATE2_REJECTION_CODES)[number];

export function isGate2RejectionCode(value: string): value is Gate2RejectionCode {
  return (GATE2_REJECTION_CODES as readonly string[]).includes(value);
}

/** Maps stable code → legacy terminal category bucket (1:1 for known codes). */
export function rejectionCodeToCategory(code: Gate2RejectionCode): TerminalCategory {
  return code;
}

const CATEGORY_STAGE_RANK: Record<TerminalCategory, number> = {
  insufficient_bars: 5,
  stale_or_session_mismatch: 8,
  ma_compute: 10,
  trend_below_ma50: 15,
  trend_ma20_below_ma50: 18,
  breakout_recency: 25,
  digestion: 32,
  breakout_not_holding: 38,
  mid_pullback_below_ma50: 42,
  swept_breakout_weak_close: 46,
  pullback_zone_two_closes: 52,
  pullback_zone_interaction: 58,
  pullback_zone_malformed: 59,
  volume_median_bad: 62,
  volume_ratio: 72,
  extension_cap: 80,
  depth_cap: 84,
  stop_structure: 88,
  unknown: 0,
};

export function rejectionCodeStageRank(code: Gate2RejectionCode): number {
  return CATEGORY_STAGE_RANK[rejectionCodeToCategory(code)];
}

/** Infer code from human-readable terminal line (legacy scans / external callers). */
export function inferGate2RejectionCodeFromMessage(msg: string): Gate2RejectionCode | null {
  const r = msg;
  if (r.includes("Need at least 50 daily bars")) return "insufficient_bars";
  if (r.includes("does not match expected session")) return "stale_or_session_mismatch";
  if (r.includes("Could not compute MA20/MA50")) return "ma_compute";
  if (r.includes("Trend not supportive for long swings")) return "trend_below_ma50";
  if (r.includes("Intermediate trend weaker than slow trend")) return "trend_ma20_below_ma50";
  if (r.includes("No qualifying breakout in the last")) return "breakout_recency";
  if (r.includes("Need a digestion dip after the impulse")) return "digestion";
  if (r.includes("Setup failed—session closed back under resistance")) return "breakout_not_holding";
  if (r.includes("Mid-pullback close dipped under the 50-day line")) return "mid_pullback_below_ma50";
  if (r.includes("Lower lows vs the breakout session")) return "swept_breakout_weak_close";
  if (r.includes("Two closes in a row under the pullback zone floor")) return "pullback_zone_two_closes";
  if (r.includes("Current bar does not interact with the pullback box")) return "pullback_zone_interaction";
  if (r.includes("Pullback zone is malformed")) return "pullback_zone_malformed";
  if (r.includes("Cannot score participation") || r.includes("median volume over the prior 20")) {
    return "volume_median_bad";
  }
  if (r.includes("Participation too thin")) return "volume_ratio";
  if (r.includes("above the breakout level") && r.includes("swing cap")) return "extension_cap";
  if (r.includes("max depth under the breakout")) return "depth_cap";
  if (
    r.includes("Stop would be at or above entry") ||
    r.includes("Entry→stop distance") ||
    r.includes("Incomplete setup") ||
    r.includes("no actionable downside anchor")
  ) {
    return "stop_structure";
  }
  return null;
}

export function structuralErrorToRejectionCode(msg: string): Gate2RejectionCode {
  if (msg.includes("malformed")) return "pullback_zone_malformed";
  return "stop_structure";
}

export type ResolvedTerminalClassification = {
  code: Gate2RejectionCode | null;
  category: TerminalCategory;
  stageRank: number;
};

/** Prefer persisted `terminalCode`; fall back to message inference for old evaluations. */
export function resolveTerminalClassification(params: {
  terminalCode?: Gate2RejectionCode | null;
  terminalMessage: string;
}): ResolvedTerminalClassification {
  const code =
    params.terminalCode ??
    (params.terminalMessage ? inferGate2RejectionCodeFromMessage(params.terminalMessage) : null);

  if (code) {
    const category = rejectionCodeToCategory(code);
    return { code, category, stageRank: CATEGORY_STAGE_RANK[category] };
  }

  return {
    code: null,
    category: "unknown" as TerminalCategory,
    stageRank: CATEGORY_STAGE_RANK.unknown,
  };
}
