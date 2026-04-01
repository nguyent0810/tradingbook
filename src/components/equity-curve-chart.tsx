"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import type { EquityDataPoint } from "@/lib/analytics";

export function EquityCurveChart({ data }: { data: EquityDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Not enough closed trades to plot equity curve.
        </p>
      </div>
    );
  }

  const isNetPositive = data[data.length - 1].cumulativePnl >= 0;
  const strokeColor = isNetPositive
    ? "var(--pnl-positive)"
    : "var(--danger)"; // Using danger/negative red

  return (
    <div className="h-[350px] w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] pb-6 relative z-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorCumulativePnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
              borderRadius: "0.5rem",
              color: "var(--text-primary)",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            name="Cumulative P&L"
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCumulativePnl)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
