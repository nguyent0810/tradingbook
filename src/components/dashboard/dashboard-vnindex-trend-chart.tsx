"use client";

import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";
import { ChartFrame, ChartPlot } from "@/components/command-deck";

export type DashboardVnindexTrendChartProps = {
  history: VnindexHistoryPoint[];
  error?: boolean;
};

const CHART_HEIGHT = 140;
const GRADIENT_ID = "dashboardVnindexTrendGrad";

export function DashboardVnindexTrendChart({
  history,
  error = false,
}: DashboardVnindexTrendChartProps) {
  const reducedMotion = useReducedMotion() ?? false;

  if (error) {
    return (
      <ChartFrame
        testId="dashboard-vnindex-trend-chart"
        title="VNINDEX — 30D"
        height={CHART_HEIGHT}
        state="error"
        errorMessage="VNINDEX history could not be loaded."
      />
    );
  }

  if (history.length < 2) {
    return (
      <ChartFrame
        testId="dashboard-vnindex-trend-chart"
        title={`VNINDEX — ${history.length === 0 ? "no history" : "30D"}`}
        height={CHART_HEIGHT}
        state="empty"
        emptyMessage="Not enough VNINDEX history to chart yet."
      />
    );
  }

  const first = history[0]!.close;
  const last = history[history.length - 1]!.close;
  const isUp = last >= first;
  const color = isUp ? "var(--pnl-positive)" : "var(--pnl-negative)";

  return (
    <ChartFrame
      testId="dashboard-vnindex-trend-chart"
      title="VNINDEX — 30D"
      height={CHART_HEIGHT}
    >
      <ChartPlot height={CHART_HEIGHT}>
        <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as VnindexHistoryPoint | undefined;
              if (!point) return null;
              return (
                <div className="chart-frame__tooltip">
                  <p className="chart-frame__tooltip-label">{point.date}</p>
                  <p className="chart-frame__tooltip-value tabular-nums">
                    {point.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            fillOpacity={1}
            fill={`url(#${GRADIENT_ID})`}
            isAnimationActive={!reducedMotion}
          />
        </AreaChart>
      </ChartPlot>
    </ChartFrame>
  );
}
