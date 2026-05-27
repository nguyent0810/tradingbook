import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type { ActionableDiagnosticsDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  watchItems: DashboardWatchlistItem[];
  latestCloseBySymbol: Map<string, number>;
};

export function DashboardSecondaryIntelligence({
  diagnostics,
  watchItems,
  latestCloseBySymbol,
}: DashboardSecondaryIntelligenceProps) {
  return (
    <section
      className="dash-v2-zone dash-v2-zone--quiet"
      data-testid="dashboard-cockpit-zone-next-session"
      aria-labelledby="dashboard-watch-zone-heading"
    >
      <header className="dash-v2-zone-header">
        <p className="dash-v2-eyebrow">Watch</p>
        <h2 id="dashboard-watch-zone-heading" className="dash-v2-zone-title">
          Watchlist
        </h2>
        <p className="dash-v2-zone-lead">
          Symbols you track. Gate diagnostics stay collapsed unless you need detail.
        </p>
      </header>

      <div className="dash-v2-zone__body">
        <div className="dash-v2-card dash-v2-card--inset">
          <DashboardWatchlistPanel
            items={watchItems}
            latestCloseBySymbol={latestCloseBySymbol}
          />
        </div>
      </div>

      <details className="dash-v2-details dash-v2-details--diagnostics">
        <summary className="dash-v2-details__summary">
          Gate diagnostics &amp; blockers
        </summary>
        <div className="dash-v2-details__body">
          <DashboardActionableBlockers diagnostics={diagnostics} compact />
        </div>
      </details>
    </section>
  );
}
