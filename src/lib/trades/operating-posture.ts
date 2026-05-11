/**
 * Deterministic operating posture for OPEN rows — explainable, no forecasts.
 * Combines daily geometry, escalation cues, logged review outcome, and review freshness.
 */

import type { EodReviewSurface, StopPriceBand } from "@/lib/trades/open-position-intelligence";
import type { ReviewOutcomeId } from "@/lib/trades/review-outcome";

export type OperatingPosture =
  | "stable"
  | "cautious"
  | "defensive"
  | "high_attention";

export const OPERATING_POSTURE_TRADER_LABEL: Record<OperatingPosture, string> = {
  stable: "Stable",
  cautious: "Cautious",
  defensive: "Defensive",
  high_attention: "High attention",
};

export type OperatingPostureInput = {
  stopBand: StopPriceBand;
  surface: EodReviewSurface;
  marketDataStale: boolean;
  reviewedToday: boolean;
  /** From latest `trade_health_logs` row only — never inferred. */
  latestReviewOutcome: ReviewOutcomeId | null;
  escalationCueCount: number;
};

/**
 * Single-pass rule stack: first matching branch sets posture (most severe wins).
 * `explainLines` are short, factual strings for the workspace (max 2).
 */
export function deriveOperatingPosture(
  input: OperatingPostureInput
): { posture: OperatingPosture; explainLines: string[] } {
  const {
    stopBand,
    surface,
    marketDataStale,
    reviewedToday,
    latestReviewOutcome,
    escalationCueCount,
  } = input;

  const lines: string[] = [];

  if (stopBand === "breached" || surface === "stop_violated") {
    lines.push("Planned stop context vs latest daily bar reads breached or invalidating.");
    return { posture: "high_attention", explainLines: lines.slice(0, 2) };
  }

  if (latestReviewOutcome === "exit_thesis_under_review") {
    lines.push("Latest checkpoint outcome: exit thesis under review.");
    return { posture: "high_attention", explainLines: lines.slice(0, 2) };
  }

  if (latestReviewOutcome === "reduce_risk_candidate") {
    lines.push("Latest checkpoint outcome: reduce-risk candidate.");
    return { posture: "defensive", explainLines: lines.slice(0, 2) };
  }

  if (
    surface === "structure_weakening" ||
    latestReviewOutcome === "structure_weakening"
  ) {
    lines.push(
      latestReviewOutcome === "structure_weakening"
        ? "Latest checkpoint outcome: structure weakening."
        : "Daily surface flags structure weakening."
    );
    return { posture: "defensive", explainLines: lines.slice(0, 2) };
  }

  if (marketDataStale && !reviewedToday) {
    lines.push("Market data is stale vs benchmark and today’s checkpoint is pending.");
    return { posture: "cautious", explainLines: lines.slice(0, 2) };
  }

  if (stopBand === "tight" || surface === "under_pressure") {
    lines.push("Stop band is tight or the daily surface reads under pressure.");
    return { posture: "cautious", explainLines: lines.slice(0, 2) };
  }

  if (latestReviewOutcome === "monitoring_closely") {
    lines.push("Latest checkpoint outcome: monitoring closely.");
    return { posture: "cautious", explainLines: lines.slice(0, 2) };
  }

  if (surface === "stale_bar_review" || surface === "review_needed") {
    lines.push("Daily review surface still expects attention or fresher bar context.");
    return { posture: "cautious", explainLines: lines.slice(0, 2) };
  }

  if (
    reviewedToday &&
    stopBand === "comfortable" &&
    escalationCueCount === 0 &&
    (surface === "review_completed" ||
      latestReviewOutcome === "holding_as_planned")
  ) {
    lines.push("Today’s checkpoint logged with comfortable stop context.");
    return { posture: "stable", explainLines: lines.slice(0, 2) };
  }

  if (escalationCueCount >= 1) {
    lines.push("Escalation cues are present from the current scan rules.");
    return { posture: "cautious", explainLines: lines.slice(0, 2) };
  }

  lines.push("Default cautious posture until review and data fully align.");
  return { posture: "cautious", explainLines: lines.slice(0, 2) };
}
