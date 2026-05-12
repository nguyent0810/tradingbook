/**
 * Book-level balance lines from posture, attention clusters, concentration, and prior snapshot.
 * Deterministic; no forecasts.
 */

import type {
  BookPostureCounts,
  PlannedRiskConcentration,
} from "@/lib/trades/book-operating-context";
import {
  assignBookAttentionCluster,
  type BookAttentionClusterId,
} from "@/lib/trades/book-clusters";
import type { OperatingPosture } from "@/lib/trades/operating-posture";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";

export type BookClusterCounts = Record<BookAttentionClusterId, number>;

export type BookOperatingBalanceInput = {
  activeOpenCount: number;
  postureCounts: BookPostureCounts;
  clusterCounts: BookClusterCounts;
  concentration: PlannedRiskConcentration;
  previousStableClusterCount: number | null;
};

export function deriveBookOperatingBalanceLines(
  input: BookOperatingBalanceInput
): string[] {
  const {
    activeOpenCount,
    postureCounts,
    clusterCounts,
    concentration,
    previousStableClusterCount,
  } = input;

  if (activeOpenCount <= 0) return [];

  const lines: string[] = [];

  const defHa =
    postureCounts.defensive + postureCounts.high_attention;
  const defHaCluster =
    (clusterCounts.defensive ?? 0) + (clusterCounts.high_attention ?? 0);

  if (
    activeOpenCount >= 3 &&
    defHa >= Math.ceil(activeOpenCount * 0.45)
  ) {
    lines.push(
      "Defensive and high-attention posture rows dominate the open book on this scan."
    );
  } else if (
    activeOpenCount >= 3 &&
    defHaCluster >= Math.ceil(activeOpenCount * 0.4)
  ) {
    lines.push(
      "Attention clusters skew defensive / high-attention versus stable reviewed rows."
    );
  }

  const stableCluster = clusterCounts.stable_reviewed ?? 0;
  if (
    activeOpenCount >= 3 &&
    stableCluster >= Math.ceil(activeOpenCount * 0.5) &&
    defHa <= Math.floor(activeOpenCount * 0.25)
  ) {
    lines.push(
      "Healthy balance on this pass — most open rows sit in stable reviewed cluster."
    );
  }

  if (
    previousStableClusterCount != null &&
    stableCluster < previousStableClusterCount - 1 &&
    activeOpenCount >= 3
  ) {
    lines.push(
      "Stable reviewed cluster shrank versus your last ledger visit snapshot."
    );
  }

  if (
    concentration.countWithRisk >= 2 &&
    concentration.top2Share != null &&
    concentration.top2Share >= 0.65 &&
    concentration.top1Symbol &&
    concentration.top2Symbol
  ) {
    lines.push(
      `Operational pressure is concentrated in ${concentration.top1Symbol} and ${concentration.top2Symbol} vs summed planned at-risk rows (where computable).`
    );
  }

  return dedupe(lines).slice(0, 2);
}

function dedupe(lines: string[]): string[] {
  const s = new Set<string>();
  return lines.filter((l) => {
    if (s.has(l)) return false;
    s.add(l);
    return true;
  });
}

export function countBookAttentionClusters(params: {
  packs: ReadonlyArray<{
    tradeId: string;
    operatingPosture: OperatingPosture;
    priorityTier: ReviewPriorityTier;
  }>;
  reviewedTodayTradeIds: ReadonlySet<string>;
}): BookClusterCounts {
  const z: BookClusterCounts = {
    high_attention: 0,
    defensive: 0,
    cautious: 0,
    routine_pending: 0,
    stable_reviewed: 0,
  };

  for (const p of params.packs) {
    const cl = assignBookAttentionCluster({
      operatingPosture: p.operatingPosture,
      priorityTier: p.priorityTier,
      reviewedToday: params.reviewedTodayTradeIds.has(p.tradeId),
    });
    z[cl] += 1;
  }
  return z;
}
