/**
 * Deterministic review priority + ledger ordering for OPEN trades — daily context only.
 * No scores, probabilities, or trade suggestions.
 */

import type { EodReviewSurface, StopPriceBand } from "@/lib/trades/open-position-intelligence";
import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";

/** Matches noise gate used for session/review deltas. */
export const REVIEW_DRIFT_EPS = 0.00025;

export type ReviewPriorityTier =
  | "urgent"
  | "high_attention"
  | "routine_review"
  | "stable";

export type WeeklyReviewChecklistAgg = {
  stopMarkedThisWeek: boolean;
  structureMarkedThisWeek: boolean;
  exitPlanMarkedThisWeek: boolean;
};

/** Latest bar worse vs baseline anchored at last checkpoint session (direction-aware). */
export function deterioratedVsLastReviewBar(params: {
  direction: "LONG" | "SHORT";
  latestClose: number | null;
  baselineClose: number | null;
}): boolean {
  const { direction, latestClose, baselineClose } = params;
  if (
    latestClose == null ||
    baselineClose == null ||
    !Number.isFinite(latestClose) ||
    !Number.isFinite(baselineClose) ||
    baselineClose <= 0
  ) {
    return false;
  }
  const rel = (latestClose - baselineClose) / baselineClose;
  if (Math.abs(rel) < REVIEW_DRIFT_EPS) return false;
  return direction === "LONG" ? rel < 0 : rel > 0;
}

export function classifyReviewPriorityTier(params: {
  surface: EodReviewSurface;
  stopBand: StopPriceBand;
  structureHints: readonly string[];
  marketDataStale: boolean;
  reviewedToday: boolean;
  deterioratedVsReview: boolean;
}): ReviewPriorityTier {
  const urgent =
    params.surface === "stop_violated" || params.stopBand === "breached";
  if (urgent) return "urgent";

  const highAttention =
    params.surface === "structure_weakening" ||
    params.surface === "under_pressure" ||
    params.surface === "stale_bar_review" ||
    params.marketDataStale ||
    params.structureHints.includes("failed_breakout_hold") ||
    params.deterioratedVsReview;

  if (highAttention) return "high_attention";

  if (!params.reviewedToday) return "routine_review";

  return "stable";
}

export function reviewPriorityTraderLabel(tier: ReviewPriorityTier): string {
  switch (tier) {
    case "urgent":
      return "Urgent";
    case "high_attention":
      return "High attention";
    case "routine_review":
      return "Routine review";
    default:
      return "Stable";
  }
}

export type OpenLedgerReviewOrder = {
  tradeId: string;
  symbol: string;
  urgent: boolean;
  underPressureFlag: boolean;
  deterioratedFlag: boolean;
  staleOrPendingFlag: boolean;
  plannedRisk: number | null;
};

export function buildOpenLedgerReviewOrder(params: {
  tradeId: string;
  symbol: string;
  surface: EodReviewSurface;
  stopBand: StopPriceBand;
  structureHints: readonly string[];
  marketDataStale: boolean;
  reviewedToday: boolean;
  plannedCapitalAtRisk: number | null;
  deterioratedVsReview: boolean;
}): OpenLedgerReviewOrder {
  const urgent =
    params.surface === "stop_violated" || params.stopBand === "breached";

  const underPressureFlag =
    params.stopBand === "tight" ||
    params.surface === "under_pressure" ||
    params.surface === "structure_weakening" ||
    params.structureHints.includes("failed_breakout_hold");

  const staleOrPendingFlag =
    params.marketDataStale ||
    !params.reviewedToday ||
    params.surface === "stale_bar_review";

  return {
    tradeId: params.tradeId,
    symbol: params.symbol.trim().toUpperCase(),
    urgent,
    underPressureFlag,
    deterioratedFlag: params.deterioratedVsReview,
    staleOrPendingFlag,
    plannedRisk: params.plannedCapitalAtRisk,
  };
}

/** Stable ordering: urgent → pressure → drift vs review → stale/pending → larger planned risk → symbol → id. */
export function compareOpenLedgerReviewOrder(
  a: OpenLedgerReviewOrder,
  b: OpenLedgerReviewOrder
): number {
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;

  if (a.underPressureFlag !== b.underPressureFlag) {
    return a.underPressureFlag ? -1 : 1;
  }

  if (a.deterioratedFlag !== b.deterioratedFlag) {
    return a.deterioratedFlag ? -1 : 1;
  }

  if (a.staleOrPendingFlag !== b.staleOrPendingFlag) {
    return a.staleOrPendingFlag ? -1 : 1;
  }

  const ra = a.plannedRisk;
  const rb = b.plannedRisk;
  if (ra != null || rb != null) {
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    if (ra != null && rb == null) return -1;
    if (ra == null && rb != null) return 1;
  }

  const sym = a.symbol.localeCompare(b.symbol);
  if (sym !== 0) return sym;

  return a.tradeId.localeCompare(b.tradeId);
}

export type ReviewQueueSymbol = { tradeId: string; symbol: string };

export type ReviewQueueModel = {
  /** Sorted within each bucket using `compareOpenLedgerReviewOrder`. */
  urgent: ReviewQueueSymbol[];
  highAttention: ReviewQueueSymbol[];
  routinePending: ReviewQueueSymbol[];
  staleMarket: ReviewQueueSymbol[];
};

export function buildReviewQueueModel(
  rows: readonly {
    sortKey: OpenLedgerReviewOrder;
    priorityTier: ReviewPriorityTier;
    marketDataStale: boolean;
  }[]
): ReviewQueueModel {
  const keyById = new Map(
    rows.map((r) => [r.sortKey.tradeId, r.sortKey] as const)
  );

  function bucket(tier: ReviewPriorityTier): ReviewQueueSymbol[] {
    return rows
      .filter((r) => r.priorityTier === tier)
      .map((r) => ({
        tradeId: r.sortKey.tradeId,
        symbol: r.sortKey.symbol,
      }))
      .sort((a, b) =>
        compareOpenLedgerReviewOrder(
          keyById.get(a.tradeId)!,
          keyById.get(b.tradeId)!
        )
      );
  }

  const staleMarket = rows
    .filter((r) => r.marketDataStale)
    .map((r) => ({
      tradeId: r.sortKey.tradeId,
      symbol: r.sortKey.symbol,
    }))
    .sort((a, b) =>
      compareOpenLedgerReviewOrder(
        keyById.get(a.tradeId)!,
        keyById.get(b.tradeId)!
      )
    );

  return {
    urgent: bucket("urgent"),
    highAttention: bucket("high_attention"),
    routinePending: bucket("routine_review"),
    staleMarket,
  };
}

const MAX_MEMORY_LINES = 3;

export function buildReviewMemoryLines(params: {
  reviewedToday: boolean;
  latestChecklist: EodReviewChecklistState | null;
  weekFlags: WeeklyReviewChecklistAgg | null;
  lastCheckpointAt: Date | null;
}): string[] {
  const lines: string[] = [];
  const hasHistory = params.lastCheckpointAt != null;

  if (params.reviewedToday && params.latestChecklist?.stopReviewed) {
    lines.push("Stop reviewed today.");
  }

  if (params.reviewedToday && params.latestChecklist?.exitPlanReviewed) {
    lines.push("Exit plan noted today.");
  }

  if (
    params.weekFlags &&
    hasHistory &&
    !params.weekFlags.exitPlanMarkedThisWeek
  ) {
    lines.push("Exit plan not marked reviewed in the last 7 days.");
  }

  if (
    params.weekFlags &&
    hasHistory &&
    !params.weekFlags.structureMarkedThisWeek
  ) {
    lines.push("Structure not marked reviewed in the last 7 days.");
  }

  return lines.slice(0, MAX_MEMORY_LINES);
}
