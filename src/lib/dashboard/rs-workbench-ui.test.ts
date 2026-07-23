import { describe, expect, it } from "vitest";
import type { RelativeStrengthRow } from "@/components/command-deck/types";
import {
  countWorkbenchRowsByFilter,
  filterEmptyStateMessage,
  filterWorkbenchRows,
  hasAnyEarlyEntryRows,
  sortWorkbenchRows,
  visibleFilterOptions,
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

  it("filters watch trigger rows", () => {
    const filtered = filterWorkbenchRows(rows, "watch_trigger");
    expect(filtered.map((r) => r.symbol)).toEqual(["ACB"]);
  });

  it("filters wait better zone rows", () => {
    const filtered = filterWorkbenchRows(rows, "wait_better_zone");
    expect(filtered.map((r) => r.symbol)).toEqual(["VND"]);
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
    expect(counts.watch_trigger).toBe(1);
    expect(counts.pilot_research).toBe(1);
    expect(counts.bank_only).toBe(1);
  });

  it("returns pilot research empty state copy", () => {
    expect(filterEmptyStateMessage("pilot_research", 0)).toBe(
      "Không có ứng viên Pilot Research hôm nay. Đây là điều bình thường. Đừng ép giao dịch."
    );
    expect(filterEmptyStateMessage("pilot_research", 2)).toBeNull();
  });

  it("returns bank-only empty state copy", () => {
    expect(filterEmptyStateMessage("bank_only", 0)).toBe(
      "Không có mã ngân hàng trong tập đã lọc hiện tại."
    );
  });

  it("returns avoid chase empty state copy", () => {
    expect(filterEmptyStateMessage("avoid_chase", 0)).toBe(
      "Không có mã bị đuổi giá quá mức trong lần quét hiện tại."
    );
  });

  it("hides early-entry filters when flag-off / no early rows", () => {
    const noEarly = rows.map((r) => ({ ...r, earlyEntry: null }));
    expect(hasAnyEarlyEntryRows(noEarly)).toBe(false);
    const options = visibleFilterOptions(noEarly);
    expect(options.some((o) => o.id === "pilot_research")).toBe(false);
    expect(options.some((o) => o.id === "avoid_chase")).toBe(false);
    expect(options.some((o) => o.id === "watch_trigger")).toBe(true);
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
