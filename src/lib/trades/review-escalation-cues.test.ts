import { describe, expect, it } from "vitest";
import { deriveEscalationCues } from "./review-escalation-cues";

describe("deriveEscalationCues", () => {
  it("surfaces breached stop without today's checkpoint", () => {
    const cues = deriveEscalationCues({
      priorityTier: "urgent",
      stopBand: "breached",
      surface: "stop_violated",
      marketDataStale: false,
      reviewedToday: false,
      deterioratedVsReview: false,
      failedBreakoutHold: false,
    });
    expect(cues.length).toBeGreaterThan(0);
    expect(cues[0].toLowerCase()).toContain("stop");
  });

  it("notes pending checkpoint for routine tier", () => {
    const cues = deriveEscalationCues({
      priorityTier: "routine_review",
      stopBand: "comfortable",
      surface: "review_needed",
      marketDataStale: false,
      reviewedToday: false,
      deterioratedVsReview: false,
      failedBreakoutHold: false,
    });
    expect(cues.some((c) => c.includes("checkpoint"))).toBe(true);
  });

  it("caps at two cues", () => {
    const cues = deriveEscalationCues({
      priorityTier: "routine_review",
      stopBand: "tight",
      surface: "review_needed",
      marketDataStale: true,
      reviewedToday: false,
      deterioratedVsReview: true,
      failedBreakoutHold: true,
    });
    expect(cues.length).toBeLessThanOrEqual(2);
  });
});
