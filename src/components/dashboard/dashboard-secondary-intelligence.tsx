import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type {
  ActionableDiagnosticsDto,
  DecisionCockpitDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { formatBlockerSeverity } from "@/lib/dashboard/decision-cockpit-dto";
import { RsNearMissWatchlistPanel } from "@/components/rs-near-miss-watchlist-panel";
import { distanceToZonePct } from "@/lib/setup-health";
import { displaySetupLifecycleStatus } from "@/lib/trading-display-labels";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  watchItems: DashboardWatchlistItem[];
  /** True when the watchlist query hit its row cap and more items exist beyond what's shown. */
  watchItemsTruncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
  rsNearMissWatchlist?: DecisionCockpitDto["rsNearMissWatchlist"];
};

const PREVIEW_ROWS = 3;

export function DashboardSecondaryIntelligence({
  diagnostics,
  watchItems,
  watchItemsTruncated = false,
  latestCloseBySymbol,
  rsNearMissWatchlist,
}: DashboardSecondaryIntelligenceProps) {
  const previewWatch = watchItems.slice(0, PREVIEW_ROWS);
  const previewBlockers = diagnostics.blockers.slice(0, PREVIEW_ROWS - 1);

  return (
    <section
      className="command-deck-secondary dash-v2-zone dash-v2-zone--context"
      data-testid="dashboard-cockpit-zone-next-session"
      aria-labelledby="dashboard-watch-zone-heading"
    >
      <header className="dash-v2-zone-header dash-header--numbered">
        <span className="dash-header-num" aria-hidden="true">
          03
        </span>
        <div>
          <p className="dash-v2-eyebrow">Secondary intelligence</p>
          <h2 id="dashboard-watch-zone-heading" className="dash-v2-zone-title">
            Watchlist &amp; gate blockers
          </h2>
          <p className="dash-v2-zone-lead">
            Background context — check when you want more than the verdict.
          </p>
        </div>
      </header>

      <div className="dash-si-grid dash-v2-zone__body">
        <details className="dash-si-widget dash-card dash-si-widget--watch" data-testid="dashboard-secondary-watchlist-widget">
          <summary className="dash-si-widget__summary">
            <span className="dash-si-widget__top">
              <span className="dash-si-widget__title">Watchlist</span>
              <span className="dash-si-widget__count tabular-nums">{watchItems.length}</span>
            </span>
            {previewWatch.length === 0 ? (
              <p className="dash-si-widget__empty">No active watch items.</p>
            ) : (
              <ul className="dash-si-mini-rows">
                {previewWatch.map((w) => {
                  const close = latestCloseBySymbol.get(w.symbolId) ?? null;
                  const dist =
                    close == null
                      ? null
                      : distanceToZonePct(close, w.pullbackZoneLow, w.pullbackZoneHigh);
                  return (
                    <li key={w.id} className="dash-si-mini-row">
                      <span className="dash-si-mini-row__sym font-mono">{w.symbol.symbol}</span>
                      <span>
                        {displaySetupLifecycleStatus(w.lifecycleStatus)}
                        {dist != null ? ` · ${(dist * 100).toFixed(1)}%` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <span className="dash-si-widget__toggle">
              {watchItems.length > previewWatch.length
                ? `+${watchItems.length - previewWatch.length} more — view all`
                : "View details"}
            </span>
          </summary>
          <div className="dash-si-widget__full">
            <DashboardWatchlistPanel
              items={watchItems}
              truncated={watchItemsTruncated}
              latestCloseBySymbol={latestCloseBySymbol}
            />
          </div>
        </details>

        <details className="dash-si-widget dash-card dash-si-widget--blockers" data-testid="dashboard-secondary-blockers-widget">
          <summary className="dash-si-widget__summary">
            <span className="dash-si-widget__top">
              <span className="dash-si-widget__title">Gate blockers</span>
              <span className="dash-si-widget__count tabular-nums">{diagnostics.blockers.length}</span>
            </span>
            {previewBlockers.length === 0 ? (
              <p className="dash-si-widget__empty">
                {diagnostics.emptyReason ?? "No actionable blockers."}
              </p>
            ) : (
              <ul className="dash-si-mini-rows">
                {previewBlockers.map((b) => (
                  <li key={`${b.severity}-${b.title}`} className="dash-si-mini-row">
                    <span className={`dash-si-sev-strip dash-si-sev-strip--${b.severity}`} aria-hidden="true" />
                    <span>
                      {formatBlockerSeverity(b.severity)} · {b.title}
                      {b.count > 0 ? ` — ${b.count}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <span className="dash-si-widget__toggle">
              {diagnostics.blockers.length > previewBlockers.length
                ? `+${diagnostics.blockers.length - previewBlockers.length} more — view all`
                : "View details"}
            </span>
          </summary>
          <div className="dash-si-widget__full">
            <DashboardActionableBlockers diagnostics={diagnostics} compact />
          </div>
        </details>
      </div>

      {rsNearMissWatchlist ? (
        <div className="dash-v2-zone__body mt-4">
          <RsNearMissWatchlistPanel
            panel={rsNearMissWatchlist}
            testId="dashboard-secondary-rs-watchlist"
          />
        </div>
      ) : null}
    </section>
  );
}
