"use client";

import { memo, useCallback, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SetupsStanceCompact } from "@/components/setups/setups-stance-compact";
import { SetupsFunnelCompact } from "@/components/setups/setups-funnel-compact";
import { SetupsDiagnosticsStack } from "@/components/setups/setups-diagnostics-stack";
import type { IntelligenceSidebarProps } from "./types";
import "./setups-workstation.css";

type TabId = "stance" | "funnel" | "diagnostics";

export function IntelligenceSidebar({
  tradingDecision,
  latestScan,
  nearMissCount,
  rejectionBuckets,
  scanNotes,
}: IntelligenceSidebarProps) {
  const defaultTab: TabId = tradingDecision ? "stance" : "funnel";
  const [tab, setTab] = useState<TabId>(defaultTab);
  const panelId = useId();

  const tabs: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: "stance", label: "Stance" },
      { id: "funnel", label: "Pipeline" },
      { id: "diagnostics", label: "Diagnostics" },
    ],
    []
  );

  const handleTabChange = useCallback((nextTab: TabId) => setTab(nextTab), []);

  const isNoTrade = tradingDecision?.level === "NO_TRADE";

  return (
    <aside
      className="sw-glass-panel flex h-full flex-col overflow-hidden"
      data-testid="setups-sidebar"
      aria-label="Pipeline intelligence dock"
    >
      <div
        className="relative flex border-b border-slate-800/60"
        role="tablist"
        aria-label="Pipeline intelligence"
      >
        {tabs.map((t) => (
          <SidebarTabButton
            key={t.id}
            panelId={panelId}
            tab={t}
            active={tab === t.id}
            onSelect={handleTabChange}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {tab === "stance" ? (
            <motion.div
              key="stance"
              role="tabpanel"
              id={`${panelId}-panel-stance`}
              aria-labelledby={`${panelId}-tab-stance`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {tradingDecision ? (
                <div className={isNoTrade ? "sw-stance-pulse rounded-lg" : undefined}>
                  <SetupsStanceCompact decision={tradingDecision} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">No trading stance for this scan.</p>
              )}
            </motion.div>
          ) : null}

          {tab === "funnel" ? (
            <motion.div
              key="funnel"
              role="tabpanel"
              id={`${panelId}-panel-funnel`}
              aria-labelledby={`${panelId}-tab-funnel`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <SetupsFunnelCompact latestScan={latestScan} nearMissCount={nearMissCount} />
            </motion.div>
          ) : null}

          {tab === "diagnostics" ? (
            <motion.div
              key="diagnostics"
              role="tabpanel"
              id={`${panelId}-panel-diagnostics`}
              aria-labelledby={`${panelId}-tab-diagnostics`}
              className="max-h-[min(60vh,480px)] overflow-y-auto"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <SetupsDiagnosticsStack
                rejectionBuckets={rejectionBuckets}
                scanNotes={scanNotes}
                latestScan={latestScan}
                title="Rejection diagnostics"
                subtitle="Why setups fell short"
                embedded
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </aside>
  );
}

const SidebarTabButton = memo(function SidebarTabButton({
  panelId,
  tab,
  active,
  onSelect,
}: {
  panelId: string;
  tab: { id: TabId; label: string };
  active: boolean;
  onSelect: (tab: TabId) => void;
}) {
  const handleClick = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);

  return (
    <button
      type="button"
      role="tab"
      id={`${panelId}-tab-${tab.id}`}
      aria-selected={active}
      aria-controls={`${panelId}-panel-${tab.id}`}
      className="relative flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wide text-slate-500 transition hover:text-slate-300"
      onClick={handleClick}
    >
      {active ? (
        <motion.span
          layoutId="setups-tab-pill"
          className="absolute inset-x-1 inset-y-1 rounded-md bg-indigo-500/10 ring-1 ring-indigo-500/30"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      ) : null}
      <span className={`relative z-10 ${active ? "text-indigo-300" : ""}`}>{tab.label}</span>
    </button>
  );
});
