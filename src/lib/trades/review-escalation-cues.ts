/**
 * Cross-sectional “escalation” cues from one snapshot only — no stored history.
 * Wording stays observational, not predictive.
 */

import type { EodReviewSurface } from "@/lib/trades/open-position-intelligence";
import type { StopPriceBand } from "@/lib/trades/open-position-intelligence";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";

const MAX_CUES = 2;

export function deriveEscalationCues(params: {
  priorityTier: ReviewPriorityTier;
  stopBand: StopPriceBand;
  surface: EodReviewSurface;
  marketDataStale: boolean;
  reviewedToday: boolean;
  deterioratedVsReview: boolean;
  failedBreakoutHold: boolean;
}): string[] {
  const cues: string[] = [];

  const stopBreached =
    params.surface === "stop_violated" || params.stopBand === "breached";

  if (stopBreached && !params.reviewedToday) {
    cues.push(
      "Daily close through planned stop — today's checkpoint still open."
    );
  }

  if (
    params.priorityTier === "routine_review" &&
    !stopBreached &&
    cues.length < MAX_CUES
  ) {
    cues.push("Today's checkpoint not logged yet.");
  }

  if (
    params.marketDataStale &&
    !params.reviewedToday &&
    !stopBreached &&
    cues.length < MAX_CUES
  ) {
    cues.push("Stale tape — reconcile bars before leaning on levels.");
  }

  if (
    params.failedBreakoutHold &&
    !params.reviewedToday &&
    cues.length < MAX_CUES
  ) {
    cues.push("Price lost the breakout anchor — checkpoint still open.");
  }

  if (
    params.deterioratedVsReview &&
    params.stopBand === "tight" &&
    cues.length < MAX_CUES
  ) {
    cues.push("Close softer vs last checkpoint while tight vs stop.");
  }

  if (
    params.priorityTier === "high_attention" &&
    params.reviewedToday &&
    params.deterioratedVsReview &&
    cues.length < MAX_CUES
  ) {
    cues.push("Tape softened vs last checkpoint since you logged today.");
  }

  if (
    params.priorityTier === "stable" &&
    params.marketDataStale &&
    cues.length < MAX_CUES
  ) {
    cues.push(
      "Marked stable on checkpoints — equity bar still behind benchmark."
    );
  }

  const seen = new Set<string>();
  return cues.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  }).slice(0, MAX_CUES);
}
