import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** Premium dark cockpit shell for setups, trades, and log-trade flows. */
export function V3WorkstationShell({ children, className = "", testId }: Props) {
  return (
    <div
      className={`tosv3-workstation page-container pb-10 ${className}`.trim()}
      data-testid={testId}
    >
      <div className="tosv3-workstation__bg-grid" aria-hidden />
      <div className="tosv3-workstation__bg-noise" aria-hidden />
      <div className="tosv3-workstation__inner">{children}</div>
    </div>
  );
}
