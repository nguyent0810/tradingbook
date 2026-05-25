import { describe, expect, it } from "vitest";
import { SetupHealthLevel } from "@/generated/prisma/client";
import {
  buildTradeHealthLogCreateData,
  normalizeTradeHealthLevel,
} from "@/lib/trades/trade-health-logs";
import { serializeTradeHealthReviewPayloadForDb } from "@/lib/trades/review-outcome";
import { EMPTY_EOD_REVIEW_CHECKLIST } from "@/lib/trades/trade-health-review-checklist";

describe("normalizeTradeHealthLevel", () => {
  it("accepts SetupHealthLevel values", () => {
    expect(normalizeTradeHealthLevel("HEALTHY")).toBe("HEALTHY");
    expect(normalizeTradeHealthLevel("AT_RISK")).toBe("AT_RISK");
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeTradeHealthLevel("bogus")).toBeNull();
    expect(normalizeTradeHealthLevel(null)).toBeNull();
    expect(normalizeTradeHealthLevel("")).toBeNull();
  });
});

describe("buildTradeHealthLogCreateData", () => {
  it("omits checkedAt and maps null optional fields", () => {
    const data = buildTradeHealthLogCreateData({
      tradeId: "trade-1",
      healthLevel: SetupHealthLevel.HEALTHY,
      healthScore: null,
      priceVsZone: null,
      structureStatus: null,
      recommendedAction: null,
      reviewPayloadJson: null,
    });
    expect(data).toEqual({
      tradeId: "trade-1",
      healthLevel: SetupHealthLevel.HEALTHY,
      healthScore: null,
      priceVsZone: null,
      structureStatus: null,
      recommendedAction: null,
      reviewChecklist: undefined,
    });
    expect(data).not.toHaveProperty("checkedAt");
    expect(data).not.toHaveProperty("id");
  });

  it("parses review payload JSON into Prisma InputJsonValue", () => {
    const json = serializeTradeHealthReviewPayloadForDb(
      { ...EMPTY_EOD_REVIEW_CHECKLIST, stopReviewed: true },
      "monitoring_closely"
    );
    const data = buildTradeHealthLogCreateData({
      tradeId: "trade-1",
      healthLevel: SetupHealthLevel.WARNING,
      healthScore: 42,
      priceVsZone: "above",
      structureStatus: "intact",
      recommendedAction: "hold",
      reviewPayloadJson: json,
    });
    expect(data.healthScore).toBe(42);
    expect(data.reviewChecklist).toEqual({
      stopReviewed: true,
      reviewOutcome: "monitoring_closely",
    });
  });
});
