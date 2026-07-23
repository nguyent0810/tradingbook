"use client";

import type { ReactNode } from "react";

export type RetryActionPanelProps = {
  message: string;
  /** When omitted, retry button is not rendered (no fake retry handler). */
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Optional client retry affordance — only shows action when `onRetry` is provided.
 */
export function RetryActionPanel({
  message,
  onRetry,
  retryLabel = "Thử lại",
  busy = false,
  children,
  className = "",
  "data-testid": testId,
}: RetryActionPanelProps) {
  return (
    <div
      className={`ui-state-panel status-surface--warning ${className}`.trim()}
      data-testid={testId ?? "retry-action-panel"}
    >
      <p className="ui-state-panel__body">{message}</p>
      <div className="ui-state-actions">
        {onRetry ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetry}
            disabled={busy}
          >
            {busy ? "Retrying…" : retryLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
