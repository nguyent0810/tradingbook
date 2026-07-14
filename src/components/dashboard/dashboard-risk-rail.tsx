import type {
  ConfidenceBand,
  MarkToMarketExposureDto,
  PositionSizingPanelDto,
  RiskBudgetHeadroomDto,
  RiskGuardrailDto,
  RiskToStopBreakdownDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";
import { DashboardPositionSizingPanel } from "@/components/dashboard/dashboard-position-sizing-panel";

export type DashboardRiskRailProps = {
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  portfolioRiskConfigured: boolean;
  riskToStop: RiskToStopBreakdownDto;
  markToMarketExposure: MarkToMarketExposureDto;
  recommendedPositionSizing: PositionSizingPanelDto | null;
  confidenceBand: ConfidenceBand;
};

export function DashboardRiskRail({
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
  riskToStop,
  markToMarketExposure,
  recommendedPositionSizing,
  confidenceBand,
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
          riskToStop={riskToStop}
          markToMarketExposure={markToMarketExposure}
        />
      </div>
      <div className="dash-v2-card dash-v2-card--rail command-deck-risk-rail__card">
        <DashboardPositionSizingPanel
          recommendedPositionSizing={recommendedPositionSizing}
          portfolioRiskConfigured={portfolioRiskConfigured}
          confidenceBand={confidenceBand}
        />
      </div>
    </aside>
  );
}
