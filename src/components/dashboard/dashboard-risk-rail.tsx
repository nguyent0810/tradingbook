import type {
  RiskBudgetHeadroomDto,
  RiskGuardrailDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";

export type DashboardRiskRailProps = {
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  portfolioRiskConfigured: boolean;
};

export function DashboardRiskRail({
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
}: DashboardRiskRailProps) {
  return (
    <aside
      className="command-deck-risk-rail"
      data-testid="dashboard-risk-rail"
      aria-labelledby="dashboard-risk-rail-heading"
    >
      <p id="dashboard-risk-rail-heading" className="dash-v2-rail__label">
        Risk guardrail
      </p>
      <div className="dash-v2-card dash-v2-card--rail command-deck-risk-rail__card">
        <DashboardExposurePanel
          risk={risk}
          verdict={verdict}
          riskBudgetHeadroom={riskBudgetHeadroom}
          portfolioRiskConfigured={portfolioRiskConfigured}
        />
      </div>
    </aside>
  );
}
