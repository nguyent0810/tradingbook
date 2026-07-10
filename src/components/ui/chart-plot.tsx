"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

export type ChartPlotProps = {
  children: ReactNode;
  /** Explicit pixel height — required for stable Recharts layout (SSR-safe). */
  height: number;
  className?: string;
};

/**
 * Recharts host with explicit pixel dimensions (avoids width/height -1 warnings).
 */
export function ChartPlot({ children, height, className = "" }: ChartPlotProps) {
  const plotHeight = Math.max(height, 1);

  return (
    <div
      className={`chart-plot ${className}`.trim()}
      style={{ width: "100%", height: plotHeight, minHeight: plotHeight }}
    >
      <ResponsiveContainer width="100%" height={plotHeight}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
