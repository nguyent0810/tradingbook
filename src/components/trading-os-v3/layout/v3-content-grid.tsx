import type { ReactNode } from "react";

export type V3ContentGridProps = {
  children: ReactNode;
  /** `cockpit` = main workspace + right dock (70/30). `stack` = single column. */
  layout?: "cockpit" | "stack";
  className?: string;
  "aria-label"?: string;
};

export type V3ContentGridSlotProps = {
  children: ReactNode;
  className?: string;
};

function Main({ children, className = "" }: V3ContentGridSlotProps) {
  return (
    <div className={`tosv3-layout-cockpit__main ${className}`.trim()}>{children}</div>
  );
}

function Aside({ children, className = "" }: V3ContentGridSlotProps) {
  return (
    <div className={`tosv3-layout-cockpit__aside ${className}`.trim()}>{children}</div>
  );
}

/**
 * Page-level two-column grid (workspace + dock). Children must be `Main` and `Aside`.
 */
export function V3ContentGrid({
  children,
  layout = "cockpit",
  className = "",
  "aria-label": ariaLabel,
}: V3ContentGridProps) {
  const layoutClass =
    layout === "stack" ? "tosv3-layout-cockpit tosv3-layout-cockpit--stack" : "tosv3-layout-cockpit";

  return (
    <section className={`${layoutClass} ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </section>
  );
}

V3ContentGrid.Main = Main;
V3ContentGrid.Aside = Aside;
