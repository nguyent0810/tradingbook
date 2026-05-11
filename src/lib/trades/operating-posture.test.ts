import { describe, expect, it } from "vitest";
import { deriveOperatingPosture } from "./operating-posture";

describe("deriveOperatingPosture", () => {
  const base = {
    stopBand: "comfortable" as const,
    surface: "review_needed" as const,
    marketDataStale: false,
    reviewedToday: false,
    latestReviewOutcome: null,
    escalationCueCount: 0,
  };

  it("high attention on breached stop", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        stopBand: "breached",
        surface: "under_pressure",
      }).posture
    ).toBe("high_attention");
  });

  it("high attention on exit thesis outcome", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        latestReviewOutcome: "exit_thesis_under_review",
      }).posture
    ).toBe("high_attention");
  });

  it("defensive on reduce-risk outcome", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        latestReviewOutcome: "reduce_risk_candidate",
      }).posture
    ).toBe("defensive");
  });

  it("defensive on structure weakening surface", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        surface: "structure_weakening",
      }).posture
    ).toBe("defensive");
  });

  it("cautious when stale and not reviewed", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        marketDataStale: true,
        reviewedToday: false,
      }).posture
    ).toBe("cautious");
  });

  it("stable when reviewed, comfortable, completed, no escalation", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        reviewedToday: true,
        stopBand: "comfortable",
        surface: "review_completed",
        escalationCueCount: 0,
      }).posture
    ).toBe("stable");
  });

  it("escalation cues push cautious before stable", () => {
    expect(
      deriveOperatingPosture({
        ...base,
        reviewedToday: true,
        stopBand: "comfortable",
        surface: "review_completed",
        escalationCueCount: 1,
      }).posture
    ).toBe("cautious");
  });
});
