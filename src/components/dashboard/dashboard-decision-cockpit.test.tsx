import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardDecisionCockpit } from "./dashboard-decision-cockpit";

const freshness = buildMarketFreshnessDto({
  snapshot: {
    benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
  },
});

function minimalInput(overrides: Partial<DecisionCockpitInput> = {}): DecisionCockpitInput {
  return {
    latestScan: null,
    scanNotes: null,
    liveRegime: { level: "WARNING", symbol: "VNINDEX", latestBar: null },
    freshness,
    surfacedCandidates: [],
    watchlist: [],
    ...overrides,
  };
}

describe("DashboardDecisionCockpit", () => {
  it("renders every zone of the Decision Cockpit IA in order: trust/verdict, opportunity, tomorrow, secondary", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());

    const html = renderToStaticMarkup(
      <DashboardDecisionCockpit
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        cockpitDto={cockpitDto}
        surfacedCount={0}
        activeWatchItems={[]}
        latestCloseBySymbol={new Map()}
        vnindexHistory={[]}
      />
    );

    const zoneOrder = [
      'data-testid="dashboard-v2-hero-band"',
      'data-testid="dashboard-cockpit-zone-opportunity"',
      'data-testid="dashboard-tomorrow-plan"',
      'data-testid="dashboard-cockpit-zone-next-session"',
    ];

    let cursor = -1;
    for (const marker of zoneOrder) {
      const idx = html.indexOf(marker);
      expect(idx, `expected to find ${marker}`).toBeGreaterThan(-1);
      expect(idx, `expected ${marker} to appear after the previous zone`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("renders the near-miss panel (not the candidates panel) when no candidates are surfaced", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    expect(cockpitDto.opportunity.mode).not.toBe("candidates");

    const html = renderToStaticMarkup(
      <DashboardDecisionCockpit
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        cockpitDto={cockpitDto}
        surfacedCount={0}
        activeWatchItems={[]}
        latestCloseBySymbol={new Map()}
        vnindexHistory={[]}
      />
    );

    expect(html).toContain('data-testid="dashboard-near-miss-panel"');
    expect(html).not.toContain('data-testid="dashboard-opportunity-candidates-panel"');
  });

  it("renders the candidates panel when Tier A/B setups are surfaced", () => {
    const cockpitDto = buildDecisionCockpitDto(
      minimalInput({
        latestScan: {
          id: "scan-1",
          runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
          gate1Level: "PASS",
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
        },
        surfacedCandidates: [
          {
            id: "cand-1",
            symbolKey: "HPG",
            quality: "A",
            lifecycleSortLabel: "READY",
            healthLevel: "HEALTHY",
            healthScore: 88,
            healthScoreLabel: "Strong",
            healthFlags: [],
            healthSummary: null,
            reasons: ["Breakout confirmed"],
            rankSummary: "Strong (88)",
            close: 28.5,
            pullbackZoneLow: 27.8,
            pullbackZoneHigh: 28.2,
            stopLevel: 26.8,
            rankScore: 88,
          },
        ],
      })
    );
    expect(cockpitDto.opportunity.mode).toBe("candidates");

    const html = renderToStaticMarkup(
      <DashboardDecisionCockpit
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        cockpitDto={cockpitDto}
        surfacedCount={1}
        activeWatchItems={[]}
        latestCloseBySymbol={new Map()}
        vnindexHistory={[]}
      />
    );

    expect(html).toContain('data-testid="dashboard-opportunity-candidates-panel"');
    expect(html).toContain('data-testid="dashboard-opportunity-HPG"');
  });
});
