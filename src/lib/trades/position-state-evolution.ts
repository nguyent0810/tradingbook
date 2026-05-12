/**
 * Lightweight OPEN position evolution label — same-visit observables only.
 * No probability scores; ordered rule stack (first match wins).
 */

import type { EodReviewSurface, StopPriceBand } from "@/lib/trades/open-position-intelligence";
import type { OperatingPosture } from "@/lib/trades/operating-posture";
import type { ReviewOutcomeId } from "@/lib/trades/review-outcome";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";

export type PositionEvolutionState =
  | "stable_reviewed"
  | "stabilizing"
  | "recovering"
  | "persistent_pressure"
  | "deteriorating";

export const POSITION_EVOLUTION_TRADER_LABEL: Record<
  PositionEvolutionState,
  string
> = {
  stable_reviewed: "Stable reviewed",
  stabilizing: "Stabilizing",
  recovering: "Recovering",
  persistent_pressure: "Persistent pressure",
  deteriorating: "Deteriorating",
};

export type PositionEvolutionInput = {
  operatingPosture: OperatingPosture;
  reviewedToday: boolean;
  stopBand: StopPriceBand;
  surface: EodReviewSurface;
  marketDataStale: boolean;
  deterioratedVsReview: boolean;
  escalationCueCount: number;
  priorityTier: ReviewPriorityTier;
  latestReviewOutcome: ReviewOutcomeId | null;
};

export function derivePositionEvolution(
  input: PositionEvolutionInput
): { state: PositionEvolutionState; explainLine: string | null } {
  const {
    operatingPosture,
    reviewedToday,
    stopBand,
    surface,
    marketDataStale,
    deterioratedVsReview,
    escalationCueCount,
    priorityTier,
    latestReviewOutcome,
  } = input;

  const breachedOrViolated =
    stopBand === "breached" || surface === "stop_violated";

  if (
    breachedOrViolated ||
    deterioratedVsReview ||
    latestReviewOutcome === "exit_thesis_under_review" ||
    (surface === "structure_weakening" && escalationCueCount >= 1)
  ) {
    return {
      state: "deteriorating",
      explainLine: breachedOrViolated
        ? "Daily stop context reads stressed vs latest bar."
        : deterioratedVsReview
          ? "Latest close drifted adverse vs the bar anchored at your last checkpoint."
          : "Structure or exit-review signals still read elevated on this scan.",
    };
  }

  const pressureWithoutCheckpoint =
    !reviewedToday &&
    (priorityTier === "urgent" ||
      priorityTier === "high_attention" ||
      (marketDataStale && escalationCueCount >= 1) ||
      latestReviewOutcome === "reduce_risk_candidate");

  if (pressureWithoutCheckpoint) {
    return {
      state: "persistent_pressure",
      explainLine:
        priorityTier === "urgent" || priorityTier === "high_attention"
          ? "Queue tier is elevated and today’s checkpoint is still pending."
          : "Stale or scan cues remain while today’s checkpoint is pending.",
    };
  }

  if (
    reviewedToday &&
    operatingPosture === "stable" &&
    stopBand === "comfortable" &&
    !deterioratedVsReview
  ) {
    return {
      state: "stable_reviewed",
      explainLine:
        "Checkpoint logged today with comfortable stop context on latest bar.",
    };
  }

  if (
    reviewedToday &&
    (latestReviewOutcome === "holding_as_planned" ||
      latestReviewOutcome === "monitoring_closely") &&
    !deterioratedVsReview &&
    escalationCueCount === 0
  ) {
    return {
      state: "recovering",
      explainLine:
        "Today’s outcome reads constructive and escalation cues are quiet on this scan.",
    };
  }

  if (
    reviewedToday &&
    operatingPosture === "cautious" &&
    !deterioratedVsReview &&
    escalationCueCount <= 1
  ) {
    return {
      state: "stabilizing",
      explainLine:
        "Checkpoint is in while the scan still reads cautious — watch the next bar.",
    };
  }

  if (reviewedToday) {
    return {
      state: "stabilizing",
      explainLine:
        "Checkpoint logged; posture still mixed — keep notes aligned with the scan.",
    };
  }

  return {
    state: "persistent_pressure",
    explainLine:
      "Routine attention — log today’s checkpoint when you reconcile the bar.",
  };
}
