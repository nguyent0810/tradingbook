import type { ReactNode } from "react";

export type V3PanelProps = {
  children: ReactNode;
  className?: string;
  /** When false, skip glass surface (rare nested cases). */
  glass?: boolean;
};

/** Standard V3 elevated surface — prefer over stacking legacy deck panel classes. */
export function V3Panel({ children, className = "", glass = true }: V3PanelProps) {
  return (
    <div
      className={`tosv3-panel${glass ? " tosv3-glass-panel" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
