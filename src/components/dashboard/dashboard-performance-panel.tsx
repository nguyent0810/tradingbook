"use client";

import type { Trade } from "@/generated/prisma/client";
import { formatVND } from "@/lib/formatters";
import { computeAdvancedMetrics, computeEquityCurve } from "@/lib/analytics";
import { Area, AreaChart, Tooltip } from "recharts";
import { ChartFrame, ChartPlot } from "@/components/command-deck";

export type DashboardPerformancePanelProps = {
  trades: Trade[];
};

export function DashboardPerformancePanel({ trades }: DashboardPerformancePanelProps) {
  const metrics = computeAdvancedMetrics(trades);
  const curve = computeEquityCurve(trades);
  const recent = curve.slice(-24);
  const gradientId = "dashboardPerfPnlGrad";

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
          No closed positions yet — equity curve appears after first exit.
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
            <ChartFrame
              testId="dashboard-equity-sparkline"
              height="sparkline"
              state="ready"
              description="Recent cumulative P&amp;L (closed positions)"
              className="dash-performance__sparkline chart-frame--inline"
            >
              <ChartPlot height={56}>
                <AreaChart data={recent} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={
                          metrics.totalPnl >= 0
                            ? "var(--pnl-positive)"
                            : "var(--pnl-negative)"
                        }
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={
                          metrics.totalPnl >= 0
                            ? "var(--pnl-positive)"
                            : "var(--pnl-negative)"
                        }
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as {
                        date?: string;
                        cumulativePnl?: number;
                      };
                      if (point.cumulativePnl == null) return null;
                      const isPositive = point.cumulativePnl >= 0;
                      return (
                        <div className="chart-frame__tooltip">
                          <p className="chart-frame__tooltip-label">{point.date}</p>
                          <p
                            className="chart-frame__tooltip-value tabular-nums"
                            style={{
                              color: isPositive
                                ? "var(--pnl-positive)"
                                : "var(--pnl-negative)",
                            }}
                          >
                            {formatVND(point.cumulativePnl, true)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativePnl"
                    stroke={
                      metrics.totalPnl >= 0
                        ? "var(--pnl-positive)"
                        : "var(--pnl-negative)"
                    }
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill={`url(#${gradientId})`}
                  />
                </AreaChart>
              </ChartPlot>
            </ChartFrame>
          ) : null}
        </>
      )}
    </section>
  );
}
