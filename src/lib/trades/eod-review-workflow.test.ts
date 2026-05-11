import { describe, expect, it } from "vitest";
import {
  aggregateOpenPortfolioReviewStrip,
  buildReviewFocusHints,
  describeDeltaSinceReview,
  describeSessionCloseDelta,
} from "./eod-review-workflow";

describe("buildReviewFocusHints", () => {
  it("surfaces stale data and tight stop without duplicating endlessly", () => {
    const hints = buildReviewFocusHints({
      direction: "LONG",
      stopBand: "tight",
      structureHints: ["failed_breakout_hold"],
      staleVsBenchmark: true,
      healthLogStress: false,
      hasSetupLevels: true,
    });
    expect(hints.some((h) => h.includes("stale"))).toBe(true);
    expect(hints.some((h) => h.toLowerCase().includes("stop"))).toBe(true);
    expect(hints.some((h) => h.includes("breakout"))).toBe(true);
    expect(hints.length).toBeLessThanOrEqual(4);
  });
});

describe("describeSessionCloseDelta", () => {
  it("favors LONG when prior close moved up materially", () => {
    expect(
      describeSessionCloseDelta({
        direction: "LONG",
        latestClose: 102,
        priorClose: 100,
      })
    ).toContain("favors this long");
  });

  it("favors SHORT when prior close moved down materially", () => {
    expect(
      describeSessionCloseDelta({
        direction: "SHORT",
        latestClose: 98,
        priorClose: 100,
      })
    ).toContain("favors this short");
  });
});

describe("describeDeltaSinceReview", () => {
  it("returns null when baselines missing", () => {
    expect(
      describeDeltaSinceReview({
        direction: "LONG",
        latestClose: 100,
        baselineClose: null,
        stopBand: "comfortable",
      })
    ).toBeNull();
  });

  it("flags weak close near tight stop for LONG", () => {
    const line = describeDeltaSinceReview({
      direction: "LONG",
      latestClose: 99,
      baselineClose: 101,
      stopBand: "tight",
    });
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toContain("weaker");
  });
});

describe("aggregateOpenPortfolioReviewStrip", () => {
  it("sums planned capital at risk and marks partial figures", () => {
    const s = aggregateOpenPortfolioReviewStrip([
      {
        reviewedToday: false,
        stopViolated: false,
        underPressure: true,
        staleMarket: false,
        plannedCapitalAtRisk: 100,
      },
      {
        reviewedToday: true,
        stopViolated: true,
        underPressure: false,
        staleMarket: true,
        plannedCapitalAtRisk: null,
      },
    ]);
    expect(s.activeOpenCount).toBe(2);
    expect(s.underPressureCount).toBe(1);
    expect(s.stopViolationsCount).toBe(1);
    expect(s.reviewsPendingTodayCount).toBe(1);
    expect(s.staleMarketOpenCount).toBe(1);
    expect(s.plannedCapitalAtRiskTotal).toBe(100);
    expect(s.positionsPartialRiskFigures).toBe(true);
  });
});
