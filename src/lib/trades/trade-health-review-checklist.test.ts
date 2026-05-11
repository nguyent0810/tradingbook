import { describe, expect, it } from "vitest";
import {
  parseReviewChecklistJson,
  reviewChecklistFromFormData,
  serializeReviewChecklistForDb,
} from "./trade-health-review-checklist";

describe("parseReviewChecklistJson", () => {
  it("returns null when empty or all false", () => {
    expect(parseReviewChecklistJson(null)).toBeNull();
    expect(
      parseReviewChecklistJson({
        stopReviewed: false,
        structureReviewed: false,
        sizingReviewed: false,
        exitPlanReviewed: false,
      })
    ).toBeNull();
  });

  it("parses true flags", () => {
    const p = parseReviewChecklistJson({
      stopReviewed: true,
      structureReviewed: false,
      sizingReviewed: true,
      exitPlanReviewed: false,
    });
    expect(p?.stopReviewed).toBe(true);
    expect(p?.sizingReviewed).toBe(true);
  });
});

describe("serializeReviewChecklistForDb", () => {
  it("returns null when nothing marked", () => {
    const fd = new FormData();
    expect(
      serializeReviewChecklistForDb(reviewChecklistFromFormData(fd))
    ).toBeNull();
  });

  it("serializes when at least one checkbox", () => {
    const fd = new FormData();
    fd.set("checkStopReviewed", "on");
    const json = serializeReviewChecklistForDb(reviewChecklistFromFormData(fd));
    expect(json).toContain("stopReviewed");
    expect(parseReviewChecklistJson(JSON.parse(json!))).not.toBeNull();
  });
});
