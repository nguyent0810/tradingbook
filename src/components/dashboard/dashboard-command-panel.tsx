import type { ReactNode } from "react";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { ActionableBlockerDto, EvidenceChipDto, TomorrowPlanDto, VerdictDto } from "@/lib/dashboard/decision-cockpit-dto";
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
  /** Right rail (5/12 layout): exposure + performance — Command Center v1.1 */
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
    <section className="dash-command-panel dash-panel dash-surface-1" data-testid="dashboard-cockpit-zone-decision">
      <div
        className="dash-command-panel__status dash-cockpit-v11__sticky-status card--strip"
        data-testid="dashboard-cockpit-zone-status"
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={scanDelayedBackdrop} />
      </div>

      <div className="dash-command-panel__hero dash-cockpit-v11__hero-rail">
        <div className="dash-command-panel__hero-main">
          <div className="card--hero">
            <DashboardDecisionHero verdict={verdict} surfacedCount={surfacedCount} compact />
          </div>
          <div className="card--hero">
            <DashboardTomorrowPlan tomorrow={tomorrow} promoted />
          </div>
        </div>
        {heroAside ? (
          <div className="dash-command-panel__hero-aside" data-testid="dashboard-hero-aside">
            {heroAside}
          </div>
        ) : null}
      </div>

      <div className="dash-command-panel__evidence card--compact">
        <DashboardEvidenceCompact chips={evidence} blockers={blockers} />
      </div>
    </section>
  );
}

