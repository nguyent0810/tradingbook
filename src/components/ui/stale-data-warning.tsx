import type { ReactNode } from "react";

export type StaleDataWarningProps = {
  title?: string;
  message: string;
  detail?: string | null;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Market/bar freshness warning — presentation only; caller supplies real dates/context.
 */
export function StaleDataWarning({
  title = "Stale market data",
  message,
  detail,
  children,
  className = "",
  "data-testid": testId,
}: StaleDataWarningProps) {
  return (
    <div
      className={`ui-state-panel status-surface--stale ${className}`.trim()}
      role="status"
      data-testid={testId ?? "stale-data-warning"}
    >
      <p className="ui-state-panel__eyebrow">Data freshness</p>
      <p className="ui-state-panel__title">{title}</p>
      <p className="ui-state-panel__body">{message}</p>
      {detail?.trim() ? (
        <p
          className="mt-2 text-xs leading-snug"
          style={{ color: "var(--text-tertiary)" }}
        >
          {detail.trim()}
        </p>
      ) : null}
      {children ? <div className="ui-state-actions">{children}</div> : null}
    </div>
  );
}
