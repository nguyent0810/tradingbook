import type { ReactNode } from "react";

export type V3DockProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
  "aria-label"?: string;
};

/** Right-side tabbed intelligence dock (setups pipeline stance/funnel/diagnostics). */
export function V3Dock({
  children,
  className = "",
  testId,
  "aria-label": ariaLabel,
}: V3DockProps) {
  return (
    <aside
      className={`tosv3-layout-dock tosv3-panel tosv3-glass-panel ${className}`.trim()}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {children}
    </aside>
  );
}
