/**
 * Deterministic trend, discipline, and rolling memory vs prior ledger snapshot only.
 * No probability scores — compare cookie-backed snapshot to current metrics.
 */

import type {
  BookOperatingHeadlineTag,
  BookPostureCounts,
} from "@/lib/trades/book-operating-context";

export const BOOK_OPERATING_SNAPSHOT_VERSION = 1 as const;

export type BookOperatingSnapshotV1 = {
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
  /** reviewedTodayOpenCount / activeOpenCount when activeOpenCount > 0 */
  completionRatio: number | null;
  consecutiveReviewHeavyVisits: number;
  consecutiveStalePressureVisits: number;
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
};

export type OperatingTrendDisciplineResult = {
  trendPhrases: string[];
  disciplineCues: string[];
  memoryLines: string[];
};

export function postureCountsToFlat(counts: BookPostureCounts): Pick<
  BookOperatingSnapshotV1,
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

export function buildNextOperatingSnapshot(
  previous: BookOperatingSnapshotV1 | null,
  metrics: OperatingTrendMetrics
): BookOperatingSnapshotV1 {
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
  };
}

export function deriveOperatingTrendDiscipline(params: {
  previous: BookOperatingSnapshotV1 | null;
  current: OperatingTrendMetrics;
  /** OPEN urgent-tier positions still missing today’s checkpoint (global). */
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

  if (prev.consecutiveStalePressureVisits >= 1 && current.headlineTag === "stale_data") {
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

  const streak = current.headlineTag === "review_heavy"
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
  trendDiscipline: OperatingTrendDisciplineResult
): string {
  const parts: string[] = [baseNarrative.trim()];
  const tail: string[] = [];
  if (trendDiscipline.trendPhrases[0]) {
    tail.push(`Trend: ${trendDiscipline.trendPhrases[0].toLowerCase()}.`);
  }
  if (trendDiscipline.disciplineCues[0]) {
    tail.push(trendDiscipline.disciplineCues[0]);
  }
  if (tail.length === 0) return parts.join(" ");

  const merged = `${parts[0]} ${tail.join(" ")}`.trim();
  return merged.length > 320 ? `${merged.slice(0, 317)}…` : merged;
}

export function parseBookOperatingSnapshot(
  raw: string | undefined | null
): BookOperatingSnapshotV1 | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const o = JSON.parse(raw) as Partial<BookOperatingSnapshotV1>;
    if (o.v !== BOOK_OPERATING_SNAPSHOT_VERSION) return null;
    if (typeof o.recordedAtMs !== "number") return null;
    if (typeof o.activeOpenCount !== "number") return null;
    if (typeof o.headlineTag !== "string") return null;
    return o as BookOperatingSnapshotV1;
  } catch {
    return null;
  }
}
