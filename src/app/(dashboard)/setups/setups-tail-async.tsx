import "server-only";

import { SetupsClosestSymbolsSection } from "@/components/setups-closest-symbols";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { compareClosestRowsExecutionOrder } from "@/lib/scanner/closest-execution-metrics";
import { displayTradabilityBreakdownKey } from "@/lib/trading-display-labels";
import { loadSetupsBaseData } from "./setups-cached-data";

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

  return (
    <div className="pipeline-deck__tail space-y-4">
      <section className="pipeline-deck-panel dash-panel dash-surface-1" data-testid="setups-near-miss-panel">
        <header className="dash-panel__header">
          <h2 className="dash-section-title">
            Near-miss pipeline{closestRows.length > 0 ? ` (${closestRows.length})` : ""}
          </h2>
          <p className="dash-panel__subtitle">
            Closest-to-valid symbols — not Tier A/B surfaced
          </p>
        </header>
        {closestRows.length > 0 ? (
          <SetupsClosestSymbolsSection rows={closestRows} />
        ) : (
          <div className="dash-empty-compact">
            <EmptyStateWithReason
              title="No near-miss symbols saved"
              reason="This scan did not persist closest-to-valid rows in notes, or none qualified. When present, symbols appear here with distance-to-zone context."
              data-testid="setups-near-miss-empty"
            />
          </div>
        )}
      </section>

      {breakdown && typeof breakdown === "object" && breakdown !== null ? (
        <details className="tos-details-disclosure dash-surface-1 text-sm">
          <summary className="tos-details-disclosure__summary">
            Liquidity &amp; session filter (technical detail)
          </summary>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Why symbols were excluded before setup scoring (scanner diagnostic keys shown as readable
            labels).
          </p>
          <ul className="mt-3 space-y-1.5">
            {Object.entries(breakdown as Record<string, number>).map(([reason, count]) => (
              <li key={reason}>
                <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {count}×
                </span>{" "}
                {displayTradabilityBreakdownKey(reason)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
