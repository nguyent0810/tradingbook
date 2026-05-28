import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  ActionableBlockerDto,
  EvidenceChipDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";
import { DashboardEvidenceCompact } from "@/components/dashboard/dashboard-evidence-compact";

export type DashboardCommandPanelProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  verdict: VerdictDto;
  surfacedCount: number;
  evidence: EvidenceChipDto[];
  blockers: ActionableBlockerDto[];
};

export function DashboardCommandPanel({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  verdict,
  surfacedCount,
  evidence,
  blockers,
}: DashboardCommandPanelProps) {
  return (
    <section
      className="dash-v2-command command-deck-panel"
      data-testid="dashboard-cockpit-zone-decision"
      aria-labelledby="dash-v2-command-heading"
    >
      <h2 id="dash-v2-command-heading" className="dash-sr-only">
        Command center
      </h2>

      <div
        className="dash-v2-command__status"
        data-testid="dashboard-cockpit-zone-status"
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip
          latestScan={latestScan}
          delayedBackdrop={scanDelayedBackdrop}
        />
      </div>

      <div className="command-deck-panel__verdict">
        <DashboardDecisionHero verdict={verdict} surfacedCount={surfacedCount} />
      </div>

      <div className="dash-v2-proof-foot">
        <DashboardEvidenceCompact chips={evidence} blockers={blockers} />
      </div>
    </section>
  );
}
