import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { VerdictDto } from "@/lib/dashboard/decision-cockpit-dto";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardTradingDecisionSummaryProps = {
  latestScan: LatestScanWithCandidates | null;
  verdict: VerdictDto;
};

function formatUxVerdictTitle(level: string): string {
  return level.replace(/_/g, " ");
}

export function DashboardTradingDecisionSummary({
  latestScan,
  verdict,
}: DashboardTradingDecisionSummaryProps) {
  const ux = verdict.uxLevel.value;

  return (
    <section
      className="dash-v2-proof-strip"
      data-testid="dashboard-trading-decision-summary"
      aria-labelledby="dashboard-trading-summary-heading"
    >
      <header className="dash-v2-zone-header dash-v2-zone-header--compact">
        <p className="dash-v2-eyebrow">Why this stance</p>
        <h2 id="dashboard-trading-summary-heading" className="dash-v2-zone-title">
          Decision context
        </h2>
      </header>
      <div className="dash-v2-proof-strip__metrics">
        <div className="dash-v2-metric">
          <span className="dash-v2-metric__label">Gate 1</span>
          <span className="dash-v2-metric__value" data-testid="dashboard-summary-gate1">
            {latestScan ? displayGate1ScanLevel(latestScan.gate1Level) : "—"}
          </span>
        </div>
        <div className="dash-v2-metric">
          <span className="dash-v2-metric__label">Stance</span>
          <span className="dash-v2-metric__value" data-testid="dashboard-summary-verdict">
            {formatUxVerdictTitle(ux)}
          </span>
        </div>
        <div className="dash-v2-metric">
          <span className="dash-v2-metric__label">Tier A / B</span>
          <span className="dash-v2-metric__value tabular-nums" data-testid="dashboard-summary-tier-counts">
            {latestScan
              ? `${latestScan.candidateCountA} / ${latestScan.candidateCountB}`
              : "—"}
          </span>
        </div>
        <div className="dash-v2-metric">
          <span className="dash-v2-metric__label">Tradable</span>
          <span className="dash-v2-metric__value tabular-nums">
            {latestScan?.symbolCountAfterTradability ?? "—"}
          </span>
        </div>
      </div>
      <p className="dash-v2-proof-strip__narrative" data-testid="dashboard-summary-why-empty">
        {latestScan && latestScan.candidateCountSurfaced === 0 ? (
          <>
            <strong>Why no Best Setups:</strong> {verdict.explanation.value} Data is current;
            empty results reflect Gate2 rules—not missing coverage.
          </>
        ) : latestScan ? (
          verdict.explanation.value
        ) : (
          "Run a daily scan to populate decision surfaces."
        )}
      </p>
    </section>
  );
}
