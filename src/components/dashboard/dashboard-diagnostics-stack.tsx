import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import {
  rejectionBucketLabel,
  rejectionBucketTraderGuide,
} from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type DashboardDiagnosticsStackProps = {
  rejectionBuckets: Array<[string, number]>;
  scanNotes: DailyScanGate2Notes | null;
  latestScan: LatestScanWithCandidates | null;
};

export function DashboardDiagnosticsStack({
  rejectionBuckets,
  scanNotes,
  latestScan,
}: DashboardDiagnosticsStackProps) {
  return (
    <section className="dash-panel dash-surface-1" data-testid="dashboard-diagnostics-panel">
      <header className="dash-panel__header">
        <h2 className="dash-section-title">Diagnostics</h2>
        <p className="dash-panel__subtitle">Gate 2 rejection reasons — why setups fell short</p>
      </header>

      {rejectionBuckets.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="No rejection diagnostics"
            reason={
              latestScan
                ? "Latest scan notes have no rejection buckets to summarize, or tradability passed without Gate 2 failures."
                : "Run a daily scan to populate rejection diagnostics."
            }
            data-testid="dashboard-diagnostics-empty"
          />
        </div>
      ) : (
        <ul className="dash-diagnostics-stack" data-testid="dashboard-diagnostics-stack">
          {rejectionBuckets.map(([category, count]) => {
            const guide = rejectionBucketTraderGuide(category);
            const symbols = scanNotes?.rejectionSymbolsByCategory?.[category] ?? [];
            return (
              <li key={category} className="dash-diagnostics-stack__item">
                <div className="dash-diagnostics-stack__head">
                  <span className="dash-diagnostics-stack__title">
                    {rejectionBucketLabel(category)}
                  </span>
                  <span className="dash-diagnostics-stack__count tabular-nums">{count}</span>
                </div>
                <p className="dash-diagnostics-stack__meaning">{guide.meaning}</p>
                <p className="dash-diagnostics-stack__wait">Wait for: {guide.waitFor}</p>
                {symbols.length > 0 ? (
                  <p className="dash-diagnostics-stack__symbols">
                    Sample: {symbols.slice(0, 8).join(", ")}
                    {symbols.length > 8 ? ` +${symbols.length - 8} more` : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
