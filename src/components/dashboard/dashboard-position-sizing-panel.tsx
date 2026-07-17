import Link from "next/link";
import { formatVND } from "@/lib/formatters";
import type { ConfidenceBand, PositionSizingPanelDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardPositionSizingPanelProps = {
  recommendedPositionSizing: PositionSizingPanelDto | null;
  portfolioRiskConfigured: boolean;
  confidenceBand: ConfidenceBand;
};

/**
 * Prominent (not a small chip/tooltip) explanation + CTA for why the
 * position-sizing recommendation is muted/unavailable when account equity
 * isn't configured. Reuses the existing `ui-state-panel status-surface--warning`
 * pattern (see `StaleDataWarning`) — a bordered, padded panel, not a hint line.
 */
function EquityNotConfiguredBanner() {
  return (
    <div
      className="ui-state-panel status-surface--warning"
      data-testid="dashboard-equity-not-configured-banner"
      role="status"
    >
      <p className="ui-state-panel__eyebrow">Position sizing</p>
      <p className="ui-state-panel__title">Unavailable — equity not configured</p>
      <p className="ui-state-panel__body">
        The recommended position size and book-risk caps below are muted because no account
        equity is configured. Without it there is nothing to size risk against, so no
        recommendation is shown (fail-closed) instead of a guessed one.
      </p>
      <p className="ui-state-panel__body">
        <Link href="/settings" className="dash-v2-link">
          Set account equity →
        </Link>{" "}
        (or set <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code> in your
        environment as a fallback default).
      </p>
    </div>
  );
}

function NoRecommendationReason({ confidenceBand }: { confidenceBand: ConfidenceBand }) {
  const message =
    confidenceBand === "low"
      ? "No recommendation today — confidence is low (stale/misaligned data or Gate 1 failing). A low-confidence day never gets a fresh position size."
      : "No recommendation right now — no eligible Tier A/B candidate is surfaced.";
  return (
    <p className="dash-exposure__hint" data-testid="dashboard-position-sizing-empty">
      {message}
    </p>
  );
}

export function DashboardPositionSizingPanel({
  recommendedPositionSizing,
  portfolioRiskConfigured,
  confidenceBand,
}: DashboardPositionSizingPanelProps) {
  return (
    <section
      className="dash-position-sizing dash-surface-1"
      data-testid="dashboard-position-sizing-panel"
      aria-labelledby="dashboard-position-sizing-heading"
    >
      <h2 id="dashboard-position-sizing-heading" className="dash-section-title">
        Recommended position size
      </h2>

      {!portfolioRiskConfigured ? <EquityNotConfiguredBanner /> : null}

      {recommendedPositionSizing == null ? (
        portfolioRiskConfigured ? <NoRecommendationReason confidenceBand={confidenceBand} /> : null
      ) : (
        <div data-testid="dashboard-position-sizing-recommendation">
          <p className="dash-exposure__stance">
            {recommendedPositionSizing.symbol} · Tier {recommendedPositionSizing.quality}
          </p>
          <dl className="dash-metric-grid">
            <div className="dash-metric">
              <dt>Shares</dt>
              <dd
                className="dash-metric__value tabular-nums"
                data-testid="dashboard-position-sizing-qty"
              >
                {recommendedPositionSizing.qtyShares.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="dash-metric">
              <dt>Notional</dt>
              <dd className="dash-metric__value tabular-nums">
                {formatVND(recommendedPositionSizing.notionalVnd, true)}
              </dd>
            </div>
            <div className="dash-metric">
              <dt>Risk at stop</dt>
              <dd className="dash-metric__value tabular-nums">
                {formatVND(recommendedPositionSizing.riskAtStopVnd, true)}
              </dd>
            </div>
            <div className="dash-metric">
              <dt>Entry / effective stop</dt>
              <dd className="dash-metric__value tabular-nums">
                {formatVND(recommendedPositionSizing.entryVndPerShare)} /{" "}
                {formatVND(recommendedPositionSizing.effectiveStopVndPerShare)}
              </dd>
            </div>
          </dl>

          <details className="dash-exposure__details text-xs">
            <summary>Sizing caveats</summary>
            <ul className="dash-exposure__caveats">
              <li>
                Stop distance is widened by a slippage/gap buffer before sizing — this is more
                conservative than the raw scanner stop.
              </li>
              <li>
                Rounded down to whole VN board lots ({recommendedPositionSizing.boardLotShares}{" "}
                shares).
              </li>
              <li>
                {recommendedPositionSizing.liquidityDataAvailable
                  ? recommendedPositionSizing.liquidityCapApplied
                    ? "Capped by a 10%-of-average-daily-volume liquidity ceiling."
                    : "Within the 10%-of-average-daily-volume liquidity ceiling — not capped."
                  : "20-day average volume unavailable for this symbol — no liquidity cap applied."}
              </li>
              {recommendedPositionSizing.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
