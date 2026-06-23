import { describe, expect, it } from "vitest";
import type { RelativeStrengthRow } from "@/components/command-deck/types";
import {
  buildRadarNodesFromWorkbenchRows,
  summarizeWorkbenchRadar,
} from "./rs-radar-from-workbench";

function row(partial: Partial<RelativeStrengthRow> & { symbol: string }): RelativeStrengthRow {
  return {
    rs20: 5,
    rs50: 2,
    rsStrength: "Mild RS",
    setupState: "Watch: breakout",
    reason: "test",
    status: "watch",
    rsStrengthScore: null,
    setupReadinessScore: null,
    terminalCode: "breakout_recency",
    sectorLabel: "Bank",
    actionLabel: "Wait",
    ...partial,
  };
}

describe("rs-radar-from-workbench", () => {
  const workbenchRows: RelativeStrengthRow[] = [
    row({ symbol: "BVB", rs20: 13.7, setupState: "Blocked: zone" }),
    row({
      symbol: "ABB",
      rs20: 11.2,
      earlyEntry: {
        earlyReversalScore: 45,
        proposedTradeState: "Extended — Do Not Chase",
        entryType: "pilot",
        reasonCodes: ["EXTENDED_FROM_MA20"],
        transitionReasonCodes: [],
        invalidLevel: 12,
        invalidLevelReason: null,
        stopDistancePct: 4,
        targetPrice: 15,
        targetReason: null,
        estimatedRewardPct: 3,
        estimatedRiskReward: 0.3,
        suggestedPilotSizePct: 0,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
        distFromMa20Pct: 8.5,
      },
    }),
    row({
      symbol: "ACB",
      rs20: 9.1,
      earlyEntry: {
        earlyReversalScore: 62,
        proposedTradeState: "Pilot Candidate",
        entryType: "pilot",
        reasonCodes: [],
        transitionReasonCodes: [],
        invalidLevel: 20,
        invalidLevelReason: null,
        stopDistancePct: 3,
        targetPrice: 25,
        targetReason: null,
        estimatedRewardPct: 8,
        estimatedRiskReward: 2.1,
        suggestedPilotSizePct: 25,
        sizingNote: null,
        whyNotPilotYet: null,
        rrRejectionReason: null,
        distFromMa20Pct: 2,
      },
    }),
  ];

  it("builds radar nodes from workbench symbols without sample placeholders", () => {
    const nodes = buildRadarNodesFromWorkbenchRows(workbenchRows);
    expect(nodes.map((n) => n.symbol).sort()).toEqual(["ABB", "ACB", "BVB"]);
    for (const node of nodes) {
      expect(node.reason).not.toContain("Blocked sample");
      expect(node.tier).not.toContain("sample");
    }
  });

  it("classifies extended rows as avoid", () => {
    const nodes = buildRadarNodesFromWorkbenchRows(workbenchRows);
    const abb = nodes.find((n) => n.symbol === "ABB");
    expect(abb?.classification).toBe("avoid");
    expect(abb?.tier).toBe("Too Extended");
  });

  it("summarizes pilot research, watch, and too extended counts", () => {
    const summary = summarizeWorkbenchRadar(workbenchRows);
    expect(summary.pilotResearch).toBe(1);
    expect(summary.tooExtended).toBe(1);
    expect(summary.watch).toBe(1);
    expect(summary.bestRs).toEqual(["BVB", "ABB", "ACB"]);
  });
});
