"use client";

import { useEffect } from "react";
import { TerminalRouteError } from "@/components/terminal/route-error";

/** Ranh giới lỗi cho toàn bộ nhóm màn terminal (F1–F5). */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[terminal] route error:", error);
  }, [error]);

  return (
    <TerminalRouteError
      error={error}
      reset={reset}
      title="Terminal không dựng được màn này"
      note="Dữ liệu và hợp đồng API không đổi. Thử tải lại; nếu vẫn lỗi, dùng mã bằng chứng bên dưới để tra log."
      boundary="src/app/(dashboard)/error.tsx"
    />
  );
}
