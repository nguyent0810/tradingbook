import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpportunityBoardDto, OpportunityNearMissDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardNearMissRejectionsPanel } from "./dashboard-near-miss-rejections-panel";

function nearMissRow(overrides: Partial<OpportunityNearMissDto> = {}): OpportunityNearMissDto {
  return {
    symbol: "ABB",
    terminalCategory: "pullback_zone_interaction",
    terminalCode: null,
    ladderStage: "watch",
    executionStatus: "INVALID",
    executionStatusLabel: "Not valid entry",
    waitFor: "A dip or reclaim into the pullback zone.",
    distanceToZonePct: null,
    rsDiagnostic: null,
    actionHint: "Not a trade signal — watch only",
    provenance: "real",
    partialPipelineScore: 64,
    ...overrides,
  };
}

describe("DashboardNearMissRejectionsPanel", () => {
  it("renders the execution status chip but not the raw internal pipeline score", () => {
    const opportunity: OpportunityBoardDto = {
      mode: "near_miss",
      candidates: [],
      nearMiss: [nearMissRow({ symbol: "ABB", partialPipelineScore: 64.4 })],
      emptyReason: null,
    };

    const html = renderToStaticMarkup(
      <DashboardNearMissRejectionsPanel opportunity={opportunity} />
    );

    expect(html).toContain('data-testid="dashboard-near-miss-diagnostic-status"');
    expect(html).not.toContain('data-testid="dashboard-near-miss-score-ABB"');
  });

  it("renders the empty state when there is no near-miss data", () => {
    const opportunity: OpportunityBoardDto = {
      mode: "empty",
      candidates: [],
      nearMiss: [],
      emptyReason: "No daily scan yet.",
    };

    const html = renderToStaticMarkup(
      <DashboardNearMissRejectionsPanel opportunity={opportunity} />
    );

    expect(html).toContain('data-testid="dashboard-near-miss-empty"');
  });
});
