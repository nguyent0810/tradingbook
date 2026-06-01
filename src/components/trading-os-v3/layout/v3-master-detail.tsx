import type { ReactNode } from "react";

export type V3MasterDetailProps = {
  children: ReactNode;
  className?: string;
  /** Enable internal scroll on selector when list is long. */
  scrollSelector?: boolean;
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
}: V3MasterDetailProps) {
  return (
    <div
      className={`tosv3-layout-master-detail${scrollSelector ? " tosv3-layout-master-detail--scroll-selector" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

V3MasterDetail.Selector = Selector;
V3MasterDetail.Detail = Detail;
