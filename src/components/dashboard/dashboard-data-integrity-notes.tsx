import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";

export type DashboardDataIntegrityNotesProps = {
  freshness: MarketFreshnessDto;
  scanRunId: string | null;
};

/** Recovery / integrity context — no fake data claims (Command Center v1). */
export function DashboardDataIntegrityNotes({
  freshness,
  scanRunId,
}: DashboardDataIntegrityNotesProps) {
  const aligned = !freshness.delayedBackdrop && freshness.staleFlags.length === 0;
  const coverage = freshness.scanSessionCoverage;

  return (
    <aside
      className="dash-integrity-notes dash-surface-1"
      data-testid="dashboard-data-integrity-notes"
      aria-label="Data integrity notes"
    >
      <h2 className="dash-section-title text-sm">Data integrity</h2>
      <ul className="dash-integrity-notes__list text-sm leading-relaxed">
        <li>
          <strong>Smoke symbols</strong> (P0DEXIT, etc.) are excluded from production import
          export—not shown as real setups.
        </li>
        <li>
          <strong>Universe coverage</strong> was expanded in the May 2026 recovery slice; major
          names like VND/PDR are active and receiving bars again.
        </li>
        <li>
          <strong>Session alignment:</strong>{" "}
          {aligned ? (
            <span data-testid="dashboard-integrity-aligned">
              OK — VNINDEX {freshness.benchmarkDate ?? "—"}, equity max{" "}
              {freshness.equityMaxDate ?? "—"}.
            </span>
          ) : (
            <span data-testid="dashboard-integrity-stale-warning">
              Review alignment — stale flags or delayed backdrop detected.
            </span>
          )}
        </li>
        {coverage ? (
          <li data-testid="dashboard-integrity-session-coverage">
            <strong>Expected session coverage:</strong>{" "}
            {coverage.weakCoverage ? (
              <span data-testid="dashboard-integrity-weak-coverage">
                {coverage.operatorWarning ?? coverage.headline} (
                {coverage.staleSessionCount}/{coverage.tradabilityEvaluated} symbols
                stale vs {coverage.expectedSessionDate}; {coverage.tradabilityPassed}{" "}
                passed tradability.)
              </span>
            ) : (
              <span>
                {coverage.headline} — {coverage.tradabilityPassed}/
                {coverage.tradabilityEvaluated} passed tradability.
              </span>
            )}
          </li>
        ) : null}
        {scanRunId ? (
          <li className="mono text-xs" style={{ color: "var(--text-tertiary)" }}>
            Latest scan id: {scanRunId}
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
