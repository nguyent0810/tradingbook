import type { Trade } from "@/generated/prisma/client";
import type {
  RiskBudgetHeadroomDto,
  RiskGuardrailDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";
import { DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel";

export type DashboardHeroAsideProps = {
  risk: RiskGuardrailDto;
  verdict: VerdictDto;
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  portfolioRiskConfigured: boolean;
  trades: Trade[];
};

export function DashboardHeroAside({
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
  trades,
}: DashboardHeroAsideProps) {
  return (
    <>
      <p className="dash-v2-rail__label">Book &amp; exposure</p>
      <div className="dash-v2-card dash-v2-card--rail">
        <DashboardExposurePanel
          risk={risk}
          verdict={verdict}
          riskBudgetHeadroom={riskBudgetHeadroom}
          portfolioRiskConfigured={portfolioRiskConfigured}
        />
      </div>
      <div className="dash-v2-card dash-v2-card--rail dash-v2-card--muted">
        <DashboardPerformancePanel trades={trades} />
      </div>
    </>
  );
}
