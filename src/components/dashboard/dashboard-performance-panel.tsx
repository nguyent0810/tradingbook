import type { Trade } from "@/generated/prisma/client";
import { formatVND } from "@/lib/formatters";
import { computeAdvancedMetrics, computeEquityCurve } from "@/lib/analytics";

export type DashboardPerformancePanelProps = {
  trades: Trade[];
};

export function DashboardPerformancePanel({ trades }: DashboardPerformancePanelProps) {
  const metrics = computeAdvancedMetrics(trades);
  const curve = computeEquityCurve(trades);
  const recent = curve.slice(-24);
  const values = recent.map((p) => p.cumulativePnl);
  const min = values.length ? Math.min(...values, 0) : 0;
  const max = values.length ? Math.max(...values, 0) : 1;
  const range = Math.max(max - min, 1);

  return (
    <section
      className="dash-performance dash-surface-1"
      data-testid="dashboard-performance-panel"
      aria-labelledby="dashboard-performance-heading"
    >
      <h2 id="dashboard-performance-heading" className="dash-section-title dash-section-title--muted">
        System performance
      </h2>
      <p className="dash-performance__subtitle">Closed trades only — secondary to today&apos;s stance</p>

      {metrics.totalTrades === 0 ? (
        <p className="dash-performance__empty" data-testid="dashboard-performance-empty">
          No closed trades yet — equity curve appears after first exit.
        </p>
      ) : (
        <>
          <dl className="dash-performance__stats">
            <div>
              <dt>Closed</dt>
              <dd className="tabular-nums">{metrics.totalTrades}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd className="tabular-nums">{metrics.winRate}%</dd>
            </div>
            <div>
              <dt>Total P&amp;L</dt>
              <dd
                className="tabular-nums"
                style={{
                  color:
                    metrics.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--pnl-negative)",
                }}
              >
                {formatVND(metrics.totalPnl, true)}
              </dd>
            </div>
          </dl>
          {recent.length > 1 ? (
            <div
              className="dash-equity-spark"
              role="img"
              aria-label="Cumulative P and L sparkline from closed trades"
              data-testid="dashboard-equity-sparkline"
            >
              {recent.map((point, i) => {
                const heightPct = ((point.cumulativePnl - min) / range) * 100;
                const positive = point.cumulativePnl >= 0;
                return (
                  <span
                    key={`${point.date}-${i}`}
                    className={`dash-equity-spark__bar${positive ? " dash-equity-spark__bar--up" : " dash-equity-spark__bar--down"}`}
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                    title={`${point.date}: ${point.cumulativePnl}`}
                  />
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
