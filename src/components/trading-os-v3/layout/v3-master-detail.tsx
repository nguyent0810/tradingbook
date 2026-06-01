import type { ReactNode } from "react";

export type V3MasterDetailSelectorDensity = "default" | "compact" | "single";

export type V3MasterDetailProps = {
  children: ReactNode;
  className?: string;
  /** Enable internal scroll on selector when list is long. */
  scrollSelector?: boolean;
  /**
   * Selector column width rhythm — `single`/`compact` avoid dead space with few rows.
   * @default "default"
   */
  selectorDensity?: V3MasterDetailSelectorDensity;
};

export type V3MasterDetailSlotProps = {
  children: ReactNode;
  className?: string;
};

function Selector({ children, className = "" }: V3MasterDetailSlotProps) {
  return (
    <aside className={`tosv3-layout-master-detail__selector ${className}`.trim()}>
      {children}
    </aside>
  );
}

function Detail({ children, className = "" }: V3MasterDetailSlotProps) {
  return (
    <div className={`tosv3-layout-master-detail__detail ${className}`.trim()}>{children}</div>
  );
}

/**
 * Selector column + detail column inside a cockpit workspace.
 */
export function V3MasterDetail({
  children,
  className = "",
  scrollSelector = false,
  selectorDensity = "default",
}: V3MasterDetailProps) {
  const densityClass =
    selectorDensity !== "default" ? ` tosv3-layout-master-detail--${selectorDensity}` : "";

  return (
    <div
      className={`tosv3-layout-master-detail${scrollSelector ? " tosv3-layout-master-detail--scroll-selector" : ""}${densityClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

V3MasterDetail.Selector = Selector;
V3MasterDetail.Detail = Detail;
