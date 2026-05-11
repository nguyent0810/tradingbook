import { describe, expect, it } from "vitest";
import {
  buildNextOperatingSnapshot,
  deriveOperatingTrendDiscipline,
  enhanceSessionOperatingNarrative,
  parseBookOperatingSnapshot,
} from "./operating-trend-discipline";

const prevSnapshot = buildNextOperatingSnapshot(null, {
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
});

describe("deriveOperatingTrendDiscipline", () => {
  it("detects easing pending when lower than prev", () => {
    const r = deriveOperatingTrendDiscipline({
      previous: prevSnapshot,
      current: {
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
        pendingCheckpointCount: 1,
        reviewedTodayOpenCount: 2,
        headlineTag: "elevated_pressure",
        staleHeavyCondition: false,
        top1Share: 0.5,
        top2Share: null,
      },
      urgentPendingCheckpointCount: 0,
    });
    expect(r.trendPhrases.some((t) => t.includes("easing"))).toBe(true);
  });

  it("returns empty when no previous snapshot", () => {
    const r = deriveOperatingTrendDiscipline({
      previous: null,
      current: {
        postureCounts: {
          stable: 2,
          cautious: 0,
          defensive: 0,
          high_attention: 0,
        },
        activeOpenCount: 2,
        urgentQueueCount: 0,
        highAttentionQueueCount: 0,
        staleMarketOpenCount: 0,
        pendingCheckpointCount: 0,
        reviewedTodayOpenCount: 2,
        headlineTag: "stable",
        staleHeavyCondition: false,
        top1Share: null,
        top2Share: null,
      },
      urgentPendingCheckpointCount: 0,
    });
    expect(r.trendPhrases).toHaveLength(0);
  });
});

describe("buildNextOperatingSnapshot", () => {
  it("increments review-heavy streak", () => {
    const first = buildNextOperatingSnapshot(null, {
      postureCounts: {
        stable: 0,
        cautious: 2,
        defensive: 0,
        high_attention: 0,
      },
      activeOpenCount: 4,
      urgentQueueCount: 0,
      highAttentionQueueCount: 0,
      staleMarketOpenCount: 0,
      pendingCheckpointCount: 3,
      reviewedTodayOpenCount: 0,
      headlineTag: "review_heavy",
      staleHeavyCondition: false,
      top1Share: null,
      top2Share: null,
    });
    expect(first.consecutiveReviewHeavyVisits).toBe(1);
    const second = buildNextOperatingSnapshot(first, {
      postureCounts: {
        stable: 0,
        cautious: 2,
        defensive: 0,
        high_attention: 0,
      },
      activeOpenCount: 4,
      urgentQueueCount: 0,
      highAttentionQueueCount: 0,
      staleMarketOpenCount: 0,
      pendingCheckpointCount: 3,
      reviewedTodayOpenCount: 0,
      headlineTag: "review_heavy",
      staleHeavyCondition: false,
      top1Share: null,
      top2Share: null,
    });
    expect(second.consecutiveReviewHeavyVisits).toBe(2);
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
});

describe("parseBookOperatingSnapshot", () => {
  it("parses valid json", () => {
    const snap = buildNextOperatingSnapshot(null, {
      postureCounts: {
        stable: 1,
        cautious: 0,
        defensive: 0,
        high_attention: 0,
      },
      activeOpenCount: 1,
      urgentQueueCount: 0,
      highAttentionQueueCount: 0,
      staleMarketOpenCount: 0,
      pendingCheckpointCount: 0,
      reviewedTodayOpenCount: 1,
      headlineTag: "stable",
      staleHeavyCondition: false,
      top1Share: null,
      top2Share: null,
    });
    const raw = JSON.stringify(snap);
    expect(parseBookOperatingSnapshot(raw)?.v).toBe(1);
  });

  it("rejects bad input", () => {
    expect(parseBookOperatingSnapshot(undefined)).toBeNull();
    expect(parseBookOperatingSnapshot("{")).toBeNull();
  });
});
