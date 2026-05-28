"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityDataPoint } from "@/lib/analytics";
import { formatVND } from "@/lib/formatters";
import { ChartFrame, ChartPlot } from "@/components/command-deck";

export function EquityCurveChart({ data }: { data: EquityDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartFrame
        testId="equity-curve-chart"
        height="default"
        state="empty"
        emptyMessage="Not enough closed trades to plot equity curve."
      />
    );
  }

  const isNetPositive = data[data.length - 1].cumulativePnl >= 0;
  const strokeColor = isNetPositive ? "var(--pnl-positive)" : "var(--danger)";
  const gradientId = "equityCurvePnlGrad";

  return (
    <ChartFrame
      testId="equity-curve-chart"
      title="Equity curve"
      description="Cumulative realized P&amp;L from closed trades"
      height="default"
      state="ready"
      className="chart-frame--bordered"
    >
      <ChartPlot height={350}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-primary)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => formatVND(val, true)}
            width={72}
          />
          <Tooltip
            formatter={(value: number | string | readonly (number | string)[] | undefined) => [
              formatVND(Number(Array.isArray(value) ? value[0] : value) || 0),
              "Cumulative P&L",
            ]}
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-primary)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            name="Cumulative P&L"
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ChartPlot>
    </ChartFrame>
  );
}
