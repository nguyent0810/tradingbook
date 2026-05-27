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
      className="dash-opportunity-board dash-panel dash-surface-1"
      data-testid="dashboard-cockpit-zone-opportunity"
      aria-labelledby="dashboard-opportunity-heading"
    >
      <header className="dash-panel__header dash-cockpit-v11__zone-header">
        <div>
          <p className="dash-eyebrow">Pipeline context</p>
          <h2 id="dashboard-opportunity-heading" className="dash-section-title">
            Opportunity &amp; quality ladder
          </h2>
          <p className="dash-panel__subtitle">
            Shortlist context before Best Setups — exposure and book performance are in the
            command row above.
          </p>
        </div>
      </header>
      <div className="dash-opportunity-board__grid dash-opportunity-board__grid--v11">
        <div className="card--hero">
          <DashboardOpportunityPreview opportunity={opportunity} />
        </div>
        <div className="card--compact">
          <DashboardSetupQualityLadder ladder={ladder} />
        </div>
      </div>
    </section>
  );
}

