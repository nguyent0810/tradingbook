import { formatVND } from "@/lib/formatters";
import type { RiskGuardrailDto, VerdictDto } from "@/lib/dashboard/decision-cockpit-dto";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardExposurePanelProps = {
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  /** Parsed upper bound of max book % when equity configured; null = qualitative only. */
  maxPortfolioPct: number | null;
  portfolioRiskConfigured: boolean;
};

export function DashboardExposurePanel({
  risk,
  verdict,
  maxPortfolioPct,
  portfolioRiskConfigured,
}: DashboardExposurePanelProps) {
  const { gate1Resolution } = verdict;
  const ux = verdict.uxLevel.value;
  const perTrade = risk.perTradeGuidance.value;
  const showPerTrade = perTrade.toLowerCase() !== "none";

  return (
    <section
      className="dash-exposure dash-surface-1"
      data-testid="dashboard-exposure-panel"
      aria-labelledby="dashboard-exposure-heading"
    >
      <h2 id="dashboard-exposure-heading" className="dash-section-title">
        {portfolioRiskConfigured ? "Risk guardrail" : "Risk guardrail (qualitative)"}
      </h2>
      {!portfolioRiskConfigured ? (
        <p className="dash-exposure__hint" data-testid="dashboard-exposure-qualitative-hint">
          Book caps are guidance only until{" "}
          <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code> is set — not compared to
          equity here.
        </p>
      ) : null}
      <p className="dash-exposure__stance" data-testid="dashboard-exposure-stance">
        {risk.stanceCopy.value}
      </p>
      <dl className="dash-metric-grid">
        <div className="dash-metric">
          <dt>Open notional</dt>
          <dd className="dash-metric__value tabular-nums">
            {formatVND(risk.openExposureVnd.value, true)}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Max book (verdict)</dt>
          <dd className="dash-metric__value tabular-nums" data-testid="dashboard-exposure-max-book">
            {risk.maxBookAllocation.value}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Per-trade guide</dt>
          <dd className="dash-metric__value" data-testid="dashboard-exposure-per-trade">
            {showPerTrade ? perTrade : "None"}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Gate 1 (verdict)</dt>
          <dd className="dash-metric__value" data-testid="dashboard-exposure-gate1">
            {displayGate1ScanLevel(gate1Resolution.canonical)}
            {gate1Resolution.mismatch ? (
              <span
                className="dash-exposure__gate1-live"
                title={gate1Resolution.note}
              >
                {" "}
                · live {displayGate1ScanLevel(gate1Resolution.liveRegimeGate1)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      {portfolioRiskConfigured && maxPortfolioPct != null && ux !== "NO_TRADE" ? (
        <p className="dash-exposure__caption text-xs" style={{ color: "var(--text-tertiary)" }}>
          Parsed cap upper bound ~{(maxPortfolioPct * 100).toFixed(0)}% of configured equity —
          qualitative until risk budget API (DC-5).
        </p>
      ) : null}
      <ul className="dash-exposure__rules">
        {risk.rules.slice(0, 2).map((rule) => (
          <li key={rule.text}>{rule.text}</li>
        ))}
      </ul>
      <p className="dash-exposure__footnote">
        Open notional = entry × quantity — not mark-to-market or stop-based risk.
      </p>
    </section>
  );
}
