import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LadderStageGroupDto, SetupQualityLadderDto } from "@/lib/dashboard/decision-cockpit-dto";
import { SETUP_LADDER_STAGE_ORDER } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardSetupQualityLadder } from "./dashboard-setup-quality-ladder";

function stageGroup(overrides: Partial<LadderStageGroupDto> = {}): LadderStageGroupDto {
  return {
    stage: "tier_a",
    label: "Tier A",
    subtitle: "Cleared today",
    count: 0,
    sampleSymbols: [],
    provenance: "derived",
    ...overrides,
  };
}

function ladderDto(overrides: Partial<SetupQualityLadderDto> = {}): SetupQualityLadderDto {
  const stages = SETUP_LADDER_STAGE_ORDER.map((stage) => stageGroup({ stage, label: stage }));
  return {
    stages,
    totalClassified: 0,
    summary: "No candidates classified in the latest scan.",
    ...overrides,
  };
}

describe("DashboardSetupQualityLadder", () => {
  it("renders the plain-language summary line", () => {
    const html = renderToStaticMarkup(
      <DashboardSetupQualityLadder
        ladder={ladderDto({ summary: "Active day — 2 names cleared Tier A/B today." })}
      />
    );

    expect(html).toContain('data-testid="dashboard-ladder-summary"');
    expect(html).toContain("Active day — 2 names cleared Tier A/B today.");
  });

  it("shows only actionable (non-zero) stages in the breakdown list", () => {
    const stages = SETUP_LADDER_STAGE_ORDER.map((stage) =>
      stageGroup({
        stage,
        label: stage,
        count: stage === "tier_a" ? 2 : 0,
        sampleSymbols: stage === "tier_a" ? ["MWG", "FPT"] : [],
      })
    );

    const html = renderToStaticMarkup(
      <DashboardSetupQualityLadder ladder={ladderDto({ stages, totalClassified: 2 })} />
    );

    expect(html).toContain('data-testid="dashboard-ladder-symbols-tier_a"');
    expect(html).not.toContain('data-testid="dashboard-ladder-symbols-watch"');
  });

  it("quiet day: renders the funnel and legend with all stages, even zero-count ones", () => {
    const html = renderToStaticMarkup(
      <DashboardSetupQualityLadder
        ladder={ladderDto({ summary: "No candidates classified in the latest scan." })}
      />
    );

    for (const stage of SETUP_LADDER_STAGE_ORDER) {
      expect(html).toContain(`data-testid="dashboard-ladder-bar-${stage}"`);
      expect(html).toContain(`data-testid="dashboard-ladder-stage-${stage}"`);
    }
  });
});
