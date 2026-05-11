/**
 * Visual / ordering clusters for OPEN rows — deterministic, no scoring.
 */

import type { OperatingPosture } from "@/lib/trades/operating-posture";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";
import { compareOpenLedgerReviewOrder } from "@/lib/trades/review-priority-queue";
import type { OpenLedgerReviewOrder } from "@/lib/trades/review-priority-queue";

export type BookAttentionClusterId =
  | "high_attention"
  | "defensive"
  | "cautious"
  | "routine_pending"
  | "stable_reviewed";

export const BOOK_ATTENTION_CLUSTER_ORDER: readonly BookAttentionClusterId[] = [
  "high_attention",
  "defensive",
  "cautious",
  "routine_pending",
  "stable_reviewed",
] as const;

export const BOOK_ATTENTION_CLUSTER_LABEL: Record<BookAttentionClusterId, string> = {
  high_attention: "High attention",
  defensive: "Defensive posture",
  cautious: "Cautious / needs scan",
  routine_pending: "Routine reviews pending",
  stable_reviewed: "Stable · reviewed today",
};

export function assignBookAttentionCluster(params: {
  operatingPosture: OperatingPosture;
  priorityTier: ReviewPriorityTier;
  reviewedToday: boolean;
}): BookAttentionClusterId {
  if (params.priorityTier === "routine_review" && !params.reviewedToday) {
    return "routine_pending";
  }
  switch (params.operatingPosture) {
    case "high_attention":
      return "high_attention";
    case "defensive":
      return "defensive";
    case "cautious":
      return "cautious";
    case "stable":
      return "stable_reviewed";
    default:
      return "cautious";
  }
}

export type TradeRowLite = { id: string; status: string };

type PackLite = {
  operatingPosture: OperatingPosture;
  priorityTier: ReviewPriorityTier;
  sortKey: OpenLedgerReviewOrder;
};

/** OPEN rows first: cluster order, then session queue index or ledger review order. */
export function sortTradesWithBookClusters<T extends TradeRowLite>(
  trades: readonly T[],
  openPacks: ReadonlyMap<string, PackLite>,
  reviewedTodayTradeIds: ReadonlySet<string>,
  opts: { sessionActive: boolean; sessionQueue: readonly string[] }
): T[] {
  const queueIndex = new Map(
    opts.sessionQueue.map((id, i) => [id, i] as const)
  );

  function clusterOf(t: T): BookAttentionClusterId | null {
    if (t.status !== "OPEN") return null;
    const pack = openPacks.get(t.id);
    if (!pack) return null;
    return assignBookAttentionCluster({
      operatingPosture: pack.operatingPosture,
      priorityTier: pack.priorityTier,
      reviewedToday: reviewedTodayTradeIds.has(t.id),
    });
  }

  const opens = trades.filter((t) => t.status === "OPEN");
  const rest = trades.filter((t) => t.status !== "OPEN");

  opens.sort((a, b) => {
    const ca = clusterOf(a);
    const cb = clusterOf(b);
    const ia =
      ca != null ? BOOK_ATTENTION_CLUSTER_ORDER.indexOf(ca) : 999;
    const ib =
      cb != null ? BOOK_ATTENTION_CLUSTER_ORDER.indexOf(cb) : 999;
    if (ia !== ib) return ia - ib;

    const pa = openPacks.get(a.id);
    const pb = openPacks.get(b.id);
    if (opts.sessionActive) {
      const qa = queueIndex.get(a.id) ?? 999_000;
      const qb = queueIndex.get(b.id) ?? 999_000;
      if (qa !== qb) return qa - qb;
    }
    if (pa && pb) {
      const c = compareOpenLedgerReviewOrder(pa.sortKey, pb.sortKey);
      if (c !== 0) return c;
    } else if (pa && !pb) return -1;
    else if (!pa && pb) return 1;
    return a.id.localeCompare(b.id);
  });

  return [...opens, ...rest];
}

/** Inserts a single muted header row when the attention cluster changes (OPEN rows only). */
export function expandClusterDividerRows<T extends TradeRowLite>(
  trades: readonly T[],
  enabled: boolean,
  openPacks: ReadonlyMap<string, PackLite>,
  reviewedTodayTradeIds: ReadonlySet<string>
): Array<T | { kind: "divider"; label: string }> {
  if (!enabled) return [...trades];

  const out: Array<T | { kind: "divider"; label: string }> = [];
  let prev: BookAttentionClusterId | null = null;

  for (const trade of trades) {
    if (trade.status !== "OPEN") {
      out.push(trade);
      continue;
    }
    const pack = openPacks.get(trade.id);
    if (!pack) {
      out.push(trade);
      continue;
    }
    const cl = assignBookAttentionCluster({
      operatingPosture: pack.operatingPosture,
      priorityTier: pack.priorityTier,
      reviewedToday: reviewedTodayTradeIds.has(trade.id),
    });
    if (prev !== cl) {
      out.push({
        kind: "divider",
        label: BOOK_ATTENTION_CLUSTER_LABEL[cl],
      });
    }
    out.push(trade);
    prev = cl;
  }

  return out;
}

