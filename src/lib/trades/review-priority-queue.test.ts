import { describe, expect, it } from "vitest";
import {
  buildOpenLedgerReviewOrder,
  buildReviewQueueModel,
  classifyReviewPriorityTier,
  compareOpenLedgerReviewOrder,
  deterioratedVsLastReviewBar,
} from "./review-priority-queue";

describe("deterioratedVsLastReviewBar", () => {
  it("LONG weaker vs baseline", () => {
    expect(
      deterioratedVsLastReviewBar({
        direction: "LONG",
        latestClose: 98,
        baselineClose: 100,
      })
    ).toBe(true);
  });

  it("SHORT higher vs baseline", () => {
    expect(
      deterioratedVsLastReviewBar({
        direction: "SHORT",
        latestClose: 102,
        baselineClose: 100,
      })
    ).toBe(true);
  });

  it("returns false when baseline missing", () => {
    expect(
      deterioratedVsLastReviewBar({
        direction: "LONG",
        latestClose: 100,
        baselineClose: null,
      })
    ).toBe(false);
  });
});

describe("classifyReviewPriorityTier", () => {
  it("stop violated is urgent", () => {
    expect(
      classifyReviewPriorityTier({
        surface: "stop_violated",
        stopBand: "comfortable",
        structureHints: [],
        marketDataStale: false,
        reviewedToday: true,
        deterioratedVsReview: false,
      })
    ).toBe("urgent");
  });

  it("breached band is urgent even if surface mismatched", () => {
    expect(
      classifyReviewPriorityTier({
        surface: "review_completed",
        stopBand: "breached",
        structureHints: [],
        marketDataStale: false,
        reviewedToday: true,
        deterioratedVsReview: false,
      })
    ).toBe("urgent");
  });

  it("failed breakout forces high attention below urgent", () => {
    expect(
      classifyReviewPriorityTier({
        surface: "review_completed",
        stopBand: "comfortable",
        structureHints: ["failed_breakout_hold"],
        marketDataStale: false,
        reviewedToday: true,
        deterioratedVsReview: false,
      })
    ).toBe("high_attention");
  });

  it("routine when comfortable and no checkpoint today", () => {
    expect(
      classifyReviewPriorityTier({
        surface: "review_needed",
        stopBand: "comfortable",
        structureHints: [],
        marketDataStale: false,
        reviewedToday: false,
        deterioratedVsReview: false,
      })
    ).toBe("routine_review");
  });
});

describe("compareOpenLedgerReviewOrder", () => {
  it("is stable for duplicate symbols via trade id", () => {
    const a = buildOpenLedgerReviewOrder({
      tradeId: "a",
      symbol: "AAA",
      surface: "review_completed",
      stopBand: "comfortable",
      structureHints: [],
      marketDataStale: false,
      reviewedToday: true,
      plannedCapitalAtRisk: 100,
      deterioratedVsReview: false,
    });
    const b = buildOpenLedgerReviewOrder({
      tradeId: "b",
      symbol: "AAA",
      surface: "review_completed",
      stopBand: "comfortable",
      structureHints: [],
      marketDataStale: false,
      reviewedToday: true,
      plannedCapitalAtRisk: 100,
      deterioratedVsReview: false,
    });
    expect(compareOpenLedgerReviewOrder(a, b)).toBeLessThan(0);
    expect(compareOpenLedgerReviewOrder(b, a)).toBeGreaterThan(0);
  });

  it("orders larger planned risk before smaller when other keys tie", () => {
    const hi = buildOpenLedgerReviewOrder({
      tradeId: "x",
      symbol: "ZZ",
      surface: "review_completed",
      stopBand: "comfortable",
      structureHints: [],
      marketDataStale: false,
      reviewedToday: true,
      plannedCapitalAtRisk: 500,
      deterioratedVsReview: false,
    });
    const lo = buildOpenLedgerReviewOrder({
      tradeId: "y",
      symbol: "ZZ",
      surface: "review_completed",
      stopBand: "comfortable",
      structureHints: [],
      marketDataStale: false,
      reviewedToday: true,
      plannedCapitalAtRisk: 100,
      deterioratedVsReview: false,
    });
    expect(compareOpenLedgerReviewOrder(hi, lo)).toBeLessThan(0);
  });
});

describe("buildReviewQueueModel", () => {
  it("partitions tiers and lists stale market separately", () => {
    const q = buildReviewQueueModel([
      {
        sortKey: buildOpenLedgerReviewOrder({
          tradeId: "t1",
          symbol: "AAA",
          surface: "stop_violated",
          stopBand: "breached",
          structureHints: [],
          marketDataStale: true,
          reviewedToday: false,
          plannedCapitalAtRisk: null,
          deterioratedVsReview: false,
        }),
        priorityTier: "urgent",
        marketDataStale: true,
      },
      {
        sortKey: buildOpenLedgerReviewOrder({
          tradeId: "t2",
          symbol: "BBB",
          surface: "review_needed",
          stopBand: "comfortable",
          structureHints: [],
          marketDataStale: false,
          reviewedToday: false,
          plannedCapitalAtRisk: null,
          deterioratedVsReview: false,
        }),
        priorityTier: "routine_review",
        marketDataStale: false,
      },
    ]);
    expect(q.urgent.map((x) => x.tradeId)).toEqual(["t1"]);
    expect(q.routinePending.map((x) => x.tradeId)).toEqual(["t2"]);
    expect(q.staleMarket.map((x) => x.tradeId)).toEqual(["t1"]);
  });
});
