"use client";

import { useId, useState } from "react";
import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { SetupsStanceCompact } from "@/components/setups/setups-stance-compact";
import { SetupsFunnelCompact } from "@/components/setups/setups-funnel-compact";
import { SetupsDiagnosticsStack } from "@/components/setups/setups-diagnostics-stack";

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

  const tabs: { id: TabId; label: string }[] = [
    { id: "stance", label: "Stance" },
    { id: "funnel", label: "Pipeline" },
    { id: "diagnostics", label: "Diagnostics" },
  ];

  return (
    <aside className="tosv3-setups-dock tosv3-glass-panel" data-testid="setups-sidebar">
      <div className="tosv3-setups-dock__tabs" role="tablist" aria-label="Pipeline intelligence">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${panelId}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${panelId}-panel-${t.id}`}
            className={`tosv3-setups-dock__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tosv3-setups-dock__body">
        {tab === "stance" ? (
          <div
            role="tabpanel"
            id={`${panelId}-panel-stance`}
            aria-labelledby={`${panelId}-tab-stance`}
            className="tosv3-setups-dock__panel"
          >
            {tradingDecision ? (
              <SetupsStanceCompact decision={tradingDecision} />
            ) : (
              <p className="tosv3-empty-state">No trading stance for this scan.</p>
            )}
          </div>
        ) : null}
        {tab === "funnel" ? (
          <div
            role="tabpanel"
            id={`${panelId}-panel-funnel`}
            aria-labelledby={`${panelId}-tab-funnel`}
            className="tosv3-setups-dock__panel"
          >
            <SetupsFunnelCompact latestScan={latestScan} nearMissCount={nearMissCount} />
          </div>
        ) : null}
        {tab === "diagnostics" ? (
          <div
            role="tabpanel"
            id={`${panelId}-panel-diagnostics`}
            aria-labelledby={`${panelId}-tab-diagnostics`}
            className="tosv3-setups-dock__panel tosv3-setups-dock__panel--scroll"
          >
            <SetupsDiagnosticsStack
              rejectionBuckets={rejectionBuckets}
              scanNotes={scanNotes}
              latestScan={latestScan}
              title="Rejection diagnostics"
              subtitle="Why setups fell short"
              embedded
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
