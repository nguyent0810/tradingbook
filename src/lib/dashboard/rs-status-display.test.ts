import { describe, expect, it } from "vitest";
import {
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  setupStateTooltip,
  workbenchActionLabel,
} from "./rs-status-display";
import type { RelativeStrengthRow } from "@/components/command-deck/types";

describe("rs-status-display", () => {
  it("maps setup state labels for workbench UI", () => {
    expect(friendlySetupStateLabel("Watch: breakout")).toBe("Wait Breakout");
    expect(friendlySetupStateLabel("Blocked: zone")).toBe("Bad Zone");
    expect(friendlySetupStateLabel("Blocked: MA50")).toBe("Below MA50");
  });

  it("maps early state labels for workbench UI", () => {
    expect(friendlyEarlyStateLabel("Pilot Candidate")).toBe("Pilot Research");
    expect(friendlyEarlyStateLabel("Extended — Do Not Chase")).toBe("Too Extended");
    expect(friendlyEarlyStateLabel("Add Zone")).toBe("Add Watch");
  });

  it("provides tooltips for friendly labels", () => {
    expect(setupStateTooltip("Blocked: zone")).toContain("entry zone");
    expect(setupStateTooltip("Watch: breakout")).toContain("breakout");
  });

  it("maps workbench action labels from setup and early state", () => {
    const base: RelativeStrengthRow = {
      symbol: "BVB",
      rs20: 13.7,
      rs50: 1,
      rsStrength: "Strong RS",
      setupState: "Blocked: zone",
      reason: "zone",
      status: "blocked",
      rsStrengthScore: null,
      setupReadinessScore: null,
      terminalCode: "pullback_zone_interaction",
      sectorLabel: "Bank",
      actionLabel: "Wait",
      earlyEntry: {
        earlyReversalScore: 30,
        proposedTradeState: "Extended — Do Not Chase",
        entryType: "pilot",
        reasonCodes: [],
        transitionReasonCodes: [],
        invalidLevel: 10,
        invalidLevelReason: null,
        stopDistancePct: 4,
        targetPrice: 12,
        targetReason: null,
        estimatedRewardPct: 2,
        estimatedRiskReward: 0.3,
        suggestedPilotSizePct: 0,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
        distFromMa20Pct: 6,
      },
    };
    expect(workbenchActionLabel(base)).toBe("Avoid chase");
    expect(workbenchActionLabel({ ...base, earlyEntry: null })).toBe("Wait better zone");
    expect(
      workbenchActionLabel({
        ...base,
        setupState: "Watch: breakout",
        earlyEntry: {
          ...base.earlyEntry!,
          proposedTradeState: "Pilot Candidate",
        },
      })
    ).toBe("Paper watch only");
  });
});
