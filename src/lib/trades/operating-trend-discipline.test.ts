import { describe, expect, it } from "vitest";
import {
  bookOperatingSnapshotsMeaningfullyEqual,
  BOOK_OPERATING_SNAPSHOT_VERSION,
  buildNextOperatingSnapshot,
  deriveOperatingTrendDiscipline,
  derivePersistentPressureAwareness,
  enhanceSessionOperatingNarrative,
  mergeSinceLastVisitDisplayLines,
  parseBookOperatingSnapshot,
  type OperatingTrendMetrics,
} from "./operating-trend-discipline";

function metrics(over: Partial<OperatingTrendMetrics> = {}): OperatingTrendMetrics {
  return {
    postureCounts: {
      stable: 1,
      cautious: 1,
      defensive: 0,
      high_attention: 1,
    },
    activeOpenCount: 3,
    urgentQueueCount: 2,
    highAttentionQueueCount: 1,
    staleMarketOpenCount: 0,
    pendingCheckpointCount: 2,
    reviewedTodayOpenCount: 1,
    headlineTag: "elevated_pressure",
    staleHeavyCondition: false,
    top1Share: 0.5,
    top2Share: null,
    urgentSortedTradeIds: [],
    highAttentionSortedTradeIds: [],
    stableReviewedClusterCount: 0,
    defensiveHeavyBook: false,
    ...over,
  };
}

const prevSnapshot = buildNextOperatingSnapshot(null, metrics({ headlineTag: "elevated_pressure" }));

describe("deriveOperatingTrendDiscipline", () => {
  it("detects easing pending when lower than prev", () => {
    const r = deriveOperatingTrendDiscipline({
      previous: prevSnapshot,
      current: metrics({
        headlineTag: "elevated_pressure",
        pendingCheckpointCount: 1,
        reviewedTodayOpenCount: 2,
      }),
      urgentPendingCheckpointCount: 0,
    });
    expect(r.trendPhrases.some((t) => t.includes("easing"))).toBe(true);
  });

  it("returns empty when no previous snapshot", () => {
    const r = deriveOperatingTrendDiscipline({
      previous: null,
      current: metrics({
        headlineTag: "stable",
        postureCounts: {
          stable: 2,
          cautious: 0,
          defensive: 0,
          high_attention: 0,
        },
        activeOpenCount: 2,
        urgentQueueCount: 0,
        highAttentionQueueCount: 0,
        pendingCheckpointCount: 0,
        reviewedTodayOpenCount: 2,
        top1Share: null,
        top2Share: null,
      }),
      urgentPendingCheckpointCount: 0,
    });
    expect(r.trendPhrases).toHaveLength(0);
  });
});

describe("buildNextOperatingSnapshot", () => {
  it("increments review-heavy streak", () => {
    const first = buildNextOperatingSnapshot(
      null,
      metrics({
        headlineTag: "review_heavy",
        postureCounts: {
          stable: 0,
          cautious: 2,
          defensive: 0,
          high_attention: 0,
        },
        activeOpenCount: 4,
        urgentQueueCount: 0,
        highAttentionQueueCount: 0,
        pendingCheckpointCount: 3,
        reviewedTodayOpenCount: 0,
        top1Share: null,
        top2Share: null,
      })
    );
    expect(first.consecutiveReviewHeavyVisits).toBe(1);
    expect(first.v).toBe(BOOK_OPERATING_SNAPSHOT_VERSION);
    const second = buildNextOperatingSnapshot(
      first,
      metrics({
        headlineTag: "review_heavy",
        postureCounts: {
          stable: 0,
          cautious: 2,
          defensive: 0,
          high_attention: 0,
        },
        activeOpenCount: 4,
        urgentQueueCount: 0,
        highAttentionQueueCount: 0,
        pendingCheckpointCount: 3,
        reviewedTodayOpenCount: 0,
        top1Share: null,
        top2Share: null,
      })
    );
    expect(second.consecutiveReviewHeavyVisits).toBe(2);
  });
});

describe("derivePersistentPressureAwareness", () => {
  it("detects unchanged urgent roster with pending checkpoints", () => {
    const prev = buildNextOperatingSnapshot(
      null,
      metrics({
        headlineTag: "stable",
        urgentSortedTradeIds: ["a", "b"],
        urgentQueueCount: 2,
      })
    );
    const lines = derivePersistentPressureAwareness({
      previous: prev,
      current: metrics({
        headlineTag: "stable",
        urgentSortedTradeIds: ["b", "a"],
        urgentQueueCount: 2,
      }),
      urgentPendingCheckpointCount: 1,
    });
    expect(lines.some((l) => l.includes("Urgent queue roster"))).toBe(true);
  });

  it("returns empty without previous snapshot", () => {
    expect(
      derivePersistentPressureAwareness({
        previous: null,
        current: metrics({ headlineTag: "stable" }),
        urgentPendingCheckpointCount: 0,
      })
    ).toHaveLength(0);
  });
});

describe("enhanceSessionOperatingNarrative", () => {
  it("appends trend and discipline", () => {
    const s = enhanceSessionOperatingNarrative("Base line.", {
      trendPhrases: ["Review pressure easing"],
      disciplineCues: ["Keep working the queue."],
      memoryLines: [],
    });
    expect(s).toContain("Base line.");
    expect(s.toLowerCase()).toContain("trend:");
    expect(s).toContain("queue");
  });

  it("weaves evolution and trend without book-level tails", () => {
    const s = enhanceSessionOperatingNarrative(
      "Session base.",
      {
        trendPhrases: ["Urgent queue grew since last ledger visit"],
        disciplineCues: ["Urgent queue: checkpoints still open today."],
        memoryLines: [],
      },
      { evolutionSummary: "Multiple rows deteriorating vs last checkpoint." }
    );
    expect(s).toContain("Session base.");
    expect(s).toContain("Evolution:");
    expect(s.toLowerCase()).toContain("trend:");
    expect(s).toContain("Urgent queue:");
    expect(s).not.toContain("Balance:");
    expect(s).not.toContain("Persistence:");
  });
});

describe("bookOperatingSnapshotsMeaningfullyEqual", () => {
  it("treats snapshots as equal when only recordedAtMs differs", () => {
    const a = buildNextOperatingSnapshot(null, metrics({ headlineTag: "stable" }));
    const b = { ...a, recordedAtMs: a.recordedAtMs + 99_000 };
    expect(bookOperatingSnapshotsMeaningfullyEqual(a, b)).toBe(true);
  });

  it("detects meaningful mismatch", () => {
    const a = buildNextOperatingSnapshot(null, metrics({ headlineTag: "stable" }));
    const b = buildNextOperatingSnapshot(a, metrics({ headlineTag: "stale_data" }));
    expect(bookOperatingSnapshotsMeaningfullyEqual(a, b)).toBe(false);
  });
});

describe("mergeSinceLastVisitDisplayLines", () => {
  it("keeps only one stale-themed line", () => {
    const merged = mergeSinceLastVisitDisplayLines(
      ["Stale bar pressure unchanged vs last visit."],
      [],
      ["Stale headline carried across multiple visits."],
      3
    );
    expect(merged.filter((l) => /stale/i.test(l))).toHaveLength(1);
    expect(merged.length).toBeGreaterThanOrEqual(1);
  });
});

describe("parseBookOperatingSnapshot", () => {
  it("parses current snapshot json as v2", () => {
    const snap = buildNextOperatingSnapshot(
      null,
      metrics({
        headlineTag: "stable",
        postureCounts: {
          stable: 1,
          cautious: 0,
          defensive: 0,
          high_attention: 0,
        },
        activeOpenCount: 1,
        urgentQueueCount: 0,
        highAttentionQueueCount: 0,
        pendingCheckpointCount: 0,
        reviewedTodayOpenCount: 1,
        top1Share: null,
        top2Share: null,
      })
    );
    const raw = JSON.stringify(snap);
    const parsed = parseBookOperatingSnapshot(raw);
    expect(parsed?.v).toBe(2);
    expect(parsed?.headlineTag).toBe("stable");
  });

  it("normalizes v1 legacy payload to v2 shape", () => {
    const legacy = {
      v: 1,
      recordedAtMs: 1,
      activeOpenCount: 2,
      postureStable: 1,
      postureCautious: 0,
      postureDefensive: 0,
      postureHighAttention: 1,
      urgentQueueCount: 0,
      highAttentionQueueCount: 1,
      staleMarketOpenCount: 0,
      pendingCheckpointCount: 1,
      reviewedTodayOpenCount: 0,
      headlineTag: "mixed",
      staleHeavyCondition: false,
      top1Share: null,
      top2Share: null,
      completionRatio: 0,
      consecutiveReviewHeavyVisits: 0,
      consecutiveStalePressureVisits: 0,
    };
    const parsed = parseBookOperatingSnapshot(JSON.stringify(legacy));
    expect(parsed?.v).toBe(2);
    expect(parsed?.urgentSortedTradeIds).toEqual([]);
    expect(parsed?.stableReviewedClusterCount).toBe(1);
  });

  it("rejects bad input", () => {
    expect(parseBookOperatingSnapshot(undefined)).toBeNull();
    expect(parseBookOperatingSnapshot("{")).toBeNull();
  });
});
