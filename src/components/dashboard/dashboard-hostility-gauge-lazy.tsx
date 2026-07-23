"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/**
 * Deferred client boundary for the recharts-dependent hostility gauge. Keeps `ssr`
 * default (true) — this widget is above the fold and must render on first paint; only
 * the recharts hydration JS is split out of the initial dashboard bundle.
 */
export const DashboardHostilityGaugeLazy = dynamic(
  () =>
    import("@/components/dashboard/dashboard-hostility-gauge").then(
      (m) => m.DashboardHostilityGauge
    ),
  {
    loading: () => <LoadingSkeleton height="140px" aria-label="Đang tải chỉ số mức độ thù địch" />,
  }
);
