import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type { ActionableDiagnosticsDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  watchItems: DashboardWatchlistItem[];
  latestCloseBySymbol: Map<string, number>;
};

/**
 * Command Center v1.1 — Row D: watchlist + collapsible gate diagnostics.
 * Best setups, momentum, and performance live in dedicated zones above.
 */
export function DashboardSecondaryIntelligence({
  diagnostics,
  watchItems,
  latestCloseBySymbol,
}: DashboardSecondaryIntelligenceProps) {
  return (
    <section
      className="dash-secondary-panel dash-panel dash-surface-1 dash-cockpit-v11__watch-zone"
      data-testid="dashboard-cockpit-zone-next-session"
      aria-labelledby="dashboard-watch-zone-heading"
    >
      <header className="dash-panel__header dash-cockpit-v11__zone-header">
        <div>
          <p className="dash-eyebrow">Watch &amp; diagnostics</p>
          <h2 id="dashboard-watch-zone-heading" className="dash-section-title">
            Watchlist &amp; gate diagnostics
          </h2>
          <p className="dash-panel__subtitle">
            Symbols you are tracking — expand diagnostics when you need Gate2 detail.
          </p>
        </div>
      </header>

      <div className="dash-secondary-panel__grid dash-secondary-panel__grid--v11">
        <div className="card--table">
          <DashboardWatchlistPanel
            items={watchItems}
            latestCloseBySymbol={latestCloseBySymbol}
          />
        </div>
        <details className="dash-cockpit-v11__details card--dense">
          <summary className="dash-cockpit-v11__details-summary">
            Gate diagnostics &amp; blockers
          </summary>
          <div className="dash-cockpit-v11__details-body">
            <DashboardActionableBlockers diagnostics={diagnostics} compact />
          </div>
        </details>
      </div>
    </section>
  );
}
