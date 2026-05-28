"use client";

import type { ReactNode } from "react";
import { useId } from "react";

export type CommandDeckCollapsibleProps = {
  summary: string;
  testId?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function CommandDeckCollapsible({
  summary,
  testId,
  defaultOpen = false,
  children,
  className = "",
}: CommandDeckCollapsibleProps) {
  const bodyId = useId();

  return (
    <details
      className={`command-deck-collapsible dash-v2-details dash-v2-details--quiet ${className}`.trim()}
      data-testid={testId}
      open={defaultOpen || undefined}
    >
      <summary
        className="command-deck-collapsible__summary dash-v2-details__summary"
        aria-controls={bodyId}
      >
        {summary}
      </summary>
      <div
        id={bodyId}
        className="command-deck-collapsible__body dash-v2-details__body"
      >
        {children}
      </div>
    </details>
  );
}
