import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type {
  ActionableDiagnosticsDto,
  DecisionCockpitDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { RsNearMissWatchlistPanel } from "@/components/rs-near-miss-watchlist-panel";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  watchItems: DashboardWatchlistItem[];
  /** True when the watchlist query hit its row cap and more items exist beyond what's shown. */
  watchItemsTruncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
  rsNearMissWatchlist?: DecisionCockpitDto["rsNearMissWatchlist"];
  /** Inside command-deck collapsible — omit duplicate zone chrome. */
  embedded?: boolean;
};

export function DashboardSecondaryIntelligence({
  diagnostics,
  watchItems,
  watchItemsTruncated = false,
  latestCloseBySymbol,
  rsNearMissWatchlist,
  embedded = false,
}: DashboardSecondaryIntelligenceProps) {
  return (
    <section
      className={`command-deck-secondary dash-v2-zone dash-v2-zone--quiet${embedded ? " command-deck-secondary--embedded" : ""}`}
      data-testid="dashboard-cockpit-zone-next-session"
      aria-labelledby="dashboard-watch-zone-heading"
    >
      {!embedded ? (
        <header className="dash-v2-zone-header">
          <p className="dash-v2-eyebrow">Watch</p>
          <h2 id="dashboard-watch-zone-heading" className="dash-v2-zone-title">
            Watchlist
          </h2>
          <p className="dash-v2-zone-lead">
            Symbols you track. Gate diagnostics stay collapsed unless you need detail.
          </p>
        </header>
      ) : (
        <h2 id="dashboard-watch-zone-heading" className="dash-sr-only">
          Watchlist and blockers
        </h2>
      )}

      <div className="dash-v2-zone__body">
        <div className="dash-v2-card dash-v2-card--inset">
          <DashboardWatchlistPanel
            items={watchItems}
            truncated={watchItemsTruncated}
            latestCloseBySymbol={latestCloseBySymbol}
          />
        </div>
      </div>

      {rsNearMissWatchlist ? (
        <div className="dash-v2-zone__body mt-4">
          <RsNearMissWatchlistPanel
            panel={rsNearMissWatchlist}
            testId="dashboard-secondary-rs-watchlist"
          />
        </div>
      ) : null}

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
