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

/** Command Center v1.1 — right rail: exposure + closed-trade performance. */
export function DashboardHeroAside({
  risk,
  verdict,
  riskBudgetHeadroom,
  portfolioRiskConfigured,
  trades,
}: DashboardHeroAsideProps) {
  return (
    <div className="dash-hero-aside">
      <DashboardExposurePanel
        risk={risk}
        verdict={verdict}
        riskBudgetHeadroom={riskBudgetHeadroom}
        portfolioRiskConfigured={portfolioRiskConfigured}
      />
      <DashboardPerformancePanel trades={trades} />
    </div>
  );
}
