"use client";

import { useEffect } from "react";
import { TerminalRouteError } from "@/components/terminal/route-error";

export default function SetupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[setups] route error:", error);
  }, [error]);

  return (
    <TerminalRouteError
      error={error}
      reset={reset}
      title="Không dựng được màn F2 Thiết lập"
      note="Dữ liệu bộ quét và ứng viên không đổi. Thử tải lại; nếu vẫn lỗi, dùng mã bằng chứng bên dưới để tra log."
      boundary="src/app/(dashboard)/setups/error.tsx"
    />
  );
}
