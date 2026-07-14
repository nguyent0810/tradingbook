import type { ReactNode } from "react";

export type EmptyStateWithReasonProps = {
  title: string;
  /** Plain-language reason — not invented backend detail. */
  reason: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
  /** No bordered panel/padding — for a small slot already inside its own bordered container. */
  compact?: boolean;
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
  compact = false,
}: EmptyStateWithReasonProps) {
  if (compact) {
    return (
      <div
        className={`ui-state-panel--compact ${className}`.trim()}
        data-testid={testId}
        role="status"
      >
        {icon ? <span className="ui-state-panel--compact__icon">{icon}</span> : null}
        <p className="ui-state-panel--compact__title">{title}</p>
        <p className="ui-state-panel--compact__body">{reason}</p>
        {children}
      </div>
    );
  }

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
