import { formatVND } from "@/lib/formatters";
import type {
  MarkToMarketExposureDto,
  RiskBudgetHeadroomDto,
  RiskGuardrailDto,
  RiskToStopBreakdownDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardExposurePanelProps = {
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  portfolioRiskConfigured: boolean;
  riskToStop: RiskToStopBreakdownDto;
  markToMarketExposure: MarkToMarketExposureDto;
};

export function DashboardExposurePanel({
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
  riskToStop,
  markToMarketExposure,
}: DashboardExposurePanelProps) {
  const { gate1Resolution } = verdict;
  const perTrade = risk.perTradeGuidance.value;
  const showPerTrade = perTrade.toLowerCase() !== "none";
  const headroom = riskBudgetHeadroom;

  return (
    <section
      className="dash-exposure dash-surface-1"
      data-testid="dashboard-exposure-panel"
      aria-labelledby="dashboard-exposure-heading"
    >
      <h2 id="dashboard-exposure-heading" className="dash-section-title">
        {headroom.status === "configured" ? "Risk guardrail" : "Risk guardrail (qualitative)"}
      </h2>

      {headroom.status === "unavailable" ? (
        <p className="dash-exposure__hint" data-testid="dashboard-exposure-headroom-unavailable">
          {headroom.statusCopy}
        </p>
      ) : null}

      {headroom.status === "partial" ? (
        <p className="dash-exposure__hint" data-testid="dashboard-exposure-headroom-partial">
          {headroom.statusCopy}
        </p>
      ) : null}

      <p className="dash-exposure__stance" data-testid="dashboard-exposure-stance">
        {risk.stanceCopy.value}
      </p>

      {headroom.status === "configured" ? (
        <dl className="dash-metric-grid dash-exposure__headroom" data-testid="dashboard-exposure-headroom">
          <div className="dash-metric">
            <dt>Configured equity</dt>
            <dd className="dash-metric__value tabular-nums">
              {formatVND(headroom.equityVnd.value!, true)}
            </dd>
          </div>
          <div className="dash-metric">
            <dt>Max book budget</dt>
            <dd className="dash-metric__value tabular-nums" data-testid="dashboard-exposure-max-book-budget">
              {formatVND(headroom.maxBookVnd.value!, true)}
              <span className="dash-exposure__pct">
                {" "}
                (~{(headroom.maxBookPercent.value! * 100).toFixed(0)}% of equity)
              </span>
            </dd>
          </div>
          <div className="dash-metric">
            <dt>Open notional</dt>
            <dd className="dash-metric__value tabular-nums">
              {formatVND(headroom.openExposureVnd.value, true)}
            </dd>
          </div>
          <div className="dash-metric">
            <dt>Remaining book headroom</dt>
            <dd
              className={`dash-metric__value tabular-nums${headroom.isOverMaxBook ? " dash-exposure__value--over" : ""}`}
              data-testid="dashboard-exposure-remaining-headroom"
            >
              {formatVND(headroom.remainingBookVnd.value!, true)}
            </dd>
          </div>
        </dl>
      ) : (
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
                <span className="dash-exposure__gate1-live" title={gate1Resolution.note}>
                  {" "}
                  · live {displayGate1ScanLevel(gate1Resolution.liveRegimeGate1)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      )}

      {headroom.status === "configured" ? (
        <p className="dash-exposure__caption text-xs" style={{ color: "var(--text-tertiary)" }}>
          {headroom.statusCopy}
        </p>
      ) : !portfolioRiskConfigured ? (
        <p className="dash-exposure__hint" data-testid="dashboard-exposure-qualitative-hint">
          Book caps are guidance only until{" "}
          <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code> is set — not compared to
          equity here.
        </p>
      ) : null}

      {headroom.status === "configured" ? (
        <dl className="dash-metric-grid dash-metric-grid--compact">
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
                <span className="dash-exposure__gate1-live" title={gate1Resolution.note}>
                  {" "}
                  · live {displayGate1ScanLevel(gate1Resolution.liveRegimeGate1)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}

      <dl
        className="dash-metric-grid dash-metric-grid--compact"
        data-testid="dashboard-exposure-breakdown"
      >
        <div className="dash-metric">
          <dt>Risk to stop (known)</dt>
          <dd className="dash-metric__value tabular-nums" data-testid="dashboard-exposure-risk-to-stop">
            {formatVND(riskToStop.knownRiskVnd, true)}
            {riskToStop.unknownStopCount > 0 ? (
              <span
                className="dash-exposure__pct"
                data-testid="dashboard-exposure-risk-to-stop-unknown"
                title="OPEN trades with no stop set — excluded from the sum above, not treated as zero risk."
              >
                {" "}
                (+{riskToStop.unknownStopCount} unknown)
              </span>
            ) : null}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Mark-to-market exposure</dt>
          <dd
            className="dash-metric__value tabular-nums"
            data-testid="dashboard-exposure-mark-to-market"
          >
            {markToMarketExposure.available && markToMarketExposure.exposureVnd != null
              ? formatVND(markToMarketExposure.exposureVnd, true)
              : "Unavailable"}
          </dd>
        </div>
      </dl>
      {markToMarketExposure.unavailableReason ? (
        <p className="dash-exposure__hint" data-testid="dashboard-exposure-mark-to-market-hint">
          {markToMarketExposure.unavailableReason}
        </p>
      ) : null}

      <details className="dash-exposure__details text-xs">
        <summary>Risk caveats</summary>
        <ul className="dash-exposure__rules">
          {risk.rules.slice(0, 2).map((rule) => (
            <li key={rule.text}>{rule.text}</li>
          ))}
        </ul>
        <ul className="dash-exposure__caveats">
          {headroom.caveats.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="dash-exposure__footnote">
          Open notional = entry × quantity on OPEN trades — not mark-to-market.
        </p>
      </details>
    </section>
  );
}
