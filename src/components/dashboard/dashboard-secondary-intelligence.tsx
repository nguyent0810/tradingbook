import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import { DashboardBestSetupsPanel } from "@/components/dashboard/dashboard-best-setups-panel";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel";
import type { ActionableDiagnosticsDto, BestSetupsPanelPresentation } from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import type { Trade } from "@/generated/prisma/client";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  topSetups: SurfacedCandidateHealthView[];
  bestSetupsPresentation: BestSetupsPanelPresentation;
  watchItems: DashboardWatchlistItem[];
  latestCloseBySymbol: Map<string, number>;
  trades: Trade[];
};

export function DashboardSecondaryIntelligence({
  diagnostics,
  topSetups,
  bestSetupsPresentation,
  watchItems,
  latestCloseBySymbol,
  trades,
}: DashboardSecondaryIntelligenceProps) {
  return (
    <section className="dash-secondary-panel dash-panel dash-surface-1" data-testid="dashboard-cockpit-zone-next-session">
      <div className="dash-secondary-panel__grid">
        <div className="card--dense">
          <MomentumWatchSection />
        </div>
        <div className="card--dense">
          <DashboardActionableBlockers diagnostics={diagnostics} compact />
        </div>
        <div className="card--table">
          <DashboardBestSetupsPanel
            topSetups={topSetups}
            presentation={bestSetupsPresentation}
          />
        </div>
        <div className="dash-secondary-panel__watch-performance card--compact">
          <DashboardWatchlistPanel
            items={watchItems}
            latestCloseBySymbol={latestCloseBySymbol}
          />
          <DashboardPerformancePanel trades={trades} />
        </div>
      </div>
    </section>
  );
}

