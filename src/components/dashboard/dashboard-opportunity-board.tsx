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
      className="dash-v2-zone dash-v2-zone--context"
      data-testid="dashboard-cockpit-zone-opportunity"
      aria-labelledby="dashboard-opportunity-heading"
    >
      <header className="dash-v2-zone-header">
        <p className="dash-v2-eyebrow">Pipeline</p>
        <h2 id="dashboard-opportunity-heading" className="dash-v2-zone-title">
          Opportunity context
        </h2>
        <p className="dash-v2-zone-lead">
          Shortlist before actionable setups — exposure and performance sit in the command hero.
        </p>
      </header>
      <div className="dash-v2-zone__body dash-v2-split">
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
