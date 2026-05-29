import type { Trade } from "@/generated/prisma/client";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  BestSetupsPanelPresentation,
  DecisionCockpitDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import { CommandDeckCollapsible } from "@/components/command-deck";
import { DashboardEntrance } from "@/components/dashboard/dashboard-entrance";
import { DashboardCommandPanel } from "@/components/dashboard/dashboard-command-panel";
import { DashboardOpportunityBoard } from "@/components/dashboard/dashboard-opportunity-board";
import { DashboardRiskRail } from "@/components/dashboard/dashboard-risk-rail";
import { DashboardActionableSetupsZone } from "@/components/dashboard/dashboard-actionable-setups-zone";
import { DashboardTomorrowPlan } from "@/components/dashboard/dashboard-tomorrow-plan";
import { DashboardSecondaryIntelligence } from "@/components/dashboard/dashboard-secondary-intelligence";
import { DashboardBookSnapshot } from "@/components/dashboard/dashboard-book-snapshot";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";

export type DashboardCommandCenterProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  cockpitDto: DecisionCockpitDto;
  surfacedCount: number;
  topSetups: SurfacedCandidateHealthView[];
  bestSetupsPresentation: BestSetupsPanelPresentation;
  portfolioRiskConfigured: boolean;
  trades: Trade[];
  activeWatchItems: DashboardWatchlistItem[];
  latestCloseBySymbol: Map<string, number>;
};

export function DashboardCommandCenter({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  cockpitDto,
  surfacedCount,
  topSetups,
  bestSetupsPresentation,
  portfolioRiskConfigured,
  trades,
  activeWatchItems,
  latestCloseBySymbol,
}: DashboardCommandCenterProps) {
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
        />
      </div>

      <div className="command-deck__opportunity-row">
        <DashboardOpportunityBoard
          opportunity={cockpitDto.opportunity}
          ladder={cockpitDto.setupQualityLadder}
        />
        <DashboardRiskRail
          risk={cockpitDto.risk}
          verdict={cockpitDto.verdict}
          riskBudgetHeadroom={cockpitDto.riskBudgetHeadroom}
          portfolioRiskConfigured={portfolioRiskConfigured}
        />
      </div>

      <DashboardActionableSetupsZone
        topSetups={topSetups}
        bestSetupsPresentation={bestSetupsPresentation}
      />

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
          latestCloseBySymbol={latestCloseBySymbol}
          rsNearMissWatchlist={cockpitDto.rsNearMissWatchlist}
          embedded
        />
      </CommandDeckCollapsible>

      <DashboardBookSnapshot trades={trades} />
    </DashboardEntrance>
  );
}
