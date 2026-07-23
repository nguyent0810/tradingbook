import type { ReactNode } from "react";

export type BackendBlockedStateProps = {
  feature: string;
  reason: string;
  /** Optional integration doc reference, e.g. `docs/integration/06-backend-gaps.md#8` */
  contractRef?: string | null;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Placeholder for routes/features with no backend read path — do not wire fake data.
 */
export function BackendBlockedState({
  feature,
  reason,
  contractRef,
  children,
  className = "",
  "data-testid": testId,
}: BackendBlockedStateProps) {
  return (
    <div
      className={`ui-state-panel status-surface--backend-blocked ${className}`.trim()}
      role="status"
      data-testid={testId ?? "backend-blocked-state"}
    >
      <p className="ui-state-panel__eyebrow">Backend chưa hỗ trợ</p>
      <p className="ui-state-panel__title">{feature}</p>
      <p className="ui-state-panel__body">{reason}</p>
      {contractRef?.trim() ? (
        <pre className="ui-state-panel__evidence">{contractRef.trim()}</pre>
      ) : null}
      {children ? <div className="ui-state-actions">{children}</div> : null}
    </div>
  );
}
