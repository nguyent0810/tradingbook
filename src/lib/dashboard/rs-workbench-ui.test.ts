import { describe, expect, it } from "vitest";
import type { RelativeStrengthRow } from "@/components/command-deck/types";
import { filterWorkbenchRows, sortWorkbenchRows } from "./rs-workbench-ui";

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

describe("rs-workbench-ui", () => {
  const rows: RelativeStrengthRow[] = [
    row({ symbol: "ACB", terminalCode: "breakout_recency", setupState: "Watch: breakout" }),
    row({
      symbol: "VND",
      terminalCode: "pullback_zone_interaction",
      setupState: "Blocked: zone",
      rs20: 11,
    }),
    row({
      symbol: "HPG",
      terminalCode: "trend_below_ma50",
      setupState: "Blocked: MA50",
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
    }),
  ];

  it("filters wait breakout rows", () => {
    const filtered = filterWorkbenchRows(rows, "wait_breakout");
    expect(filtered.map((r) => r.symbol)).toEqual(["ACB"]);
  });

  it("filters bank only rows", () => {
    const filtered = filterWorkbenchRows(rows, "bank_only");
    expect(filtered.map((r) => r.symbol)).toEqual(["ACB"]);
  });

  it("sorts by MA20 distance ascending", () => {
    const sorted = sortWorkbenchRows(rows, "ma20_dist_asc");
    expect(sorted[0]?.symbol).toBe("HPG");
  });
});
