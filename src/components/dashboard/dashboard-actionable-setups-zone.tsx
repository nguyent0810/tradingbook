import { DashboardBestSetupsPanel } from "@/components/dashboard/dashboard-best-setups-panel";
import type { BestSetupsPanelPresentation } from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";

export type DashboardActionableSetupsZoneProps = {
  topSetups: SurfacedCandidateHealthView[];
  bestSetupsPresentation: BestSetupsPanelPresentation;
};

/** Command Center v1.1 — Row C: Tier A/B actionable setups only. */
export function DashboardActionableSetupsZone({
  topSetups,
  bestSetupsPresentation,
}: DashboardActionableSetupsZoneProps) {
  return (
    <div
      className="dash-cockpit-v11__setups-zone"
      data-testid="dashboard-actionable-setups-zone"
    >
      <header className="dash-cockpit-v11__zone-header dash-cockpit-v11__zone-header--inline">
        <div>
          <p className="dash-eyebrow">Actionable</p>
          <p className="dash-panel__subtitle">
            Tier A/B validated breakout-pullback — log trade when criteria match your playbook.
          </p>
        </div>
        <span className="dash-chip dash-chip--actionable">Best setups</span>
      </header>
      <DashboardBestSetupsPanel
        topSetups={topSetups}
        presentation={bestSetupsPresentation}
      />
    </div>
  );
}
