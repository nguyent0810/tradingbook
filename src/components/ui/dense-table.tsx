import type { ReactNode } from "react";

export type DenseTableProps = {
  children: ReactNode;
  minWidth?: string;
  testId?: string;
  className?: string;
  stickyFirstColumn?: boolean;
  /** Accessible name for the scroll region (e.g. trades ledger). */
  ariaLabel?: string;
  /** Shown to screen readers when horizontal scroll is expected. */
  scrollHint?: string;
};

export function DenseTable({
  children,
  minWidth = "760px",
  testId,
  className = "",
  stickyFirstColumn = true,
  ariaLabel = "Bảng dữ liệu",
  scrollHint,
}: DenseTableProps) {
  return (
    <div
      className={`dense-table-scroll table-container ${stickyFirstColumn ? "dense-table-scroll--sticky-symbol" : ""} ${className}`.trim()}
      data-testid={testId}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      style={{ ["--dense-table-min" as string]: minWidth }}
    >
      {scrollHint ? (
        <span className="dense-table-scroll__hint visually-hidden">{scrollHint}</span>
      ) : null}
      {children}
    </div>
  );
}
