"use client";

import type { Trade } from "@/generated/prisma/client";
import { formatVND } from "@/lib/formatters";
import { computeAdvancedMetrics, computeEquityCurve } from "@/lib/analytics";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";


export type DashboardPerformancePanelProps = {
  trades: Trade[];
};

export function DashboardPerformancePanel({ trades }: DashboardPerformancePanelProps) {
  const metrics = computeAdvancedMetrics(trades);
  const curve = computeEquityCurve(trades);
  const recent = curve.slice(-24);

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
              className="h-[60px] w-full mt-4 pt-2 border-t border-[#1f1f23] relative z-0"
              data-testid="dashboard-equity-sparkline"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recent} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="dashboardPerfPnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metrics.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--pnl-negative)"} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={metrics.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--pnl-negative)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]?.payload as {
                        date?: string;
                        cumulativePnl?: number;
                      };
                      if (data.cumulativePnl == null) return null;
                      const isPositive = data.cumulativePnl >= 0;
                      return (
                        <div className="bg-[#18181c] border border-[#27272a] rounded-lg p-2 shadow-xl text-xs font-sans">
                          <p className="text-[#71717a] font-mono text-[10px]">{data.date}</p>
                          <p
                            className="font-semibold mt-0.5"
                            style={{
                              color: isPositive ? "var(--pnl-positive)" : "var(--pnl-negative)",
                            }}
                          >
                            {formatVND(data.cumulativePnl, true)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativePnl"
                    stroke={metrics.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--pnl-negative)"}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#dashboardPerfPnlGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
