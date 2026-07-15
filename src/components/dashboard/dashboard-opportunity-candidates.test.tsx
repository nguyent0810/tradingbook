import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpportunityBoardDto, OpportunityCandidateDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardOpportunityCandidates } from "./dashboard-opportunity-candidates";

function candidate(overrides: Partial<OpportunityCandidateDto> = {}): OpportunityCandidateDto {
  return {
    candidateId: "cand-1",
    symbol: "HPG",
    quality: "A",
    ladderStage: "tier_a",
    healthLevel: "HEALTHY",
    healthSummary: "Setup is healthy and holding the breakout level.",
    primaryReasons: ["Breakout confirmed", "Volume expansion"],
    rankSummary: "Strong (88)",
    rankScore: 88,
    rsDiagnostic: null,
    actionHint: "Log trade — entry confirmed",
    provenance: "real",
    ...overrides,
  };
}

describe("DashboardOpportunityCandidates", () => {
  it("renders up to 5 candidate cards with symbol, tier, and action hint", () => {
    const opportunity: OpportunityBoardDto = {
      mode: "candidates",
      candidates: [
        candidate({ candidateId: "a", symbol: "HPG" }),
        candidate({ candidateId: "b", symbol: "FPT", quality: "B", ladderStage: "tier_b" }),
      ],
      nearMiss: [],
      emptyReason: null,
    };

    const html = renderToStaticMarkup(
      <DashboardOpportunityCandidates opportunity={opportunity} />
    );

    expect(html).toContain('data-testid="dashboard-opportunity-candidates-panel"');
    expect(html).toContain('data-testid="dashboard-opportunity-HPG"');
    expect(html).toContain('data-testid="dashboard-opportunity-FPT"');
    expect(html).toContain("Log trade — entry confirmed");
    expect(html).toContain("Breakout confirmed");
  });

  it("caps rendered cards at 5 even when more candidates are surfaced", () => {
    const opportunity: OpportunityBoardDto = {
      mode: "candidates",
      candidates: Array.from({ length: 8 }, (_, i) =>
        candidate({ candidateId: `c${i}`, symbol: `SYM${i}` })
      ),
      nearMiss: [],
      emptyReason: null,
    };

    const html = renderToStaticMarkup(
      <DashboardOpportunityCandidates opportunity={opportunity} />
    );

    const cardCount = (html.match(/data-testid="dashboard-opportunity-SYM/g) ?? []).length;
    expect(cardCount).toBe(5);
  });

  it("links to /setups for the full pipeline", () => {
    const opportunity: OpportunityBoardDto = {
      mode: "candidates",
      candidates: [candidate()],
      nearMiss: [],
      emptyReason: null,
    };

    const html = renderToStaticMarkup(
      <DashboardOpportunityCandidates opportunity={opportunity} />
    );

    expect(html).toContain('href="/setups"');
    expect(html).not.toContain("/trades/new");
  });
});
