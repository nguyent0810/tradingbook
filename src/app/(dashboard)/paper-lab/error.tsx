"use client";

import { useEffect } from "react";
import { TerminalRouteError } from "@/components/terminal/route-error";

export default function PaperLabError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[paper-lab] route error:", error);
  }, [error]);

  return (
    <TerminalRouteError
      error={error}
      reset={reset}
      title="Không dựng được màn F3 Đấu trường"
      note="Dữ liệu mô phỏng không đổi. Thử tải lại; nếu vẫn lỗi, dùng mã bằng chứng bên dưới để tra log."
      boundary="src/app/(dashboard)/paper-lab/error.tsx"
    />
  );
}
