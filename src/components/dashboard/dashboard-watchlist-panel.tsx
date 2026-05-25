import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import { distanceToZonePct, healthLevelActionHint } from "@/lib/setup-health";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import {
  displaySetupHealthLevel,
  displaySetupLifecycleStatus,
} from "@/lib/trading-display-labels";

export type DashboardWatchlistItem = {
  id: string;
  symbolId: string;
  lifecycleStatus: SetupLifecycleStatus;
  healthLevel: SetupHealthLevelValue | null;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  symbol: { symbol: string };
};

export type DashboardWatchlistPanelProps = {
  items: DashboardWatchlistItem[];
  latestCloseBySymbol: Map<string, number>;
};

function watchActionHint(
  lifecycle: SetupLifecycleStatus,
  healthLevel: SetupHealthLevelValue | null
): string {
  if (healthLevel) {
    const hint = healthLevelActionHint(healthLevel);
    if (hint) return hint;
  }
  switch (lifecycle) {
    case "READY":
      return "Eligible for execution workflow.";
    case "WATCHING":
      return "Wait for pullback into entry zone.";
    case "NEW":
      return "Monitor for first valid retest.";
    default:
      return "Review setup state before action.";
  }
}

export function DashboardWatchlistPanel({
  items,
  latestCloseBySymbol,
}: DashboardWatchlistPanelProps) {
  return (
    <section className="dash-panel dash-surface-1" data-testid="dashboard-watchlist-panel">
      <header className="dash-panel__header">
        <h2 className="dash-section-title">Watchlist</h2>
        <p className="dash-panel__subtitle">NEW · WATCHING · READY lifecycle</p>
      </header>

      {items.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="Watchlist is empty"
            reason="Items appear when surfaced setups enter NEW, WATCHING, or READY. Zero candidates today still allows manual watch entries from future scans."
            data-testid="dashboard-watchlist-empty"
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Status</th>
                <th>Health</th>
                <th className="table-num">Dist. to zone</th>
                <th>Hint</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const close = latestCloseBySymbol.get(w.symbolId) ?? null;
                const dist =
                  close == null
                    ? null
                    : distanceToZonePct(close, w.pullbackZoneLow, w.pullbackZoneHigh);
                return (
                  <tr key={w.id}>
                    <td className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {w.symbol.symbol}
                    </td>
                    <td>{displaySetupLifecycleStatus(w.lifecycleStatus)}</td>
                    <td>
                      {w.healthLevel ? displaySetupHealthLevel(w.healthLevel) : "—"}
                    </td>
                    <td className="table-num">
                      {dist == null ? "N/A" : `${(dist * 100).toFixed(1)}%`}
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {watchActionHint(w.lifecycleStatus, w.healthLevel)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
