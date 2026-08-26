import type { CSSProperties } from "react";

export type LoadingSkeletonProps = {
  className?: string;
  /** Block height, e.g. `2.5rem` or `100%` */
  height?: string | number;
  width?: string | number;
  style?: CSSProperties;
  "aria-label"?: string;
};

/**
 * Ô giữ chỗ lúc tải.
 *
 * Trước đây dùng class `.skeleton` của `dashboard-shell.css` (nền linear-gradient
 * chạy shimmer). File đó đã bị gỡ ở Gate 8, và gradient cũng nằm trong danh mục
 * CẤM của bản thiết kế (QA §12) — nên chuyển sang `.tm-skel-bar` của terminal,
 * vốn đã được `(dashboard)/layout.tsx` nạp sẵn cho mọi route con.
 */
export function LoadingSkeleton({
  className = "",
  height = "1rem",
  width = "100%",
  style,
  "aria-label": ariaLabel = "Loading",
}: LoadingSkeletonProps) {
  return (
    <div
      className={`tm-skel-bar ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      style={{ height, width, ...style }}
    />
  );
}

export type LoadingSkeletonGroupProps = {
  rows?: number;
  rowHeight?: string;
  gap?: string;
  className?: string;
};

/** Stacked skeleton lines for tables/cards. */
export function LoadingSkeletonGroup({
  rows = 3,
  rowHeight = "2.5rem",
  gap = "var(--space-2)",
  className = "",
}: LoadingSkeletonGroupProps) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: rows }, (_, i) => (
        <LoadingSkeleton key={i} height={rowHeight} aria-label={`Loading row ${i + 1}`} />
      ))}
    </div>
  );
}
