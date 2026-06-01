import type { ReactNode } from "react";

export type V3PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Page-specific hook without layout side effects (e.g. `tosv3-setups-page`). */
  pageClassName?: string;
  testId?: string;
};

/**
 * Canonical V3 page shell — full width rhythm via `--command-deck-max-width`.
 * Use for dashboard, setups, trades, and log-trade routes.
 */
export function V3PageShell({
  children,
  className = "",
  pageClassName = "",
  testId,
}: V3PageShellProps) {
  const workstation = !pageClassName.includes("tosv3-dashboard");
  const rootClass = [
    "tosv3-page-shell",
    "pb-10",
    workstation ? "tosv3-workstation" : "",
    pageClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} data-testid={testId}>
      <div
        className={`tosv3-page-shell__bg-grid${workstation ? " tosv3-workstation__bg-grid" : ""}`}
        aria-hidden
      />
      <div
        className={`tosv3-page-shell__bg-noise${workstation ? " tosv3-workstation__bg-noise" : ""}`}
        aria-hidden
      />
      <div className="tosv3-page-shell__inner tosv3-workstation__inner">{children}</div>
    </div>
  );
}

/** @deprecated Use `V3PageShell` — alias preserved for existing imports. */
export function V3WorkstationShell(props: V3PageShellProps) {
  return <V3PageShell {...props} />;
}
