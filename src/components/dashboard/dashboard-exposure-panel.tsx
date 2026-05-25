import { formatVND } from "@/lib/formatters";
import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";

export type DashboardExposurePanelProps = {
  decision: DailyTradingDecision;
  currentExposure: number;
  perTradeGuidance: string;
  maxPortfolioPct: number | null;
  portfolioRiskConfigured: boolean;
};

export function DashboardExposurePanel({
  decision,
  currentExposure,
  perTradeGuidance,
  maxPortfolioPct,
  portfolioRiskConfigured,
}: DashboardExposurePanelProps) {
  const stanceLabel =
    decision.level === "NO_TRADE"
      ? "Preserve capital."
      : decision.level === "PROBE"
        ? "Small, selective probes only."
        : "Normal risk with discipline.";

  return (
    <section
      className="dash-exposure dash-surface-1"
      data-testid="dashboard-exposure-panel"
      aria-labelledby="dashboard-exposure-heading"
    >
      <h2 id="dashboard-exposure-heading" className="dash-section-title">
        {portfolioRiskConfigured ? "Exposure (guidance)" : "Exposure snapshot"}
      </h2>
      {!portfolioRiskConfigured ? (
        <p className="dash-exposure__hint">
          Risk budget not configured — values are qualitative until{" "}
          <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code> is set.
        </p>
      ) : null}
      <dl className="dash-metric-grid">
        <div className="dash-metric">
          <dt>Open notional</dt>
          <dd className="dash-metric__value tabular-nums">
            {formatVND(currentExposure, true)}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Allocation cap</dt>
          <dd className="dash-metric__value">
            {!portfolioRiskConfigured
              ? "—"
              : maxPortfolioPct == null
                ? "Parse unavailable"
                : `${decision.allocation}`}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Per-trade guide</dt>
          <dd className="dash-metric__value">{perTradeGuidance}</dd>
        </div>
        <div className="dash-metric">
          <dt>Stance</dt>
          <dd className="dash-metric__value">{stanceLabel}</dd>
        </div>
      </dl>
      <p className="dash-exposure__footnote">
        Entry price × quantity — not mark-to-market or stop-based risk.
      </p>
    </section>
  );
}
