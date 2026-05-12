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

/** True when persisted snapshot and candidate differ only by `recordedAtMs` (or are identical). */
export function bookOperatingSnapshotsMeaningfullyEqual(
  a: BookOperatingSnapshotV2,
  b: BookOperatingSnapshotV2
): boolean {
  return (
    a.v === b.v &&
    a.activeOpenCount === b.activeOpenCount &&
    a.postureStable === b.postureStable &&
    a.postureCautious === b.postureCautious &&
    a.postureDefensive === b.postureDefensive &&
    a.postureHighAttention === b.postureHighAttention &&
    a.urgentQueueCount === b.urgentQueueCount &&
    a.highAttentionQueueCount === b.highAttentionQueueCount &&
    a.staleMarketOpenCount === b.staleMarketOpenCount &&
    a.pendingCheckpointCount === b.pendingCheckpointCount &&
    a.reviewedTodayOpenCount === b.reviewedTodayOpenCount &&
    a.headlineTag === b.headlineTag &&
    a.staleHeavyCondition === b.staleHeavyCondition &&
    a.top1Share === b.top1Share &&
    a.top2Share === b.top2Share &&
    a.completionRatio === b.completionRatio &&
    a.consecutiveReviewHeavyVisits === b.consecutiveReviewHeavyVisits &&
    a.consecutiveStalePressureVisits === b.consecutiveStalePressureVisits &&
    setsEqual(a.urgentSortedTradeIds, b.urgentSortedTradeIds) &&
    setsEqual(a.highAttentionSortedTradeIds, b.highAttentionSortedTradeIds) &&
    a.stableReviewedClusterCount === b.stableReviewedClusterCount &&
    a.defensiveHeavyBook === b.defensiveHeavyBook &&
    a.consecutiveDefensiveHeavyVisits === b.consecutiveDefensiveHeavyVisits
  );
}

/**
 * Single pass of visit-delta lines for the book card: persistence first, then trend, then memory.
 * Drops a second line whose theme repeats "stale" (one stale signal is enough).
 */
export function mergeSinceLastVisitDisplayLines(
  trendPhrases: readonly string[],
  memoryLines: readonly string[],
  persistenceLines: readonly string[],
  maxLines: number
): string[] {
  const out: string[] = [];
  let staleUsed = false;
  const mentionsStale = (s: string) => /stale/i.test(s);
  const push = (line: string) => {
    if (out.length >= maxLines) return;
    const st = mentionsStale(line);
    if (st && staleUsed) return;
    if (st) staleUsed = true;
    out.push(line);
  };
  for (const p of persistenceLines) push(p);
  for (const t of trendPhrases) push(t);
  for (const m of memoryLines) push(m);
  return out;
}

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
    trendPhrases.push("Stale bar pressure unchanged vs last visit.");
  }

  if (
    urgentPendingCheckpointCount >= 1 &&
    current.urgentQueueCount >= 1
  ) {
    disciplineCues.push("Urgent queue: checkpoints still open today.");
  }

  if (
    prev.consecutiveStalePressureVisits >= 1 &&
    current.headlineTag === "stale_data"
  ) {
    disciplineCues.push(
      "Stale bar context repeated across visits — check data freshness."
    );
  }

  if (
    prev.top1Share != null &&
    current.top1Share != null &&
    prev.top1Share >= 0.45 &&
    current.top1Share >= 0.45
  ) {
    disciplineCues.push("Planned at-risk concentration still elevated vs last visit.");
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
    disciplineCues.push("Checkpoint coverage improved vs last visit.");
  }

  const streak =
    current.headlineTag === "review_heavy"
      ? prev.consecutiveReviewHeavyVisits + 1
      : 0;
  if (streak >= 3) {
    memoryLines.push(
      `${ordinal(streak)} consecutive review-heavy visit — checkpoints still dominate vs opens.`
    );
  }

  if (
    current.highAttentionQueueCount < prev.highAttentionQueueCount &&
    prev.highAttentionQueueCount >= 2
  ) {
    memoryLines.push("High-attention queue shrank vs last visit.");
  }

  if (
    current.headlineTag === "stable" &&
    prev.headlineTag !== "stable" &&
    current.postureCounts.stable >= prev.postureStable
  ) {
    memoryLines.push("Book headline now stable vs prior visit.");
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
    lines.push("Urgent queue roster unchanged; checkpoints may still be open.");
  }

  if (
    previous.highAttentionSortedTradeIds.length >= 2 &&
    setsEqual(
      previous.highAttentionSortedTradeIds,
      current.highAttentionSortedTradeIds
    ) &&
    current.highAttentionQueueCount >= previous.highAttentionQueueCount
  ) {
    lines.push("Same high-attention queue roster as last visit.");
  }

  if (
    previous.consecutiveStalePressureVisits >= 2 &&
    current.headlineTag === "stale_data"
  ) {
    lines.push("Stale headline carried across multiple visits.");
  }

  if (
    previous.defensiveHeavyBook &&
    current.defensiveHeavyBook &&
    previous.consecutiveDefensiveHeavyVisits >= 1
  ) {
    lines.push("Defensive-heavy book again vs last visit.");
  }

  return dedupePhrases(lines).slice(0, 2);
}

export type SessionNarrativeExtras = {
  evolutionSummary?: string | null;
};

/** Session chrome only: book card owns balance and visit-delta lines. */
export function enhanceSessionOperatingNarrative(
  baseNarrative: string,
  trendDiscipline: OperatingTrendDisciplineResult,
  extras?: SessionNarrativeExtras
): string {
  const parts: string[] = [baseNarrative.trim()];
  const tail: string[] = [];

  const evo = extras?.evolutionSummary?.trim();
  if (evo) tail.push(`Evolution: ${evo}`);

  if (trendDiscipline.trendPhrases[0]) {
    tail.push(`Trend: ${trendDiscipline.trendPhrases[0].toLowerCase()}.`);
  }
  if (trendDiscipline.disciplineCues[0]) {
    tail.push(trendDiscipline.disciplineCues[0]);
  }

  if (tail.length === 0) return parts.join(" ");

  const merged = `${parts[0]} ${tail.join(" ")}`.trim();
  return merged.length > 280 ? `${merged.slice(0, 277)}…` : merged;
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
