import "server-only";

import { SetupsClosestSymbolsSection } from "@/components/setups-closest-symbols";
import { SetupsRsWatchlistV3 } from "@/components/setups/setups-rs-watchlist-v3";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { compareClosestRowsExecutionOrder } from "@/lib/scanner/closest-execution-metrics";
import { displayTradabilityBreakdownKey } from "@/lib/trading-display-labels";
import {
  loadRsDiagnosticsForSetupsCached,
  loadRsNearMissWatchlistForSetupsCached,
  loadSetupsBaseData,
} from "./setups-cached-data";

export async function SetupsTailAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const closestRows = [...(base.notes?.closestToValidSymbols ?? [])].sort((a, b) =>
    compareClosestRowsExecutionOrder(
      {
        rankScore: a.rankScore,
        close: a.close,
        pullbackZoneLow: a.pullbackZoneLow,
        pullbackZoneHigh: a.pullbackZoneHigh,
        symbol: a.symbol,
        partialPipelineScore: a.partialPipelineScore,
        stageRank: a.stageRank,
        reasonLineCount: a.reasonLineCount,
      },
      {
        rankScore: b.rankScore,
        close: b.close,
        pullbackZoneLow: b.pullbackZoneLow,
        pullbackZoneHigh: b.pullbackZoneHigh,
        symbol: b.symbol,
        partialPipelineScore: b.partialPipelineScore,
        stageRank: b.stageRank,
        reasonLineCount: b.reasonLineCount,
      }
    )
  );

  const breakdown = base.latest.tradabilityBreakdown;

  const nearMissSymbols = closestRows.map((r) => r.symbol);
  const [rsMap, rsWatchlistRes] = await Promise.all([
    loadRsDiagnosticsForSetupsCached(nearMissSymbols),
    loadRsNearMissWatchlistForSetupsCached(),
  ]);

  const hasTail =
    closestRows.length > 0 ||
    rsWatchlistRes.panel.rows.length > 0 ||
    (breakdown && typeof breakdown === "object" && breakdown !== null);

  if (!hasTail) return null;

  return (
    <div className="tosv3-setups-tail" data-testid="setups-tail-section">
      {closestRows.length > 0 ? (
        <details className="tosv3-setups-tail__panel tosv3-glass-panel">
          <summary className="tosv3-setups-tail__summary">
            Near-miss pipeline
            <span className="tosv3-setups-tail__count tabular-nums">{closestRows.length}</span>
          </summary>
          <div className="tosv3-setups-tail__body" data-testid="setups-near-miss-panel">
            <SetupsClosestSymbolsSection rows={closestRows} rsBySymbol={rsMap} compact />
          </div>
        </details>
      ) : (
        <details className="tosv3-setups-tail__panel tosv3-glass-panel" data-testid="setups-near-miss-panel">
          <summary className="tosv3-setups-tail__summary">Near-miss pipeline</summary>
          <div className="tosv3-setups-tail__body">
            <EmptyStateWithReason
              title="No near-miss symbols saved"
              reason="This scan did not persist closest-to-valid rows in notes, or none qualified."
              data-testid="setups-near-miss-empty"
            />
          </div>
        </details>
      )}

      {rsWatchlistRes.panel.rows.length > 0 ? (
        <details className="tosv3-setups-tail__panel tosv3-glass-panel" open>
          <summary className="tosv3-setups-tail__summary">
            Relative strength watchlist
            <span className="tosv3-setups-tail__count tabular-nums">
              {rsWatchlistRes.panel.rows.length}
            </span>
          </summary>
          <div className="tosv3-setups-tail__body">
            <SetupsRsWatchlistV3 panel={rsWatchlistRes.panel} />
          </div>
        </details>
      ) : null}

      {rsWatchlistRes.error ? (
        <p className="tosv3-setups-tail__error" role="status">
          {rsWatchlistRes.error}
        </p>
      ) : null}

      {breakdown && typeof breakdown === "object" && breakdown !== null ? (
        <details className="tosv3-setups-tail__panel tosv3-glass-panel">
          <summary className="tosv3-setups-tail__summary">Liquidity &amp; session filters</summary>
          <div className="tosv3-setups-tail__body">
            <ul className="tosv3-setups-tail__breakdown">
              {Object.entries(breakdown as Record<string, number>).map(([reason, count]) => (
                <li key={reason}>
                  <span className="tabular-nums">{count}×</span>{" "}
                  {displayTradabilityBreakdownKey(reason)}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
