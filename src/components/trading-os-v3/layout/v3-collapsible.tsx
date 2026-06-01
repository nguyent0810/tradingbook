"use client";

import type { ReactNode } from "react";
import { useId } from "react";

export type V3CollapsibleProps = {
  summary: ReactNode;
  children: ReactNode;
  testId?: string;
  defaultOpen?: boolean;
  className?: string;
};

/** Collapsed-by-default disclosure — replaces command-deck collapsible on V3 routes. */
export function V3Collapsible({
  summary,
  children,
  testId,
  defaultOpen = false,
  className = "",
}: V3CollapsibleProps) {
  const bodyId = useId();

  return (
    <details
      className={`tosv3-collapsible ${className}`.trim()}
      data-testid={testId}
      open={defaultOpen || undefined}
    >
      <summary className="tosv3-collapsible__summary" aria-controls={bodyId}>
        {summary}
      </summary>
      <div id={bodyId} className="tosv3-collapsible__body">
        {children}
      </div>
    </details>
  );
}
