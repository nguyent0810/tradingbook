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

/** Gate1 + scan counts + why Best Setups may be empty (Command Center v1). */
export function DashboardTradingDecisionSummary({
  latestScan,
  verdict,
}: DashboardTradingDecisionSummaryProps) {
  const ux = verdict.uxLevel.value;

  return (
    <section
      className="dash-trading-summary dash-surface-1"
      data-testid="dashboard-trading-decision-summary"
      aria-labelledby="dashboard-trading-summary-heading"
    >
      <h2 id="dashboard-trading-summary-heading" className="dash-section-title">
        Trading decision summary
      </h2>
      <div className="dash-trading-summary__grid">
        <div className="dash-trading-summary__item">
          <span className="dash-trading-summary__label">Gate 1</span>
          <span className="dash-trading-summary__value" data-testid="dashboard-summary-gate1">
            {latestScan
              ? displayGate1ScanLevel(latestScan.gate1Level)
              : "—"}
          </span>
        </div>
        <div className="dash-trading-summary__item">
          <span className="dash-trading-summary__label">Today&apos;s stance</span>
          <span className="dash-trading-summary__value" data-testid="dashboard-summary-verdict">
            {formatUxVerdictTitle(ux)}
          </span>
        </div>
        <div className="dash-trading-summary__item">
          <span className="dash-trading-summary__label">Tier A / B surfaced</span>
          <span className="dash-trading-summary__value tabular-nums" data-testid="dashboard-summary-tier-counts">
            {latestScan
              ? `${latestScan.candidateCountA} / ${latestScan.candidateCountB}`
              : "—"}
          </span>
        </div>
        <div className="dash-trading-summary__item">
          <span className="dash-trading-summary__label">Tradable in scan</span>
          <span className="dash-trading-summary__value tabular-nums">
            {latestScan?.symbolCountAfterTradability ?? "—"}
          </span>
        </div>
      </div>
      <p className="dash-trading-summary__why text-sm leading-relaxed" data-testid="dashboard-summary-why-empty">
        {latestScan && latestScan.candidateCountSurfaced === 0 ? (
          <>
            <strong>Why no Best Setups:</strong> {verdict.explanation.value} Market data is
            current; empty results reflect Gate2 breakout-pullback rules and regime filters—not
            stale coverage.
          </>
        ) : latestScan ? (
          verdict.explanation.value
        ) : (
          "Run a daily scan to populate trading decision and setup surfaces."
        )}
      </p>
    </section>
  );
}
