"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/**
 * Deferred client boundary for the recharts-dependent performance panel — it lives inside
 * a collapsed-by-default `<details>` (see DashboardBookSnapshot), so ssr:false keeps recharts
 * out of the initial dashboard bundle without a visible flash for most visitors.
 */
export const DashboardPerformancePanelLazy = dynamic(
  () =>
    import("@/components/dashboard/dashboard-performance-panel").then(
      (m) => m.DashboardPerformancePanel
    ),
  {
    ssr: false,
    loading: () => <LoadingSkeleton height="7rem" aria-label="Loading performance panel" />,
  }
);
