import type { Trade } from "@/generated/prisma/client";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { DecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import type { V3TradeGate } from "@/lib/dashboard/dashboard-v3-view-model";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { CommandDeckCollapsible } from "@/components/command-deck";
import { DashboardEntrance } from "@/components/dashboard/dashboard-entrance";
import { DashboardCommandPanel } from "@/components/dashboard/dashboard-command-panel";
import { DashboardOpportunityCandidates } from "@/components/dashboard/dashboard-opportunity-candidates";
import { DashboardNearMissRejectionsPanel } from "@/components/dashboard/dashboard-near-miss-rejections-panel";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";
import { DashboardRiskRail } from "@/components/dashboard/dashboard-risk-rail";
import { DashboardTradeGatePanel } from "@/components/dashboard/dashboard-trade-gate-panel";
import { DashboardPortfolioGuardrailsPanel } from "@/components/dashboard/dashboard-portfolio-guardrails-panel";
import { DashboardTomorrowPlan } from "@/components/dashboard/dashboard-tomorrow-plan";
import { DashboardSecondaryIntelligence } from "@/components/dashboard/dashboard-secondary-intelligence";
import { DashboardBookSnapshot } from "@/components/dashboard/dashboard-book-snapshot";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";

export type DashboardDecisionCockpitProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  cockpitDto: DecisionCockpitDto;
  surfacedCount: number;
  portfolioRiskConfigured: boolean;
  trades: Trade[];
  tradesError?: boolean;
  activeWatchItems: DashboardWatchlistItem[];
  watchlistTruncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
  tradeGate: V3TradeGate;
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError?: boolean;
};

/**
 * Decision Cockpit — verdict -> evidence -> opportunities -> guardrails ->
 * tomorrow's plan -> book snapshot (docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md).
 * Composes the dashboard-* panel family; the panels themselves already read
 * DecisionCockpitDto fields directly, so this assembler only sequences them.
 */
export function DashboardDecisionCockpit({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  cockpitDto,
  surfacedCount,
  portfolioRiskConfigured,
  trades,
  tradesError = false,
  activeWatchItems,
  watchlistTruncated = false,
  latestCloseBySymbol,
  tradeGate,
  vnindexHistory,
  vnindexHistoryError = false,
}: DashboardDecisionCockpitProps) {
  return (
    <DashboardEntrance>
      <div className="command-deck__command-band" data-testid="dashboard-v2-hero-band">
        <DashboardCommandPanel
          freshness={freshness}
          latestScan={latestScan}
          scanDelayedBackdrop={scanDelayedBackdrop}
          verdict={cockpitDto.verdict}
          surfacedCount={surfacedCount}
          evidence={cockpitDto.evidence}
          blockers={cockpitDto.blockers}
          vnindexHistory={vnindexHistory}
          vnindexHistoryError={vnindexHistoryError}
        />
      </div>

      <section
        className="command-deck-opportunity dash-v2-zone dash-v2-zone--context"
        data-testid="dashboard-cockpit-zone-opportunity"
        aria-labelledby="dashboard-opportunity-heading"
      >
        <header className="dash-v2-zone-header">
          <p className="dash-v2-eyebrow">Opportunities</p>
          <h2 id="dashboard-opportunity-heading" className="dash-v2-zone-title">
            Opportunity board
          </h2>
          <p className="dash-v2-zone-lead">
            Tier actions, near-miss path, and setup quality — compare before you log risk.
          </p>
        </header>

        <div className="command-deck-opportunity__body dash-v2-zone__body">
          <div className="command-deck__opportunity-row">
            {cockpitDto.opportunity.mode === "candidates" ? (
              <DashboardOpportunityCandidates opportunity={cockpitDto.opportunity} />
            ) : (
              <DashboardNearMissRejectionsPanel opportunity={cockpitDto.opportunity} />
            )}
            <DashboardRiskRail
              risk={cockpitDto.risk}
              verdict={cockpitDto.verdict}
              riskBudgetHeadroom={cockpitDto.riskBudgetHeadroom}
              portfolioRiskConfigured={portfolioRiskConfigured}
              riskToStop={cockpitDto.riskToStop}
              markToMarketExposure={cockpitDto.markToMarketExposure}
              recommendedPositionSizing={cockpitDto.recommendedPositionSizing}
              confidenceBand={cockpitDto.verdict.confidenceBand.value}
            />
          </div>

          <div className="dash-v2-card dash-v2-card--inset dash-v2-card--muted">
            <DashboardSetupQualityLadder ladder={cockpitDto.setupQualityLadder} />
          </div>

          <DashboardTradeGatePanel tradeGate={tradeGate} />

          {cockpitDto.portfolioGuardrails ? (
            <DashboardPortfolioGuardrailsPanel guardrails={cockpitDto.portfolioGuardrails} />
          ) : null}
        </div>
      </section>

      <div className="command-deck__tomorrow">
        <div className="dash-v2-card dash-v2-card--inset">
          <DashboardTomorrowPlan tomorrow={cockpitDto.tomorrow} />
        </div>
      </div>

      <CommandDeckCollapsible
        summary="Secondary intelligence — watchlist & gate blockers"
        testId="dashboard-secondary-collapsible"
      >
        <DashboardSecondaryIntelligence
          diagnostics={cockpitDto.actionableDiagnostics}
          watchItems={activeWatchItems}
          watchItemsTruncated={watchlistTruncated}
          latestCloseBySymbol={latestCloseBySymbol}
          rsNearMissWatchlist={cockpitDto.rsNearMissWatchlist}
          embedded
        />
      </CommandDeckCollapsible>

      <DashboardBookSnapshot trades={trades} tradesError={tradesError} />
    </DashboardEntrance>
  );
}
