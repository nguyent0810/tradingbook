/**
 * Lightweight ordering for sequential daily review — no task DB.
 */

import {
  compareOpenLedgerReviewOrder,
  type OpenLedgerReviewOrder,
} from "@/lib/trades/review-priority-queue";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";

export type ReviewSessionPackSortInput = {
  tradeId: string;
  priorityTier: ReviewPriorityTier;
  reviewedToday: boolean;
  sortKey: OpenLedgerReviewOrder;
};

function tierSessionRank(t: ReviewPriorityTier): number {
  if (t === "urgent") return 0;
  if (t === "high_attention") return 1;
  if (t === "routine_review") return 2;
  return 999;
}

/** OPEN positions excluding stable — pending checkpoint sorts above handled today within each tier. */
export function buildReviewSessionQueue(
  packs: readonly ReviewSessionPackSortInput[]
): string[] {
  const filtered = packs.filter((p) => p.priorityTier !== "stable");
  const sorted = [...filtered].sort((a, b) => {
    const ra = tierSessionRank(a.priorityTier);
    const rb = tierSessionRank(b.priorityTier);
    if (ra !== rb) return ra - rb;
    if (a.reviewedToday !== b.reviewedToday) {
      return a.reviewedToday ? 1 : -1;
    }
    return compareOpenLedgerReviewOrder(a.sortKey, b.sortKey);
  });
  return sorted.map((p) => p.tradeId);
}

export function resolveReviewSessionFocus(
  queue: readonly string[],
  requestedFocusId: string | null | undefined
): { focusId: string | null; focusIndex: number } {
  if (queue.length === 0) return { focusId: null, focusIndex: -1 };
  if (requestedFocusId && queue.includes(requestedFocusId)) {
    return {
      focusId: requestedFocusId,
      focusIndex: queue.indexOf(requestedFocusId),
    };
  }
  return { focusId: queue[0], focusIndex: 0 };
}

export function sessionQueueNeighbors(
  queue: readonly string[],
  focusIndex: number
): { prevId: string | null; nextId: string | null } {
  if (focusIndex < 0 || queue.length === 0) {
    return { prevId: null, nextId: null };
  }
  const prevId = focusIndex > 0 ? queue[focusIndex - 1] : null;
  const nextId =
    focusIndex < queue.length - 1 ? queue[focusIndex + 1] : null;
  return { prevId, nextId };
}

export type ReviewSessionDashboardCounts = {
  /** Urgent-tier OPEN trades still missing today's checkpoint. */
  urgentPendingGlobal: number;
  /** OPEN trades missing today's checkpoint. */
  pendingCheckpointGlobal: number;
  /** Session queue items after current index still missing checkpoint. */
  pendingAheadInQueue: number;
};

export function computeReviewSessionDashboardCounts(params: {
  sessionQueue: readonly string[];
  focusIndex: number;
  tierByTradeId: ReadonlyMap<string, ReviewPriorityTier>;
  reviewedTodayTradeIds: ReadonlySet<string>;
  allOpenTradeIds: readonly string[];
}): ReviewSessionDashboardCounts {
  const {
    sessionQueue,
    focusIndex,
    tierByTradeId,
    reviewedTodayTradeIds,
    allOpenTradeIds,
  } = params;

  let urgentPendingGlobal = 0;
  let pendingCheckpointGlobal = 0;

  for (const id of allOpenTradeIds) {
    const reviewed = reviewedTodayTradeIds.has(id);
    if (!reviewed) {
      pendingCheckpointGlobal += 1;
      if (tierByTradeId.get(id) === "urgent") {
        urgentPendingGlobal += 1;
      }
    }
  }

  let pendingAheadInQueue = 0;
  if (focusIndex < 0) {
    for (const id of sessionQueue) {
      if (!reviewedTodayTradeIds.has(id)) pendingAheadInQueue += 1;
    }
  } else {
    for (let i = focusIndex + 1; i < sessionQueue.length; i++) {
      const id = sessionQueue[i];
      if (!reviewedTodayTradeIds.has(id)) pendingAheadInQueue += 1;
    }
  }

  return {
    urgentPendingGlobal,
    pendingCheckpointGlobal,
    pendingAheadInQueue,
  };
}

export type TradeRowLite = { id: string; status: string };

/** OPEN rows follow session queue order; stable OPEN after queued; non-OPEN unchanged tail. */
export function sortTradesForReviewSession<T extends TradeRowLite>(
  trades: readonly T[],
  sessionQueue: readonly string[]
): T[] {
  if (sessionQueue.length === 0) return [...trades];

  const queuePos = new Map(sessionQueue.map((id, i) => [id, i] as const));
  const opens = trades.filter((t) => t.status === "OPEN");
  const rest = trades.filter((t) => t.status !== "OPEN");

  opens.sort((a, b) => {
    const ia = queuePos.has(a.id) ? queuePos.get(a.id)! : 900_000;
    const ib = queuePos.has(b.id) ? queuePos.get(b.id)! : 900_000;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id);
  });

  return [...opens, ...rest];
}
