import { formatVND } from "@/lib/formatters";
import type { PortfolioGuardrailsDto } from "@/lib/dashboard/portfolio-guardrails";
import { Badge } from "@/components/ui/badge";

export type DashboardPortfolioGuardrailsPanelProps = {
  guardrails: PortfolioGuardrailsDto;
};

/**
 * Portfolio-level guardrails — max concurrent positions, aggregate risk-to-stop
 * ("portfolio heat"), and duplicate-symbol exposure across PLANNED+OPEN trades.
 * Sector concentration / correlation are deliberately not shown here — see
 * `src/lib/dashboard/portfolio-guardrails.ts` header comment for why.
 */
export function DashboardPortfolioGuardrailsPanel({
  guardrails,
}: DashboardPortfolioGuardrailsPanelProps) {
  const { maxConcurrentPositions, portfolioHeat, duplicateSymbolExposure } = guardrails;

  return (
    <section
      className="dash-v2-card dash-v2-card--inset dash-portfolio-guardrails"
      data-testid="dashboard-portfolio-guardrails-panel"
      aria-labelledby="dashboard-portfolio-guardrails-heading"
    >
      <h2 id="dashboard-portfolio-guardrails-heading" className="dash-section-title">
        Portfolio guardrails
      </h2>

      <dl className="dash-metric-grid dash-metric-grid--compact">
        <div className="dash-metric">
          <dt>Open positions</dt>
          <dd
            className="dash-metric__value tabular-nums"
            data-testid="dashboard-guardrail-max-positions"
          >
            {maxConcurrentPositions.count} / {maxConcurrentPositions.limit}
            {maxConcurrentPositions.atOrOverLimit ? (
              <Badge tone="warning" size="compact">
                At cap
              </Badge>
            ) : null}
          </dd>
        </div>
        <div className="dash-metric">
          <dt>Portfolio heat (risk-to-stop)</dt>
          <dd
            className="dash-metric__value tabular-nums"
            data-testid="dashboard-guardrail-portfolio-heat"
          >
            {formatVND(portfolioHeat.portfolioHeatVnd, true)}
            {portfolioHeat.portfolioHeatPctOfEquity != null
              ? ` (~${(portfolioHeat.portfolioHeatPctOfEquity * 100).toFixed(1)}% of equity)`
              : ""}
            {portfolioHeat.dataQuality === "mostly_unknown" ? (
              <Badge tone="danger" size="compact">
                Mostly unknown risk
              </Badge>
            ) : portfolioHeat.isElevated ? (
              <Badge tone="danger" size="compact">
                Elevated
              </Badge>
            ) : null}
          </dd>
        </div>
      </dl>

      <p
        className="dash-portfolio-guardrails__hint text-xs"
        style={
          portfolioHeat.dataQuality === "mostly_unknown"
            ? { color: "var(--danger, #b91c1c)", fontWeight: 600 }
            : { color: "var(--text-tertiary)" }
        }
        data-testid="dashboard-guardrail-heat-status-copy"
      >
        {portfolioHeat.dataQuality === "mostly_unknown"
          ? `Most open positions have unknown risk — do not read the figure above as low total risk. ${portfolioHeat.statusCopy}`
          : portfolioHeat.statusCopy}
      </p>

      {duplicateSymbolExposure.length > 0 ? (
        <div data-testid="dashboard-guardrail-duplicate-exposure">
          <p className="dash-portfolio-guardrails__hint text-xs">
            Multiple open/planned rows for the same symbol — exposure may be understated elsewhere:
          </p>
          <ul className="dash-portfolio-guardrails__duplicates">
            {duplicateSymbolExposure.map((entry) => (
              <li key={entry.symbol}>
                {entry.symbol}: {entry.plannedCount} planned + {entry.openCount} open ={" "}
                {formatVND(entry.combinedNotionalVnd, true)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
