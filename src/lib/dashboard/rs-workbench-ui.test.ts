import { describe, expect, it } from "vitest";
import type { RelativeStrengthRow } from "@/components/command-deck/types";
import {
  countWorkbenchRowsByFilter,
  filterEmptyStateMessage,
  filterWorkbenchRows,
  sortWorkbenchRows,
} from "./rs-workbench-ui";
import { sectorForSymbol } from "./rs-sector-display";

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

  it("counts rows per filter chip", () => {
    const counts = countWorkbenchRowsByFilter(rows);
    expect(counts.all).toBe(3);
    expect(counts.wait_breakout).toBe(1);
    expect(counts.pilot_research).toBe(1);
    expect(counts.bank_only).toBe(1);
  });

  it("returns pilot research empty state copy", () => {
    expect(filterEmptyStateMessage("pilot_research", 0)).toBe(
      "No Pilot Research candidates today. This is normal. Do not force trades."
    );
    expect(filterEmptyStateMessage("pilot_research", 2)).toBeNull();
  });

  it("returns bank-only empty state copy", () => {
    expect(filterEmptyStateMessage("bank_only", 0)).toBe(
      "No bank symbols in the current filtered set."
    );
  });

  it("maps BVB and ABB as bank for bank-only filter", () => {
    const bankRows = [
      row({ symbol: "BVB", terminalCode: "breakout_recency" }),
      row({ symbol: "ABB", terminalCode: "breakout_recency" }),
      row({ symbol: "HPG", terminalCode: "breakout_recency", sectorLabel: "Industrial" }),
    ];
    expect(sectorForSymbol("BVB")).toBe("bank");
    expect(sectorForSymbol("ABB")).toBe("bank");
    const filtered = filterWorkbenchRows(bankRows, "bank_only");
    expect(filtered.map((r) => r.symbol).sort()).toEqual(["ABB", "BVB"]);
  });
});
