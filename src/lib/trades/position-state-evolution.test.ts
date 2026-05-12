import { describe, expect, it } from "vitest";
import {
  derivePositionEvolution,
  type PositionEvolutionInput,
} from "./position-state-evolution";

function baseInput(
  over: Partial<PositionEvolutionInput>
): PositionEvolutionInput {
  return {
    operatingPosture: "stable",
    reviewedToday: false,
    stopBand: "comfortable",
    surface: "review_completed",
    marketDataStale: false,
    deterioratedVsReview: false,
    escalationCueCount: 0,
    priorityTier: "routine_review",
    latestReviewOutcome: null,
    ...over,
  };
}

describe("derivePositionEvolution", () => {
  it("returns deteriorating on stop breach", () => {
    const r = derivePositionEvolution(
      baseInput({ stopBand: "breached", reviewedToday: true })
    );
    expect(r.state).toBe("deteriorating");
    expect(r.explainLine).toBeTruthy();
  });

  it("returns persistent_pressure when urgent tier and checkpoint pending", () => {
    const r = derivePositionEvolution(
      baseInput({
        reviewedToday: false,
        priorityTier: "urgent",
        stopBand: "comfortable",
      })
    );
    expect(r.state).toBe("persistent_pressure");
  });

  it("returns stable_reviewed when reviewed, stable posture, comfortable stop", () => {
    const r = derivePositionEvolution(
      baseInput({
        reviewedToday: true,
        operatingPosture: "stable",
        stopBand: "comfortable",
      })
    );
    expect(r.state).toBe("stable_reviewed");
  });

  it("returns recovering on constructive outcome after checkpoint", () => {
    const r = derivePositionEvolution(
      baseInput({
        reviewedToday: true,
        operatingPosture: "cautious",
        latestReviewOutcome: "holding_as_planned",
        stopBand: "comfortable",
        surface: "review_completed",
      })
    );
    expect(r.state).toBe("recovering");
  });
});
