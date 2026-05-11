import { describe, expect, it } from "vitest";
import {
  assignBookAttentionCluster,
  expandClusterDividerRows,
  sortTradesWithBookClusters,
} from "./book-clusters";
import { buildOpenLedgerReviewOrder } from "./review-priority-queue";

const sk = (id: string, sym: string) =>
  buildOpenLedgerReviewOrder({
    tradeId: id,
    symbol: sym,
    surface: "review_needed",
    stopBand: "comfortable",
    structureHints: [],
    marketDataStale: false,
    reviewedToday: false,
    plannedCapitalAtRisk: null,
    deterioratedVsReview: false,
  });

describe("assignBookAttentionCluster", () => {
  it("routes routine tier without checkpoint to routine_pending", () => {
    expect(
      assignBookAttentionCluster({
        operatingPosture: "cautious",
        priorityTier: "routine_review",
        reviewedToday: false,
      })
    ).toBe("routine_pending");
  });

  it("uses posture when routine but reviewed", () => {
    expect(
      assignBookAttentionCluster({
        operatingPosture: "stable",
        priorityTier: "routine_review",
        reviewedToday: true,
      })
    ).toBe("stable_reviewed");
  });
});

describe("sortTradesWithBookClusters", () => {
  it("orders high attention before stable", () => {
    const packs = new Map([
      [
        "a",
        {
          operatingPosture: "stable" as const,
          priorityTier: "stable" as const,
          sortKey: sk("a", "AAA"),
        },
      ],
      [
        "b",
        {
          operatingPosture: "high_attention" as const,
          priorityTier: "urgent" as const,
          sortKey: sk("b", "BBB"),
        },
      ],
    ]);
    const sorted = sortTradesWithBookClusters(
      [
        { id: "a", status: "OPEN" },
        { id: "b", status: "OPEN" },
      ],
      packs,
      new Set(),
      { sessionActive: false, sessionQueue: [] }
    );
    expect(sorted.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("expandClusterDividerRows", () => {
  it("inserts divider when cluster changes", () => {
    const packs = new Map([
      [
        "a",
        {
          operatingPosture: "defensive" as const,
          priorityTier: "high_attention" as const,
          sortKey: sk("a", "AAA"),
        },
      ],
      [
        "b",
        {
          operatingPosture: "stable" as const,
          priorityTier: "stable" as const,
          sortKey: sk("b", "BBB"),
        },
      ],
    ]);
    const out = expandClusterDividerRows(
      [
        { id: "a", status: "OPEN" },
        { id: "b", status: "OPEN" },
      ],
      true,
      packs,
      new Set(["b"])
    );
    expect(out.length).toBe(4);
    expect(
      out.some(
        (x) =>
          typeof x === "object" &&
          "kind" in x &&
          x.kind === "divider"
      )
    ).toBe(true);
  });
});
