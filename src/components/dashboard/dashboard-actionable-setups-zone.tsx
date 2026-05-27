import Link from "next/link";
import { DashboardBestSetupsPanel } from "@/components/dashboard/dashboard-best-setups-panel";
import type { BestSetupsPanelPresentation } from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";

export type DashboardActionableSetupsZoneProps = {
  topSetups: SurfacedCandidateHealthView[];
  bestSetupsPresentation: BestSetupsPanelPresentation;
};

export function DashboardActionableSetupsZone({
  topSetups,
  bestSetupsPresentation,
}: DashboardActionableSetupsZoneProps) {
  return (
    <section
      className="dash-v2-zone dash-v2-zone--actionable"
      data-testid="dashboard-actionable-setups-zone"
      aria-labelledby="dashboard-actionable-heading"
    >
      <header className="dash-v2-zone-header dash-v2-zone-header--row">
        <div>
          <p className="dash-v2-eyebrow dash-v2-eyebrow--accent">Actionable now</p>
          <h2 id="dashboard-actionable-heading" className="dash-v2-zone-title">
            Best setups
          </h2>
          <p className="dash-v2-zone-lead">
            Tier A/B validated breakout-pullback — log when your playbook criteria match.
          </p>
        </div>
        <div className="dash-v2-zone-header__actions">
          <span className="dash-v2-tag dash-v2-tag--actionable">Operational</span>
          <Link href="/trades/new" className="btn btn-primary btn-sm dash-v2-btn-primary">
            Log trade
          </Link>
        </div>
      </header>
      <div className="dash-v2-zone__body">
        <DashboardBestSetupsPanel
          topSetups={topSetups}
          presentation={bestSetupsPresentation}
          embedded
        />
      </div>
    </section>
  );
}
