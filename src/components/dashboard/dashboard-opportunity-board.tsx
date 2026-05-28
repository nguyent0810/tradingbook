import type { OpportunityBoardDto, SetupQualityLadderDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardOpportunityPreview } from "@/components/dashboard/dashboard-opportunity-preview";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";

export type DashboardOpportunityBoardProps = {
  opportunity: OpportunityBoardDto;
  ladder: SetupQualityLadderDto;
};

export function DashboardOpportunityBoard({
  opportunity,
  ladder,
}: DashboardOpportunityBoardProps) {
  return (
    <section
      className="command-deck-opportunity dash-v2-zone dash-v2-zone--context"
      data-testid="dashboard-cockpit-zone-opportunity"
      aria-labelledby="dashboard-opportunity-heading"
    >
      <header className="dash-v2-zone-header">
        <p className="dash-v2-eyebrow">Opportunities</p>
        <h2 id="dashboard-opportunity-heading" className="dash-v2-zone-title">
          Opportunity board
        </h2>
        <p className="dash-v2-zone-lead">
          Tier actions, near-miss path, and setup quality — compare before you log risk.
        </p>
      </header>
      <div className="command-deck-opportunity__body dash-v2-zone__body">
        <div className="dash-v2-card dash-v2-card--inset">
          <DashboardOpportunityPreview opportunity={opportunity} />
        </div>
        <div className="dash-v2-card dash-v2-card--inset dash-v2-card--muted">
          <DashboardSetupQualityLadder ladder={ladder} />
        </div>
      </div>
    </section>
  );
}
