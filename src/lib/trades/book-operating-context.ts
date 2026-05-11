/**
 * Book-level operating context — deterministic summaries, no forecasts or scores.
 */

import type { OperatingPosture } from "@/lib/trades/operating-posture";

export type BookPostureCounts = Record<OperatingPosture, number>;

export type PlannedRiskConcentration = {
  countWithRisk: number;
  /** Share of summed at-risk capital (0–1), null when not meaningful. */
  top1Share: number | null;
  top2Share: number | null;
  top1Symbol: string | null;
  top2Symbol: string | null;
  sumAtRisk: number | null;
};

export function countOperatingPostures(
  packs: ReadonlyArray<{ operatingPosture: OperatingPosture }>
): BookPostureCounts {
  const z: BookPostureCounts = {
    stable: 0,
    cautious: 0,
    defensive: 0,
    high_attention: 0,
  };
  for (const p of packs) {
    z[p.operatingPosture] += 1;
  }
  return z;
}

/**
 * Where at least two positions have finite planned capital at risk.
 */
export function computePlannedRiskConcentration(
  rows: ReadonlyArray<{ symbol: string; plannedCapitalAtRisk: number | null }>
): PlannedRiskConcentration {
  const finite = rows
    .map((r) => ({
      symbol: r.symbol.trim().toUpperCase(),
      amt: r.plannedCapitalAtRisk,
    }))
    .filter(
      (r) =>
        r.amt != null && Number.isFinite(r.amt) && (r.amt as number) > 0
    ) as { symbol: string; amt: number }[];

  if (finite.length === 0) {
    return {
      countWithRisk: 0,
      top1Share: null,
      top2Share: null,
      top1Symbol: null,
      top2Symbol: null,
      sumAtRisk: null,
    };
  }

  finite.sort((a, b) => b.amt - a.amt);
  const sum = finite.reduce((s, r) => s + r.amt, 0);
  if (!Number.isFinite(sum) || sum <= 0) {
    return {
      countWithRisk: finite.length,
      top1Share: null,
      top2Share: null,
      top1Symbol: null,
      top2Symbol: null,
      sumAtRisk: null,
    };
  }

  const top1 = finite[0]!;
  const top1Share = top1.amt / sum;
  const top2 = finite[1];
  const top2Share =
    top2 != null ? (top1.amt + top2.amt) / sum : top1Share;

  return {
    countWithRisk: finite.length,
    top1Share,
    top2Share: top2 != null ? top2Share : null,
    top1Symbol: top1.symbol,
    top2Symbol: top2?.symbol ?? null,
    sumAtRisk: sum,
  };
}

export type BookOperatingContextInput = {
  activeOpenCount: number;
  postureCounts: BookPostureCounts;
  urgentQueueCount: number;
  highAttentionQueueCount: number;
  routinePendingQueueCount: number;
  staleMarketOpenCount: number;
  stopViolationsCount: number;
  pendingCheckpointCount: number;
  partialRiskFigures: boolean;
  concentration: PlannedRiskConcentration;
};

/** Stable keys for snapshot streaks / trend logic — mirrors headline rule stack. */
export type BookOperatingHeadlineTag =
  | "no_open"
  | "elevated_pressure"
  | "stale_data"
  | "review_heavy"
  | "defensive_developing"
  | "stable"
  | "mixed";

export type BookOperatingContext = {
  headline: string;
  headlineTag: BookOperatingHeadlineTag;
  detailLines: string[];
  sessionNarrative: string;
  /** Same thresholds as headline derivation — for snapshots and trends. */
  staleHeavyCondition: boolean;
};

export type BookOperatingClassification = {
  headline: string;
  headlineTag: BookOperatingHeadlineTag;
  staleHeavyCondition: boolean;
  pressuring: boolean;
  reviewHeavy: boolean;
  defensiveDeveloping: boolean;
  stableMajority: boolean;
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function classifyBookOperatingHeadline(
  input: BookOperatingContextInput
): BookOperatingClassification {
  const {
    activeOpenCount,
    postureCounts,
    urgentQueueCount,
    highAttentionQueueCount,
    stopViolationsCount,
    pendingCheckpointCount,
    staleMarketOpenCount,
  } = input;

  const pressuring =
    urgentQueueCount + highAttentionQueueCount >= 3 ||
    urgentQueueCount >= 2;
  const staleHeavyCondition =
    activeOpenCount > 0 &&
    staleMarketOpenCount >= Math.max(2, Math.ceil(activeOpenCount * 0.25));
  const reviewHeavy =
    activeOpenCount >= 2 &&
    pendingCheckpointCount >= Math.ceil(activeOpenCount * 0.5);
  const defensiveDeveloping =
    postureCounts.defensive >= 2 ||
    postureCounts.defensive + postureCounts.high_attention >= 3;
  const stableMajority =
    activeOpenCount > 0 &&
    postureCounts.stable >= Math.ceil(activeOpenCount * 0.55) &&
    urgentQueueCount === 0 &&
    stopViolationsCount === 0;

  let headline = "Mixed book operating context";
  let headlineTag: BookOperatingHeadlineTag = "mixed";

  if (activeOpenCount === 0) {
    return {
      headline: "No open positions",
      headlineTag: "no_open",
      staleHeavyCondition: false,
      pressuring,
      reviewHeavy,
      defensiveDeveloping,
      stableMajority,
    };
  }

  if (stopViolationsCount >= 1 || urgentQueueCount >= 1) {
    headline = "Elevated review pressure";
    headlineTag = "elevated_pressure";
  } else if (staleHeavyCondition && pendingCheckpointCount >= 2) {
    headline = "Stale-data caution";
    headlineTag = "stale_data";
  } else if (reviewHeavy) {
    headline = "Review-heavy session";
    headlineTag = "review_heavy";
  } else if (pressuring) {
    headline = "Elevated review pressure";
    headlineTag = "elevated_pressure";
  } else if (defensiveDeveloping) {
    headline = "Defensive posture developing";
    headlineTag = "defensive_developing";
  } else if (stableMajority && pendingCheckpointCount <= 1) {
    headline = "Stable operating posture";
    headlineTag = "stable";
  }

  return {
    headline,
    headlineTag,
    staleHeavyCondition,
    pressuring,
    reviewHeavy,
    defensiveDeveloping,
    stableMajority,
  };
}

/**
 * Ordered rule stack for book headline + short lines. No randomness.
 */
export function deriveBookOperatingContext(
  input: BookOperatingContextInput
): BookOperatingContext {
  const {
    activeOpenCount,
    postureCounts,
    urgentQueueCount,
    highAttentionQueueCount,
    routinePendingQueueCount,
    staleMarketOpenCount,
    stopViolationsCount,
    pendingCheckpointCount,
    partialRiskFigures,
    concentration,
  } = input;

  const detailLines: string[] = [];

  const classified = classifyBookOperatingHeadline(input);
  const {
    headline,
    headlineTag,
    staleHeavyCondition,
    pressuring,
    reviewHeavy,
    defensiveDeveloping,
    stableMajority,
  } = classified;

  if (activeOpenCount === 0) {
    return {
      headline,
      headlineTag,
      detailLines: [],
      sessionNarrative: "No open book to summarize.",
      staleHeavyCondition,
    };
  }

  if (stopViolationsCount >= 1 || urgentQueueCount >= 1) {
    detailLines.push(
      stopViolationsCount >= 1
        ? `${stopViolationsCount} open row(s) read stop-violated vs latest daily bar (where data loaded).`
        : `${urgentQueueCount} urgent open row(s) in today’s review queue.`
    );
  } else if (staleHeavyCondition && pendingCheckpointCount >= 2) {
    detailLines.push(
      `${staleMarketOpenCount} open row(s) show stale market data vs benchmark; ${pendingCheckpointCount} checkpoint(s) still pending today.`
    );
  } else if (reviewHeavy) {
    detailLines.push(
      `${pendingCheckpointCount} of ${activeOpenCount} open position(s) still need today’s checkpoint.`
    );
  } else if (pressuring) {
    detailLines.push(
      `${urgentQueueCount} urgent and ${highAttentionQueueCount} high-attention name(s) in the daily queue.`
    );
  } else if (defensiveDeveloping) {
    detailLines.push(
      `${postureCounts.defensive} defensive and ${postureCounts.high_attention} high-attention posture row(s) on the latest scan.`
    );
  } else if (stableMajority && pendingCheckpointCount <= 1) {
    detailLines.push(
      `Most open rows read stable on the latest scan; routine reviews pending: ${routinePendingQueueCount}.`
    );
  } else {
    detailLines.push(
      `Posture mix: ${postureCounts.stable} stable, ${postureCounts.cautious} cautious, ${postureCounts.defensive} defensive, ${postureCounts.high_attention} high-attention.`
    );
  }

  if (partialRiskFigures && concentration.sumAtRisk != null) {
    detailLines.push(
      "Planned capital-at-risk sum excludes rows without a valid stop — concentration is approximate."
    );
  }

  if (
    concentration.countWithRisk >= 2 &&
    concentration.top1Share != null &&
    concentration.top1Share >= 0.45 &&
    concentration.top1Symbol
  ) {
    detailLines.push(
      `${concentration.top1Symbol} is about ${pct(concentration.top1Share)} of summed planned capital at risk (where computable).`
    );
  } else if (
    concentration.countWithRisk >= 2 &&
    concentration.top2Share != null &&
    concentration.top2Share >= 0.7 &&
    concentration.top1Symbol &&
    concentration.top2Symbol
  ) {
    detailLines.push(
      `${concentration.top1Symbol} and ${concentration.top2Symbol} together are about ${pct(concentration.top2Share)} of summed planned capital at risk (where computable).`
    );
  }

  const sessionNarrative = buildSessionOperatingNarrative({
    headline,
    activeOpenCount,
    postureCounts,
    urgentQueueCount,
    highAttentionQueueCount,
    pendingCheckpointCount,
    staleMarketOpenCount,
    concentration,
  });

  return {
    headline,
    headlineTag,
    detailLines: detailLines.slice(0, 2),
    sessionNarrative,
    staleHeavyCondition,
  };
}

function buildSessionOperatingNarrative(params: {
  headline: string;
  activeOpenCount: number;
  postureCounts: BookPostureCounts;
  urgentQueueCount: number;
  highAttentionQueueCount: number;
  pendingCheckpointCount: number;
  staleMarketOpenCount: number;
  concentration: PlannedRiskConcentration;
}): string {
  const {
    headline,
    activeOpenCount,
    postureCounts,
    urgentQueueCount,
    highAttentionQueueCount,
    pendingCheckpointCount,
    staleMarketOpenCount,
    concentration,
  } = params;

  const ha = postureCounts.high_attention;
  const parts: string[] = [];

  if (headline === "Stable operating posture") {
    parts.push(
      ha > 0
        ? `Book is mostly stable with ${ha} high-attention posture row(s).`
        : "Book reads mostly stable on the latest scan."
    );
  } else if (
    headline === "Stale-data caution" ||
    (staleMarketOpenCount >= 1 && pendingCheckpointCount >= 2)
  ) {
    parts.push(
      "Review pressure is elevated from stale bar context and pending checkpoints — work the queue calmly."
    );
  } else if (
    concentration.top2Share != null &&
    concentration.top2Share >= 0.68 &&
    concentration.top1Symbol &&
    concentration.top2Symbol
  ) {
    parts.push(
      `Risk concentration is elevated across ${concentration.top1Symbol} and ${concentration.top2Symbol} vs the rest of the summed at-risk book (where computable).`
    );
  } else if (urgentQueueCount + highAttentionQueueCount > 0) {
    parts.push(
      `${urgentQueueCount} urgent and ${highAttentionQueueCount} high-attention queue name(s) on ${activeOpenCount} open — prioritize checkpoints in order.`
    );
  } else {
    parts.push(
      `${pendingCheckpointCount} checkpoint(s) still pending today across ${activeOpenCount} open position(s).`
    );
  }

  return parts[0] ?? "Continue the session in queue order.";
}
