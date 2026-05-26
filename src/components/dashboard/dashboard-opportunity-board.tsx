import type { OpportunityBoardDto, RiskBudgetHeadroomDto, RiskGuardrailDto, SetupQualityLadderDto, VerdictDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardOpportunityPreview } from "@/components/dashboard/dashboard-opportunity-preview";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";

export type DashboardOpportunityBoardProps = {
  opportunity: OpportunityBoardDto;
  ladder: SetupQualityLadderDto;
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  portfolioRiskConfigured: boolean;
};

export function DashboardOpportunityBoard({
  opportunity,
  ladder,
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
}: DashboardOpportunityBoardProps) {
  return (
    <section className="dash-opportunity-board dash-panel dash-surface-1" data-testid="dashboard-cockpit-zone-opportunity">
      <div className="dash-opportunity-board__grid">
        <div className="card--hero">
          <DashboardOpportunityPreview opportunity={opportunity} />
        </div>
        <div className="dash-opportunity-board__side card--compact">
          <DashboardSetupQualityLadder ladder={ladder} />
          <DashboardExposurePanel
            risk={risk}
            verdict={verdict}
            riskBudgetHeadroom={riskBudgetHeadroom}
            portfolioRiskConfigured={portfolioRiskConfigured}
          />
        </div>
      </div>
    </section>
  );
}

