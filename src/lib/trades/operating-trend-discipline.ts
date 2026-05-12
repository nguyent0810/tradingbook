/**
 * Deterministic trend, discipline, rolling memory, persistence, and session narrative
 * vs prior ledger snapshot (httpOnly cookie). No AI; no probability scores.
 */

import type {
  BookOperatingHeadlineTag,
  BookPostureCounts,
} from "@/lib/trades/book-operating-context";

export const BOOK_OPERATING_SNAPSHOT_VERSION = 2 as const;

export type BookOperatingSnapshotV2 = {
  v: typeof BOOK_OPERATING_SNAPSHOT_VERSION;
  recordedAtMs: number;
  activeOpenCount: number;
  postureStable: number;
  postureCautious: number;
  postureDefensive: number;
  postureHighAttention: number;
  urgentQueueCount: number;
  highAttentionQueueCount: number;
  staleMarketOpenCount: number;
  pendingCheckpointCount: number;
  reviewedTodayOpenCount: number;
  headlineTag: BookOperatingHeadlineTag;
  staleHeavyCondition: boolean;
  top1Share: number | null;
  top2Share: number | null;
  completionRatio: number | null;
  consecutiveReviewHeavyVisits: number;
  consecutiveStalePressureVisits: number;
  /** Sorted urgent-queue trade IDs (this visit). */
  urgentSortedTradeIds: string[];
  /** Sorted high-attention-queue trade IDs (this visit). */
  highAttentionSortedTradeIds: string[];
  stableReviewedClusterCount: number;
  /** Defensive + high-attention posture rows ≥ ~45% of opens. */
  defensiveHeavyBook: boolean;
  consecutiveDefensiveHeavyVisits: number;
};

export type OperatingTrendMetrics = {
  postureCounts: BookPostureCounts;
  activeOpenCount: number;
  urgentQueueCount: number;
  highAttentionQueueCount: number;
  staleMarketOpenCount: number;
  pendingCheckpointCount: number;
  reviewedTodayOpenCount: number;
  headlineTag: BookOperatingHeadlineTag;
  staleHeavyCondition: boolean;
  top1Share: number | null;
  top2Share: number | null;
  urgentSortedTradeIds: readonly string[];
  highAttentionSortedTradeIds: readonly string[];
  stableReviewedClusterCount: number;
  defensiveHeavyBook: boolean;
};

export type OperatingTrendDisciplineResult = {
  trendPhrases: string[];
  disciplineCues: string[];
  memoryLines: string[];
};

export function postureCountsToFlat(counts: BookPostureCounts): Pick<
  BookOperatingSnapshotV2,
  | "postureStable"
  | "postureCautious"
  | "postureDefensive"
  | "postureHighAttention"
> {
  return {
    postureStable: counts.stable,
    postureCautious: counts.cautious,
    postureDefensive: counts.defensive,
    postureHighAttention: counts.high_attention,
  };
}

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].map((id) => id.trim()).filter(Boolean).sort();
}

function setsEqual(a: readonly string[], b: readonly string[]): boolean {
  const sa = sortedIds(a);
  const sb = sortedIds(b);
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

export function buildNextOperatingSnapshot(
  previous: BookOperatingSnapshotV2 | null,
  metrics: OperatingTrendMetrics
): BookOperatingSnapshotV2 {
  const completionRatio =
    metrics.activeOpenCount > 0
      ? metrics.reviewedTodayOpenCount / metrics.activeOpenCount
      : null;

  const consecutiveReviewHeavyVisits =
    metrics.headlineTag === "review_heavy"
      ? (previous?.consecutiveReviewHeavyVisits ?? 0) + 1
      : 0;

  const consecutiveStalePressureVisits =
    metrics.headlineTag === "stale_data"
      ? (previous?.consecutiveStalePressureVisits ?? 0) + 1
      : 0;

  const consecutiveDefensiveHeavyVisits = metrics.defensiveHeavyBook
    ? (previous?.consecutiveDefensiveHeavyVisits ?? 0) + 1
    : 0;

  const flat = postureCountsToFlat(metrics.postureCounts);

  return {
    v: BOOK_OPERATING_SNAPSHOT_VERSION,
    recordedAtMs: Date.now(),
    activeOpenCount: metrics.activeOpenCount,
    ...flat,
    urgentQueueCount: metrics.urgentQueueCount,
    highAttentionQueueCount: metrics.highAttentionQueueCount,
    staleMarketOpenCount: metrics.staleMarketOpenCount,
    pendingCheckpointCount: metrics.pendingCheckpointCount,
    reviewedTodayOpenCount: metrics.reviewedTodayOpenCount,
    headlineTag: metrics.headlineTag,
    staleHeavyCondition: metrics.staleHeavyCondition,
    top1Share: metrics.top1Share,
    top2Share: metrics.top2Share,
    completionRatio,
    consecutiveReviewHeavyVisits,
    consecutiveStalePressureVisits,
    urgentSortedTradeIds: sortedIds(metrics.urgentSortedTradeIds),
    highAttentionSortedTradeIds: sortedIds(metrics.highAttentionSortedTradeIds),
    stableReviewedClusterCount: metrics.stableReviewedClusterCount,
    defensiveHeavyBook: metrics.defensiveHeavyBook,
    consecutiveDefensiveHeavyVisits,
  };
}

export function deriveOperatingTrendDiscipline(params: {
  previous: BookOperatingSnapshotV2 | null;
  current: OperatingTrendMetrics;
  urgentPendingCheckpointCount: number;
}): OperatingTrendDisciplineResult {
  const { previous, current, urgentPendingCheckpointCount } = params;
  const trendPhrases: string[] = [];
  const disciplineCues: string[] = [];
  const memoryLines: string[] = [];

  if (previous == null) {
    return { trendPhrases, disciplineCues, memoryLines };
  }

  const prev = previous;

  if (
    current.pendingCheckpointCount < prev.pendingCheckpointCount &&
    current.pendingCheckpointCount >= 0
  ) {
    trendPhrases.push("Review pressure easing");
  }

  if (current.urgentQueueCount < prev.urgentQueueCount) {
    trendPhrases.push("Urgent review load improving");
  } else if (current.urgentQueueCount > prev.urgentQueueCount) {
    trendPhrases.push("Urgent queue grew since last ledger visit");
  }

  if (current.highAttentionQueueCount < prev.highAttentionQueueCount) {
    trendPhrases.push("High-attention cluster shrinking");
  }

  if (
    current.postureCounts.defensive + current.postureCounts.high_attention >
    prev.postureDefensive + prev.postureHighAttention
  ) {
    trendPhrases.push("Defensive posture expanding");
  }

  if (
    current.postureCounts.stable > prev.postureStable &&
    current.headlineTag === "stable"
  ) {
    trendPhrases.push("Book posture stabilizing");
  }

  if (
    prev.staleHeavyCondition &&
    current.staleHeavyCondition &&
    current.staleMarketOpenCount >= 1
  ) {
    trendPhrases.push("Stale review pressure persists");
  }

  if (
    urgentPendingCheckpointCount >= 1 &&
    current.urgentQueueCount >= 1
  ) {
    disciplineCues.push(
      "Some urgent-queue positions still need today’s checkpoint."
    );
  }

  if (
    prev.consecutiveStalePressureVisits >= 1 &&
    current.headlineTag === "stale_data"
  ) {
    disciplineCues.push(
      "Stale bar context repeated on successive ledger visits — verify data freshness."
    );
  }

  if (
    prev.top1Share != null &&
    current.top1Share != null &&
    prev.top1Share >= 0.45 &&
    current.top1Share >= 0.45
  ) {
    disciplineCues.push(
      "Planned capital-at-risk concentration remains elevated vs last visit’s snapshot."
    );
  }

  const prevRatio = prev.completionRatio;
  const currRatio =
    current.activeOpenCount > 0
      ? current.reviewedTodayOpenCount / current.activeOpenCount
      : null;
  if (
    prevRatio != null &&
    currRatio != null &&
    currRatio - prevRatio >= 0.15 &&
    current.activeOpenCount >= 2
  ) {
    disciplineCues.push(
      "Review completion coverage improved versus your last ledger visit."
    );
  }

  const streak =
    current.headlineTag === "review_heavy"
      ? prev.consecutiveReviewHeavyVisits + 1
      : 0;
  if (streak >= 3) {
    memoryLines.push(
      `${ordinal(streak)} consecutive review-heavy ledger scan — pending checkpoints still dominate vs open count.`
    );
  }

  if (
    current.highAttentionQueueCount < prev.highAttentionQueueCount &&
    prev.highAttentionQueueCount >= 2
  ) {
    memoryLines.push("High-attention queue names decreased vs last visit.");
  }

  if (
    current.headlineTag === "stable" &&
    prev.headlineTag !== "stable" &&
    current.postureCounts.stable >= prev.postureStable
  ) {
    memoryLines.push("Book headline reads stable vs prior visit.");
  }

  return {
    trendPhrases: dedupePhrases(trendPhrases).slice(0, 2),
    disciplineCues: dedupePhrases(disciplineCues).slice(0, 2),
    memoryLines: dedupePhrases(memoryLines).slice(0, 2),
  };
}

export function derivePersistentPressureAwareness(params: {
  previous: BookOperatingSnapshotV2 | null;
  current: OperatingTrendMetrics;
  urgentPendingCheckpointCount: number;
}): string[] {
  const { previous, current, urgentPendingCheckpointCount } = params;
  if (previous == null) return [];

  const lines: string[] = [];

  if (
    previous.urgentSortedTradeIds.length > 0 &&
    setsEqual(previous.urgentSortedTradeIds, current.urgentSortedTradeIds) &&
    urgentPendingCheckpointCount >= 1
  ) {
    lines.push(
      "Urgent queue roster unchanged since last visit — some checkpoints may still be open."
    );
  }

  if (
    previous.highAttentionSortedTradeIds.length >= 2 &&
    setsEqual(
      previous.highAttentionSortedTradeIds,
      current.highAttentionSortedTradeIds
    ) &&
    current.highAttentionQueueCount >= previous.highAttentionQueueCount
  ) {
    lines.push(
      "Same high-attention queue names as last visit — operational load is persisting."
    );
  }

  if (
    previous.consecutiveStalePressureVisits >= 2 &&
    current.headlineTag === "stale_data"
  ) {
    lines.push(
      "Stale-review pressure has carried across multiple ledger visits."
    );
  }

  if (
    previous.defensiveHeavyBook &&
    current.defensiveHeavyBook &&
    previous.consecutiveDefensiveHeavyVisits >= 1
  ) {
    lines.push(
      "Defensive posture concentration remains elevated across successive visits."
    );
  }

  return dedupePhrases(lines).slice(0, 2);
}

export type SessionNarrativeExtras = {
  balanceLines?: readonly string[];
  persistenceLines?: readonly string[];
  evolutionSummary?: string | null;
};

function ordinal(n: number): string {
  if (n === 3) return "Third";
  if (n === 4) return "Fourth";
  if (n === 5) return "Fifth";
  return `${n}th`;
}

function dedupePhrases(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
}

/** Concise narrative extension — no AI tone. */
export function enhanceSessionOperatingNarrative(
  baseNarrative: string,
  trendDiscipline: OperatingTrendDisciplineResult,
  extras?: SessionNarrativeExtras
): string {
  const parts: string[] = [baseNarrative.trim()];
  const tail: string[] = [];

  const bal = extras?.balanceLines?.[0];
  if (bal) tail.push(`Balance: ${bal}`);

  const evo = extras?.evolutionSummary?.trim();
  if (evo) tail.push(`Evolution: ${evo}`);

  if (trendDiscipline.trendPhrases[0]) {
    tail.push(`Trend: ${trendDiscipline.trendPhrases[0].toLowerCase()}.`);
  }
  if (trendDiscipline.disciplineCues[0]) {
    tail.push(trendDiscipline.disciplineCues[0]);
  }

  const pers = extras?.persistenceLines?.[0];
  if (pers) tail.push(`Persistence: ${pers}`);

  if (tail.length === 0) return parts.join(" ");

  const merged = `${parts[0]} ${tail.join(" ")}`.trim();
  return merged.length > 400 ? `${merged.slice(0, 397)}…` : merged;
}

/** Normalize v1 legacy cookies into v2 shape (unknown fields defaulted). */
export function parseBookOperatingSnapshot(
  raw: string | undefined | null
): BookOperatingSnapshotV2 | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const v = o.v;
    if (v !== 1 && v !== 2) return null;
    if (typeof o.recordedAtMs !== "number") return null;
    if (typeof o.activeOpenCount !== "number") return null;
    if (typeof o.headlineTag !== "string") return null;

    const urgentSorted =
      Array.isArray(o.urgentSortedTradeIds) && v === 2
        ? sortedIds(o.urgentSortedTradeIds as string[])
        : [];
    const haSorted =
      Array.isArray(o.highAttentionSortedTradeIds) && v === 2
        ? sortedIds(o.highAttentionSortedTradeIds as string[])
        : [];

    const stableCluster =
      typeof o.stableReviewedClusterCount === "number" && v === 2
        ? o.stableReviewedClusterCount
        : typeof o.postureStable === "number"
          ? o.postureStable
          : 0;

    const defensiveHeavy =
      typeof o.defensiveHeavyBook === "boolean" && v === 2
        ? o.defensiveHeavyBook
        : false;

    const cdhv =
      typeof o.consecutiveDefensiveHeavyVisits === "number" && v === 2
        ? o.consecutiveDefensiveHeavyVisits
        : 0;

    return {
      v: BOOK_OPERATING_SNAPSHOT_VERSION,
      recordedAtMs: o.recordedAtMs as number,
      activeOpenCount: o.activeOpenCount as number,
      postureStable: Number(o.postureStable ?? 0),
      postureCautious: Number(o.postureCautious ?? 0),
      postureDefensive: Number(o.postureDefensive ?? 0),
      postureHighAttention: Number(o.postureHighAttention ?? 0),
      urgentQueueCount: Number(o.urgentQueueCount ?? 0),
      highAttentionQueueCount: Number(o.highAttentionQueueCount ?? 0),
      staleMarketOpenCount: Number(o.staleMarketOpenCount ?? 0),
      pendingCheckpointCount: Number(o.pendingCheckpointCount ?? 0),
      reviewedTodayOpenCount: Number(o.reviewedTodayOpenCount ?? 0),
      headlineTag: o.headlineTag as BookOperatingHeadlineTag,
      staleHeavyCondition: Boolean(o.staleHeavyCondition),
      top1Share:
        typeof o.top1Share === "number" && Number.isFinite(o.top1Share)
          ? o.top1Share
          : null,
      top2Share:
        typeof o.top2Share === "number" && Number.isFinite(o.top2Share)
          ? o.top2Share
          : null,
      completionRatio:
        typeof o.completionRatio === "number" && Number.isFinite(o.completionRatio)
          ? o.completionRatio
          : null,
      consecutiveReviewHeavyVisits: Number(
        o.consecutiveReviewHeavyVisits ?? 0
      ),
      consecutiveStalePressureVisits: Number(
        o.consecutiveStalePressureVisits ?? 0
      ),
      urgentSortedTradeIds: urgentSorted,
      highAttentionSortedTradeIds: haSorted,
      stableReviewedClusterCount: stableCluster,
      defensiveHeavyBook: defensiveHeavy,
      consecutiveDefensiveHeavyVisits: cdhv,
    };
  } catch {
    return null;
  }
}
