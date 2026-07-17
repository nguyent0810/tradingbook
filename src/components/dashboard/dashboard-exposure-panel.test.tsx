import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardExposurePanel } from "./dashboard-exposure-panel";

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
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    ...overrides,
  };
}

describe("DashboardExposurePanel — stance box tone", () => {
  it("colors the stance box for the danger tone when the verdict is NO_TRADE", () => {
    const dto = buildDecisionCockpitDto(minimalInput());
    expect(dto.verdict.uxLevel.value).toBe("NO_TRADE");

    const html = renderToStaticMarkup(
      <DashboardExposurePanel
        risk={dto.risk}
        verdict={dto.verdict}
        riskBudgetHeadroom={dto.riskBudgetHeadroom}
        portfolioRiskConfigured={false}
        riskToStop={{ knownRiskVnd: 0, knownStopCount: 0, unknownStopCount: 0 }}
        markToMarketExposure={{ available: true, exposureVnd: 0, missingCloseCount: 0, unavailableReason: null }}
      />
    );

    expect(html).toContain('data-testid="dashboard-exposure-stance"');
    expect(html).toContain("dash-exposure__stance-box--danger");
  });
});

describe("DashboardExposurePanel — equity not configured", () => {
  it("shows a prominent banner linking to /settings instead of a quiet env-var hint", () => {
    const dto = buildDecisionCockpitDto(minimalInput());
    expect(dto.riskBudgetHeadroom.status).toBe("unavailable");

    const html = renderToStaticMarkup(
      <DashboardExposurePanel
        risk={dto.risk}
        verdict={dto.verdict}
        riskBudgetHeadroom={dto.riskBudgetHeadroom}
        portfolioRiskConfigured={false}
        riskToStop={{ knownRiskVnd: 0, knownStopCount: 0, unknownStopCount: 0 }}
        markToMarketExposure={{ available: true, exposureVnd: 0, missingCloseCount: 0, unavailableReason: null }}
      />
    );

    expect(html).toContain('data-testid="dashboard-risk-guardrail-equity-not-configured-banner"');
    expect(html).toContain('href="/settings"');
  });
});
