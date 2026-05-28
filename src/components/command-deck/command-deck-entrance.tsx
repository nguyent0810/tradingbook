import type { CSSProperties, ReactNode } from "react";
import React from "react";

type EntranceStyle = CSSProperties & {
  "--entrance-index"?: number;
};

export type CommandDeckEntranceProps = {
  children: ReactNode;
  /** Stagger child zones on reveal (dashboard command band). */
  stagger?: boolean;
  testId?: string;
  className?: string;
};

/**
 * Unified page/flow entrance for command-deck routes.
 * Uses CSS stagger tokens; respects `prefers-reduced-motion`.
 */
export function CommandDeckEntrance({
  children,
  stagger = false,
  testId,
  className = "",
}: CommandDeckEntranceProps) {
  const rootClass = [
    "command-deck__entrance",
    "dash-cockpit-v2__entrance",
    stagger ? "command-deck__entrance--stagger" : "command-deck__entrance--flow",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!stagger) {
    return (
      <div className={rootClass} data-testid={testId}>
        {children}
      </div>
    );
  }

  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <div className={rootClass} data-testid={testId}>
      {items.map((child, index) => {
        const style: EntranceStyle = { "--entrance-index": index };
        return (
          <div
            key={index}
            className="command-deck__entrance-item dash-cockpit-v2__entrance-item"
            style={style}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
