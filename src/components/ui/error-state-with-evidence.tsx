import type { ReactNode } from "react";

export type ErrorStateWithEvidenceProps = {
  title: string;
  message: string;
  /** File path, error code, or query id — caller supplies real evidence only. */
  evidence?: string | null;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Failed load with optional trace evidence (no mock errors).
 */
export function ErrorStateWithEvidence({
  title,
  message,
  evidence,
  children,
  className = "",
  "data-testid": testId,
}: ErrorStateWithEvidenceProps) {
  return (
    <div
      className={`ui-state-panel status-surface--failed ${className}`.trim()}
      role="alert"
      data-testid={testId}
    >
      <p className="ui-state-panel__eyebrow">Error</p>
      <p className="ui-state-panel__title">{title}</p>
      <p className="ui-state-panel__body">{message}</p>
      {evidence?.trim() ? (
        <pre className="ui-state-panel__evidence">{evidence.trim()}</pre>
      ) : null}
      {children ? <div className="ui-state-actions">{children}</div> : null}
    </div>
  );
}
