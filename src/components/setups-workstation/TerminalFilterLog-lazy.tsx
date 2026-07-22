"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/** Deferred client boundary — keeps framer-motion out of the initial /setups bundle. */
export const TerminalFilterLogLazy = dynamic(
  () => import("./TerminalFilterLog").then((m) => m.TerminalFilterLog),
  {
    ssr: false,
    loading: () => <LoadingSkeleton height="2.75rem" aria-label="Đang tải bộ lọc thanh khoản" />,
  }
);
