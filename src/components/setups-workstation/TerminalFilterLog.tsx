"use client";

import { useCallback, useId, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { displayTradabilityBreakdownKey } from "@/lib/trading-display-labels";
import { StatusPill } from "./StatusPill";
import type { TerminalFilterLogProps } from "./types";
import "./setups-workstation.css";

export function TerminalFilterLog({ breakdown, defaultOpen = false }: TerminalFilterLogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reducedMotion = useReducedMotion() ?? false;
  const panelId = useId();
  const entries = Object.entries(breakdown);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  if (entries.length === 0) return null;

  return (
    <div className="sw-glass-panel overflow-hidden" data-testid="setups-terminal-filter-log">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={`${panelId}-body`}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.02]"
        onClick={toggle}
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
          Bộ lọc thanh khoản &amp; phiên
        </span>
        <span className="font-mono text-xs text-[var(--text-tertiary)]">{open ? "▾" : "▸"}</span>
      </button>

      {/* CSS grid-rows accordion instead of animating `height` — avoids a layout
          reflow every frame (grid-template-rows is the standard technique for an
          unknown-height reveal; framer-motion's `height: "auto"` would still be
          a layout-property animation under the hood). */}
      <div
        id={`${panelId}-body`}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className={`grid overflow-hidden ${reducedMotion ? "" : "transition-[grid-template-rows] duration-200 ease-in-out"}`}
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <ul className="min-h-0 space-y-1 border-t border-[var(--border-primary)]/60 px-4 py-3">
          {entries.map(([reason, count]) => (
            <li
              key={reason}
              className="sw-terminal-line flex items-center gap-2 text-xs text-[var(--text-tertiary)]"
            >
              <StatusPill active={count > 0} />
              <span className={count > 0 ? "font-semibold text-[var(--success)]" : "text-[var(--text-muted)]"}>
                {count}×
              </span>
              <span>{displayTradabilityBreakdownKey(reason)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
