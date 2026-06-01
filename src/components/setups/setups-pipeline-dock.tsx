"use client";

import { memo, useCallback, useId, useMemo, useState } from "react";
import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { SetupsStanceCompact } from "@/components/setups/setups-stance-compact";
import { SetupsFunnelCompact } from "@/components/setups/setups-funnel-compact";
import { SetupsDiagnosticsStack } from "@/components/setups/setups-diagnostics-stack";
import { V3Dock } from "@/components/trading-os-v3/layout";

export type SetupsPipelineDockProps = {
  tradingDecision: DailyTradingDecision | null;
  latestScan: LatestScanWithCandidates;
  nearMissCount: number;
  rejectionBuckets: Array<[string, number]>;
  scanNotes: DailyScanGate2Notes | null;
};

type TabId = "stance" | "funnel" | "diagnostics";

export function SetupsPipelineDock({
  tradingDecision,
  latestScan,
  nearMissCount,
  rejectionBuckets,
  scanNotes,
}: SetupsPipelineDockProps) {
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

  return (
    <V3Dock testId="setups-sidebar" aria-label="Pipeline intelligence dock">
      <V3Dock.Tabs aria-label="Pipeline intelligence">
        {tabs.map((t) => (
          <DockTabButton
            key={t.id}
            panelId={panelId}
            tab={t}
            active={tab === t.id}
            onSelect={handleTabChange}
          />
        ))}
      </V3Dock.Tabs>
      <V3Dock.Body>
        {tab === "stance" ? (
          <V3Dock.Panel
            role="tabpanel"
            id={`${panelId}-panel-stance`}
            aria-labelledby={`${panelId}-tab-stance`}
          >
            {tradingDecision ? (
              <SetupsStanceCompact decision={tradingDecision} />
            ) : (
              <p className="tosv3-empty-state">No trading stance for this scan.</p>
            )}
          </V3Dock.Panel>
        ) : null}
        {tab === "funnel" ? (
          <V3Dock.Panel
            role="tabpanel"
            id={`${panelId}-panel-funnel`}
            aria-labelledby={`${panelId}-tab-funnel`}
          >
            <SetupsFunnelCompact latestScan={latestScan} nearMissCount={nearMissCount} />
          </V3Dock.Panel>
        ) : null}
        {tab === "diagnostics" ? (
          <V3Dock.Panel
            role="tabpanel"
            id={`${panelId}-panel-diagnostics`}
            aria-labelledby={`${panelId}-tab-diagnostics`}
            className="tosv3-layout-dock__panel--scroll tosv3-setups-dock__panel--scroll"
          >
            <SetupsDiagnosticsStack
              rejectionBuckets={rejectionBuckets}
              scanNotes={scanNotes}
              latestScan={latestScan}
              title="Rejection diagnostics"
              subtitle="Why setups fell short"
              embedded
            />
          </V3Dock.Panel>
        ) : null}
      </V3Dock.Body>
    </V3Dock>
  );
}

const DockTabButton = memo(function DockTabButton({
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
      className={`tosv3-layout-dock__tab tosv3-setups-dock__tab${active ? " is-active" : ""}`}
      onClick={handleClick}
    >
      {tab.label}
    </button>
  );
});
