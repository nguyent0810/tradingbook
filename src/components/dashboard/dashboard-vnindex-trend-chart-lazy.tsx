"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/**
 * Deferred client boundary for the recharts-dependent VNINDEX trend chart. Keeps `ssr`
 * default (true) — this widget is above the fold and must render on first paint; only
 * the recharts hydration JS is split out of the initial dashboard bundle.
 */
export const DashboardVnindexTrendChartLazy = dynamic(
  () =>
    import("@/components/dashboard/dashboard-vnindex-trend-chart").then(
      (m) => m.DashboardVnindexTrendChart
    ),
  {
    loading: () => <LoadingSkeleton height="140px" aria-label="Đang tải biểu đồ xu hướng VNINDEX" />,
  }
);
