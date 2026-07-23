"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] route error:", error);
  }, [error]);

  return (
    <div className="page-container command-deck pb-10">
      <div className="ui-state-panel command-deck-route-error" role="alert">
        <p className="ui-state-panel__eyebrow">Trung tâm điều khiển không khả dụng</p>
        <h1 className="ui-state-panel__title">Đã xảy ra lỗi</h1>
        <p className="ui-state-panel__body">
          Trung tâm điều khiển giao dịch không tải được. Dữ liệu và hợp đồng API của bạn không
          đổi — hãy thử lại hoặc quay về một route ổn định.
        </p>
        {error.digest ? (
          <p className="ui-state-panel__evidence">{error.digest}</p>
        ) : null}
        <div className="ui-state-actions mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Thử lại
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Tải lại bảng điều khiển
          </Link>
        </div>
      </div>
    </div>
  );
}
