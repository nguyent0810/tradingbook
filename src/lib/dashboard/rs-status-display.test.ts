import { describe, expect, it } from "vitest";
import {
  earlyResearchBadgeTone,
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  hasBadRiskReward,
  rowMatchesAvoidChase,
  setupBadgeTone,
  setupStateTooltip,
  workbenchActionLabel,
  workbenchActionTooltip,
  WORKBENCH_ACTION_TOOLTIPS,
} from "./rs-status-display";
import type { RelativeStrengthRow } from "@/components/command-deck/types";

function baseRow(partial: Partial<RelativeStrengthRow> = {}): RelativeStrengthRow {
  return {
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
    earlyEntry: null,
    ...partial,
  };
}

describe("rs-status-display", () => {
  it("maps setup state labels for workbench UI", () => {
    expect(friendlySetupStateLabel("Watch: breakout")).toBe("Chờ breakout");
    expect(friendlySetupStateLabel("Blocked: zone")).toBe("Sai vùng");
    expect(friendlySetupStateLabel("Blocked: MA50")).toBe("Dưới MA50");
  });

  it("maps early state labels for workbench UI", () => {
    expect(friendlyEarlyStateLabel("Pilot Candidate")).toBe("Nghiên cứu thử nghiệm");
    expect(friendlyEarlyStateLabel("Extended — Do Not Chase")).toBe("Quá mở rộng");
    expect(friendlyEarlyStateLabel("Add Zone")).toBe("Vùng gia tăng theo dõi");
  });

  it("provides tooltips for friendly labels", () => {
    expect(setupStateTooltip("Blocked: zone")).toContain("vùng vào lệnh");
    expect(setupStateTooltip("Watch: breakout")).toContain("breakout");
  });

  it("maps avoid chase when early research is too extended", () => {
    const row = baseRow({
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
    });
    expect(workbenchActionLabel(row)).toBe("Tránh đuổi giá");
    expect(rowMatchesAvoidChase(row)).toBe(true);
  });

  it("maps avoid chase for bad zone with bad R:R", () => {
    const row = baseRow({
      earlyEntry: {
        earlyReversalScore: 20,
        proposedTradeState: "Watch",
        entryType: "pilot",
        reasonCodes: ["BAD_RR"],
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
        rrRejectionReason: "Poor R:R",
        distFromMa20Pct: 2,
      },
    });
    expect(hasBadRiskReward(row)).toBe(true);
    expect(workbenchActionLabel(row)).toBe("Tránh đuổi giá");
  });

  it("maps wait better zone for bad zone without bad R:R", () => {
    expect(workbenchActionLabel(baseRow())).toBe("Chờ vùng tốt hơn");
  });

  it("prioritizes watch trigger over pilot research when setup is wait breakout", () => {
    const row = baseRow({
      setupState: "Watch: breakout",
      terminalCode: "breakout_recency",
      earlyEntry: {
        earlyReversalScore: 59,
        proposedTradeState: "Pilot Candidate",
        entryType: "pilot",
        reasonCodes: [],
        transitionReasonCodes: [],
        invalidLevel: 19,
        invalidLevelReason: null,
        stopDistancePct: 4,
        targetPrice: 22,
        targetReason: null,
        estimatedRewardPct: 10,
        estimatedRiskReward: 2.04,
        suggestedPilotSizePct: 25,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
        distFromMa20Pct: 3.2,
      },
    });
    expect(workbenchActionLabel(row)).toBe("Theo dõi kích hoạt");
  });

  it("maps paper watch only when no setup gate applies", () => {
    const row = baseRow({
      setupState: "Qualified",
      terminalCode: "other",
      earlyEntry: {
        earlyReversalScore: 40,
        proposedTradeState: "Pilot Candidate",
        entryType: "pilot",
        reasonCodes: [],
        transitionReasonCodes: [],
        invalidLevel: 10,
        invalidLevelReason: null,
        stopDistancePct: 3,
        targetPrice: 20,
        targetReason: null,
        estimatedRewardPct: 5,
        estimatedRiskReward: 2.5,
        suggestedPilotSizePct: 1,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
        distFromMa20Pct: 2.1,
      },
    });
    expect(workbenchActionLabel(row)).toBe("Theo dõi xác thực");
  });

  it("provides concise action tooltips", () => {
    expect(WORKBENCH_ACTION_TOOLTIPS["Tránh đuổi giá"]).toContain("FOMO");
    expect(workbenchActionTooltip(baseRow())).toContain("vùng vào lệnh");
  });

  it("uses danger for blocked setup and info for early research", () => {
    expect(setupBadgeTone("Blocked: zone")).toBe("danger");
    expect(setupBadgeTone("Watch: breakout")).toBe("warning");
    expect(earlyResearchBadgeTone("Pilot Candidate")).toBe("info");
    expect(earlyResearchBadgeTone("Extended — Do Not Chase")).toBe("danger");
  });
});
