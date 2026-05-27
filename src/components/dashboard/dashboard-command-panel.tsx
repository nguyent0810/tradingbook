import type { ReactNode } from "react";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  ActionableBlockerDto,
  EvidenceChipDto,
  TomorrowPlanDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";
import { DashboardTomorrowPlan } from "@/components/dashboard/dashboard-tomorrow-plan";
import { DashboardEvidenceCompact } from "@/components/dashboard/dashboard-evidence-compact";

export type DashboardCommandPanelProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  verdict: VerdictDto;
  surfacedCount: number;
  tomorrow: TomorrowPlanDto;
  evidence: EvidenceChipDto[];
  blockers: ActionableBlockerDto[];
  heroAside?: ReactNode;
};

export function DashboardCommandPanel({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  verdict,
  surfacedCount,
  tomorrow,
  evidence,
  blockers,
  heroAside,
}: DashboardCommandPanelProps) {
  return (
    <section
      className="dash-v2-command"
      data-testid="dashboard-cockpit-zone-decision"
      aria-labelledby="dash-v2-command-heading"
    >
      <h2 id="dash-v2-command-heading" className="dash-sr-only">
        Command center hero
      </h2>

      <div
        className="dash-v2-command__status"
        data-testid="dashboard-cockpit-zone-status"
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={scanDelayedBackdrop} />
      </div>

      <div className="dash-v2-command__hero">
        <div className="dash-v2-command__stance">
          <DashboardDecisionHero verdict={verdict} surfacedCount={surfacedCount} compact />
          <div className="dash-v2-card dash-v2-card--inset">
            <DashboardTomorrowPlan tomorrow={tomorrow} promoted />
          </div>
        </div>
        {heroAside ? (
          <aside className="dash-v2-rail" data-testid="dashboard-hero-aside">
            {heroAside}
          </aside>
        ) : null}
      </div>

      <div className="dash-v2-proof-foot">
        <DashboardEvidenceCompact chips={evidence} blockers={blockers} />
      </div>
    </section>
  );
}
