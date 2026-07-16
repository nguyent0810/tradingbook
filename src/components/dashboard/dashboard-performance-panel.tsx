"use client";

import type { Trade } from "@/generated/prisma/client";
import { formatVND } from "@/lib/formatters";
import {
  computeAdvancedMetrics,
  computeEquityCurve,
  computeOutcomeBreakdown,
  type TradeOutcomeCategory,
} from "@/lib/analytics";
import { Area, AreaChart, Cell, Pie, PieChart, Tooltip } from "recharts";
import { useReducedMotion } from "framer-motion";
import { ChartFrame, ChartPlot } from "@/components/command-deck";

const OUTCOME_COLOR: Record<TradeOutcomeCategory, string> = {
  WIN: "var(--pnl-positive)",
  LOSS: "var(--pnl-negative)",
  BREAKEVEN: "var(--text-tertiary)",
};

export type DashboardPerformancePanelProps = {
  trades: Trade[];
  error?: boolean;
};

export function DashboardPerformancePanel({
  trades,
  error = false,
}: DashboardPerformancePanelProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const metrics = computeAdvancedMetrics(trades);
  const curve = computeEquityCurve(trades);
  const recent = curve.slice(-24);
  const outcomeBreakdown = computeOutcomeBreakdown(trades);
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

      {error ? (
        <p
          className="dash-performance__empty dash-performance__empty--error"
          data-testid="dashboard-performance-error"
          role="alert"
        >
          Trade history could not be loaded.
        </p>
      ) : metrics.totalTrades === 0 ? (
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
                      const displayDate = point.date
                        ? new Date(point.date).toLocaleDateString()
                        : point.date;
                      return (
                        <div className="chart-frame__tooltip">
                          <p className="chart-frame__tooltip-label">{displayDate}</p>
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
                    isAnimationActive={!reducedMotion}
                  />
                </AreaChart>
              </ChartPlot>
            </ChartFrame>
          ) : null}
          {outcomeBreakdown.length > 0 ? (
            <ChartFrame
              testId="dashboard-outcome-donut"
              title="Win / Loss / Breakeven"
              description="Closed trades, by outcome"
              height="compact"
              className="dash-performance__donut"
            >
              <ChartPlot height={140}>
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const slice = payload[0]?.payload as
                        | (typeof outcomeBreakdown)[number]
                        | undefined;
                      if (!slice) return null;
                      return (
                        <div className="chart-frame__tooltip">
                          <p className="chart-frame__tooltip-label">{slice.label}</p>
                          <p className="chart-frame__tooltip-value tabular-nums">
                            {slice.count} trade{slice.count === 1 ? "" : "s"} ({slice.pct}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={outcomeBreakdown}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {outcomeBreakdown.map((slice) => (
                      <Cell key={slice.outcome} fill={OUTCOME_COLOR[slice.outcome]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartPlot>
              <ul className="dash-performance__donut-legend">
                {outcomeBreakdown.map((slice) => (
                  <li key={slice.outcome}>
                    <span
                      className="dash-performance__donut-dot"
                      style={{ background: OUTCOME_COLOR[slice.outcome] }}
                      aria-hidden="true"
                    />
                    {slice.label} {slice.pct}%
                  </li>
                ))}
              </ul>
            </ChartFrame>
          ) : null}
        </>
      )}
    </section>
  );
}
