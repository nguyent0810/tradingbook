import type { ReactNode } from "react";

export type EmptyStateWithReasonProps = {
  title: string;
  /** Plain-language reason — not invented backend detail. */
  reason: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Empty data with explicit reason (replaces silent empty cards in later phases).
 */
export function EmptyStateWithReason({
  title,
  reason,
  icon,
  children,
  className = "",
  "data-testid": testId,
}: EmptyStateWithReasonProps) {
  return (
    <div
      className={`ui-state-panel ${className}`.trim()}
      data-testid={testId}
      role="status"
    >
      {icon ? (
        <div className="empty-state-icon mb-4" style={{ marginBottom: "var(--space-4)" }}>
          {icon}
        </div>
      ) : null}
      <p className="ui-state-panel__title">{title}</p>
      <p className="ui-state-panel__body">{reason}</p>
      {children ? <div className="ui-state-actions">{children}</div> : null}
    </div>
  );
}
