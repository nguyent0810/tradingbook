import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { DashboardSignalsRail } from "./dashboard-signals-rail";

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

const risingHistory: VnindexHistoryPoint[] = [
  { date: "2026-05-01", close: 1000 },
  { date: "2026-05-02", close: 1050 },
];
const fallingHistory: VnindexHistoryPoint[] = [
  { date: "2026-05-01", close: 1050 },
  { date: "2026-05-02", close: 1000 },
];

describe("DashboardSignalsRail", () => {
  it("renders all 5 signal rows expanded by default", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    const html = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={risingHistory}
      />
    );

    expect(html).toContain('data-testid="dashboard-signals-rail"');
    expect(html).not.toContain("dash-signals-rail--collapsed");
    expect(html).toContain("Market data");
    expect(html).toContain("Scan pulse");
    expect(html).toContain("Confidence");
    expect(html).toContain("VNINDEX");
    expect(html).toContain("Hostility");
  });

  it("tints the market-data icon safe when data is aligned", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    const html = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={risingHistory}
      />
    );
    expect(html).toContain("Aligned");
    expect(html).toContain("dash-rail-icon--safe");
  });

  it("tints the VNINDEX icon safe when the index closed up, danger when down", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    const up = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={risingHistory}
      />
    );
    const down = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={fallingHistory}
      />
    );
    expect(up).toContain("1,050");
    expect(down).toContain("1,000");
  });

  it("shows the current confidence band label", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    const html = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={risingHistory}
      />
    );
    const bandLabel = { high: "High", medium: "Medium", low: "Low" }[
      cockpitDto.verdict.confidenceBand.value
    ];
    expect(html).toContain(bandLabel);
  });

  it("embeds the scan-pulse widget without its own duplicate header", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    const html = renderToStaticMarkup(
      <DashboardSignalsRail
        freshness={freshness}
        latestScan={null}
        scanDelayedBackdrop={null}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={risingHistory}
      />
    );
    expect(html).toContain('data-testid="dashboard-setup-quality-ladder"');
    expect(html).not.toContain("dash-pulse-header");
  });
});
