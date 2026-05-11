/**
 * Lightweight copy for review continuity — no journaling store.
 * Uses latest checkpoint time, last checklist snapshot, and weekly rollups when present.
 */

import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";
import type { WeeklyReviewChecklistAgg } from "@/lib/trades/review-priority-queue";

export type ReviewContinuityInput = {
  now: Date;
  checkedToday: boolean;
  lastCheckpointAt: Date | null;
  latestChecklist: EodReviewChecklistState | null;
  /** When undefined, weekly gap lines are omitted (unknown vs false). */
  weekFlags: WeeklyReviewChecklistAgg | undefined;
};

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = startOfLocalDay(earlier);
  const b = startOfLocalDay(later);
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/**
 * Short, operational lines for the focus workspace (max ~4 bullets).
 */
export function buildReviewContinuityLines(
  input: ReviewContinuityInput
): string[] {
  const { now, checkedToday, lastCheckpointAt, latestChecklist, weekFlags } =
    input;
  const lines: string[] = [];

  if (checkedToday) {
    lines.push("Checkpoint logged today.");
  } else if (lastCheckpointAt == null) {
    lines.push("No health checkpoint on record yet for this position.");
  } else {
    const days = calendarDaysBetween(lastCheckpointAt, now);
    if (days <= 0) {
      lines.push("Last checkpoint is dated today (local).");
    } else if (days === 1) {
      lines.push("Last reviewed yesterday.");
    } else {
      lines.push(`Last reviewed ${days} days ago.`);
    }

    if (days >= 1 && days <= 2 && latestChecklist?.exitPlanReviewed) {
      lines.push(
        days === 1
          ? "Exit plan was checked at that checkpoint."
          : "Exit plan was checked at the most recent checkpoint."
      );
    }
  }

  if (weekFlags) {
    const gaps: string[] = [];
    if (!weekFlags.stopMarkedThisWeek) gaps.push("stop");
    if (!weekFlags.structureMarkedThisWeek) gaps.push("structure");
    if (!weekFlags.exitPlanMarkedThisWeek) gaps.push("exit plan");
    if (gaps.length > 0 && lines.length < 5) {
      if (gaps.length === 3) {
        lines.push(
          "No stop, structure, or exit plan checklist review recorded this week."
        );
      } else if (gaps.length === 2) {
        lines.push(
          `No ${gaps[0]} or ${gaps[1]} checklist review recorded this week.`
        );
      } else {
        lines.push(
          `No ${gaps[0]} checklist review recorded this week.`
        );
      }
    }
  }

  return lines.slice(0, 4);
}
