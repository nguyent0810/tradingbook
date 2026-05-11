import { describe, expect, it } from "vitest";
import {
  buildReviewSessionQueue,
  computeReviewSessionDashboardCounts,
  resolveReviewSessionFocus,
  sessionQueueNeighbors,
  sortTradesForReviewSession,
} from "./review-session-queue";
import { buildOpenLedgerReviewOrder } from "./review-priority-queue";

const sortKeyComfortable = buildOpenLedgerReviewOrder({
  tradeId: "x",
  symbol: "AAA",
  surface: "review_completed",
  stopBand: "comfortable",
  structureHints: [],
  marketDataStale: false,
  reviewedToday: true,
  plannedCapitalAtRisk: null,
  deterioratedVsReview: false,
});

describe("buildReviewSessionQueue", () => {
  it("orders tier urgent → high → routine and pending before handled", () => {
    const q = buildReviewSessionQueue([
      {
        tradeId: "r_done",
        priorityTier: "routine_review",
        reviewedToday: true,
        sortKey: sortKeyComfortable,
      },
      {
        tradeId: "u_need",
        priorityTier: "urgent",
        reviewedToday: false,
        sortKey: sortKeyComfortable,
      },
      {
        tradeId: "r_need",
        priorityTier: "routine_review",
        reviewedToday: false,
        sortKey: sortKeyComfortable,
      },
      {
        tradeId: "h_need",
        priorityTier: "high_attention",
        reviewedToday: false,
        sortKey: sortKeyComfortable,
      },
      {
        tradeId: "stable_skip",
        priorityTier: "stable",
        reviewedToday: false,
        sortKey: sortKeyComfortable,
      },
    ]);
    expect(q).toEqual(["u_need", "h_need", "r_need", "r_done"]);
    expect(q.includes("stable_skip")).toBe(false);
  });
});

describe("resolveReviewSessionFocus", () => {
  it("defaults to head when focus missing or invalid", () => {
    expect(resolveReviewSessionFocus(["a", "b"], null)).toEqual({
      focusId: "a",
      focusIndex: 0,
    });
    expect(resolveReviewSessionFocus(["a", "b"], "z")).toEqual({
      focusId: "a",
      focusIndex: 0,
    });
  });
});

describe("sessionQueueNeighbors", () => {
  it("returns adjacent ids", () => {
    expect(sessionQueueNeighbors(["a", "b", "c"], 1)).toEqual({
      prevId: "a",
      nextId: "c",
    });
    expect(sessionQueueNeighbors(["a"], 0)).toEqual({
      prevId: null,
      nextId: null,
    });
  });
});

describe("computeReviewSessionDashboardCounts", () => {
  it("counts globals and pending ahead in queue", () => {
    const tier = new Map<string, "urgent" | "routine_review">([
      ["u1", "urgent"],
      ["u2", "urgent"],
      ["r1", "routine_review"],
    ]);
    const reviewed = new Set<string>();
    const c = computeReviewSessionDashboardCounts({
      sessionQueue: ["u1", "u2", "r1"],
      focusIndex: 0,
      tierByTradeId: tier,
      reviewedTodayTradeIds: reviewed,
      allOpenTradeIds: ["u1", "u2", "r1"],
    });
    expect(c.urgentPendingGlobal).toBe(2);
    expect(c.pendingCheckpointGlobal).toBe(3);
    expect(c.pendingAheadInQueue).toBe(2);
  });

  it("when focus invalid counts all pending in queue as ahead", () => {
    const tier = new Map<string, "urgent">([["a", "urgent"], ["b", "urgent"]]);
    const reviewed = new Set<string>();
    const c = computeReviewSessionDashboardCounts({
      sessionQueue: ["a", "b"],
      focusIndex: -1,
      tierByTradeId: tier,
      reviewedTodayTradeIds: reviewed,
      allOpenTradeIds: ["a", "b"],
    });
    expect(c.pendingAheadInQueue).toBe(2);
  });
});

describe("sortTradesForReviewSession", () => {
  it("orders OPEN by queue then keeps tail", () => {
    const sorted = sortTradesForReviewSession(
      [
        { id: "c", status: "CLOSED" },
        { id: "b", status: "OPEN" },
        { id: "a", status: "OPEN" },
      ],
      ["a", "b"]
    );
    expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
