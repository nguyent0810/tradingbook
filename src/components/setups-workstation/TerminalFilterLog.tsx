"use client";

import { useCallback, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          Liquidity &amp; session filters
        </span>
        <span className="font-mono text-xs text-slate-500">{open ? "▾" : "▸"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${panelId}-body`}
            role="region"
            aria-labelledby={`${panelId}-trigger`}
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="space-y-1 border-t border-slate-800/60 px-4 py-3">
              {entries.map(([reason, count]) => (
                <li
                  key={reason}
                  className="sw-terminal-line flex items-center gap-2 text-xs text-slate-400"
                >
                  <StatusPill active={count > 0} />
                  <span className={count > 0 ? "font-semibold text-emerald-300" : "text-slate-600"}>
                    {count}×
                  </span>
                  <span>{displayTradabilityBreakdownKey(reason)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
