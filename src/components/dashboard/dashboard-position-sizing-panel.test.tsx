import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PositionSizingPanelDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardPositionSizingPanel } from "./dashboard-position-sizing-panel";

function sizing(overrides: Partial<PositionSizingPanelDto> = {}): PositionSizingPanelDto {
  return {
    symbol: "HPG",
    quality: "A",
    ladderStage: "tier_a",
    entryVndPerShare: 100_000,
    rawStopVndPerShare: 97_000,
    effectiveStopVndPerShare: 96_500,
    perShareRiskVnd: 3_500,
    qtyShares: 200,
    qtyBeforeAdjustmentsShares: 250,
    notionalVnd: 20_000_000,
    riskAtStopVnd: 700_000,
    positionPctOfAccount: 2,
    baseRiskPerTradePct: 0.01,
    maxPerTradeExposurePct: 0.2,
    liquidityCapApplied: false,
    liquidityDataAvailable: true,
    advVnd: 50_000_000_000,
    boardLotShares: 100,
    gaps: [],
    ...overrides,
  };
}

describe("DashboardPositionSizingPanel", () => {
  it("shows a prominent equity-not-configured banner (not just a hint) when equity is unconfigured", () => {
    const html = renderToStaticMarkup(
      <DashboardPositionSizingPanel
        recommendedPositionSizing={null}
        portfolioRiskConfigured={false}
        confidenceBand="high"
      />
    );
    expect(html).toContain('data-testid="dashboard-equity-not-configured-banner"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain("TRADING_ACCOUNT_EQUITY_VND");
    expect(html).not.toContain('data-testid="dashboard-position-sizing-recommendation"');
  });

  it("shows a low-confidence empty reason (no recommendation) when confidence is low and equity IS configured", () => {
    const html = renderToStaticMarkup(
      <DashboardPositionSizingPanel
        recommendedPositionSizing={null}
        portfolioRiskConfigured={true}
        confidenceBand="low"
      />
    );
    expect(html).not.toContain('data-testid="dashboard-equity-not-configured-banner"');
    expect(html).toContain('data-testid="dashboard-position-sizing-empty"');
    expect(html).toContain("confidence is low");
  });

  it("renders the recommended quantity, notional, and risk-at-stop when a recommendation exists", () => {
    const html = renderToStaticMarkup(
      <DashboardPositionSizingPanel
        recommendedPositionSizing={sizing()}
        portfolioRiskConfigured={true}
        confidenceBand="high"
      />
    );
    expect(html).toContain('data-testid="dashboard-position-sizing-recommendation"');
    expect(html).toContain("HPG");
    expect(html).toContain('data-testid="dashboard-position-sizing-qty"');
  });

  it("clearly flags a qtyShares === 0 recommendation as 'no position' rather than a bare, unexplained zero", () => {
    const html = renderToStaticMarkup(
      <DashboardPositionSizingPanel
        recommendedPositionSizing={sizing({
          qtyShares: 0,
          notionalVnd: 0,
          riskAtStopVnd: 0,
          gaps: [
            "Risk-based size rounds down to less than one board lot (100 shares) — no position recommended today.",
          ],
        })}
        portfolioRiskConfigured={true}
        confidenceBand="high"
      />
    );
    // Still the "recommendation" branch (not the null/empty-reason branch) — qtyShares 0 is a
    // distinct, DTO-driven state from "no eligible candidate", so it must render its own caveat.
    expect(html).toContain('data-testid="dashboard-position-sizing-recommendation"');
    expect(html).toContain("less than one board lot");
  });
});
