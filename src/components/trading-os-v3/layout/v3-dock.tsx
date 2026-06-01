import type { HTMLAttributes, ReactNode } from "react";

export type V3DockProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
  "aria-label"?: string;
};

export type V3DockTabsProps = HTMLAttributes<HTMLDivElement>;
export type V3DockBodyProps = HTMLAttributes<HTMLDivElement>;
export type V3DockPanelProps = HTMLAttributes<HTMLDivElement>;

function Tabs({ children, className = "", ...rest }: V3DockTabsProps) {
  return (
    <div className={`tosv3-layout-dock__tabs ${className}`.trim()} role="tablist" {...rest}>
      {children}
    </div>
  );
}

function Body({ children, className = "", ...rest }: V3DockBodyProps) {
  return (
    <div className={`tosv3-layout-dock__body ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

function Panel({ children, className = "", ...rest }: V3DockPanelProps) {
  return (
    <div className={`tosv3-layout-dock__panel ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

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

V3Dock.Tabs = Tabs;
V3Dock.Body = Body;
V3Dock.Panel = Panel;
