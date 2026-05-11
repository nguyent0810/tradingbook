import { describe, expect, it } from "vitest";
import {
  parseHealthReviewLogPayload,
  serializeTradeHealthReviewPayloadForDb,
  type ReviewOutcomeId,
} from "./review-outcome";
import { EMPTY_EOD_REVIEW_CHECKLIST } from "./trade-health-review-checklist";

describe("serializeTradeHealthReviewPayloadForDb / parseHealthReviewLogPayload", () => {
  it("round-trips outcome with checklist", () => {
    const json = serializeTradeHealthReviewPayloadForDb(
      { ...EMPTY_EOD_REVIEW_CHECKLIST, stopReviewed: true },
      "monitoring_closely"
    );
    expect(json).toContain("monitoring_closely");
    const parsed = parseHealthReviewLogPayload(JSON.parse(json!));
    expect(parsed.checklist?.stopReviewed).toBe(true);
    expect(parsed.reviewOutcome).toBe("monitoring_closely");
  });

  it("persists outcome-only payload", () => {
    const json = serializeTradeHealthReviewPayloadForDb(
      EMPTY_EOD_REVIEW_CHECKLIST,
      "holding_as_planned" as ReviewOutcomeId
    );
    expect(json).toBe('{"reviewOutcome":"holding_as_planned"}');
    const parsed = parseHealthReviewLogPayload(JSON.parse(json!));
    expect(parsed.checklist).toBeNull();
    expect(parsed.reviewOutcome).toBe("holding_as_planned");
  });

  it("returns null when empty", () => {
    expect(
      serializeTradeHealthReviewPayloadForDb(EMPTY_EOD_REVIEW_CHECKLIST, null)
    ).toBeNull();
  });

  it("ignores invalid outcome in payload", () => {
    const parsed = parseHealthReviewLogPayload({
      reviewOutcome: "buy_now",
      stopReviewed: true,
    });
    expect(parsed.reviewOutcome).toBeNull();
    expect(parsed.checklist?.stopReviewed).toBe(true);
  });
});
