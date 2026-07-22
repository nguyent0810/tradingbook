"use client";

import dynamic from "next/dynamic";
import { LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

/** Deferred client boundary — keeps framer-motion out of the initial /setups bundle. */
export const IntelligenceSidebarLazy = dynamic(
  () => import("./IntelligenceSidebar").then((m) => m.IntelligenceSidebar),
  {
    ssr: false,
    loading: () => (
      <div
        className="sw-glass-panel flex h-full flex-col overflow-hidden"
        data-testid="setups-sidebar"
        role="status"
        aria-label="Đang tải bảng thông tin"
      >
        <LoadingSkeletonGroup rows={5} className="p-4" />
      </div>
    ),
  }
);
