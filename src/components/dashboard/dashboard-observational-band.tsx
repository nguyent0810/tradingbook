import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { DashboardNearMissRejectionsPanel } from "@/components/dashboard/dashboard-near-miss-rejections-panel";
import { DashboardDataIntegrityNotes } from "@/components/dashboard/dashboard-data-integrity-notes";
import type { OpportunityBoardDto } from "@/lib/dashboard/decision-cockpit-dto";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";

export type DashboardObservationalBandProps = {
  opportunity: OpportunityBoardDto;
  freshness: MarketFreshnessDto;
  scanRunId: string | null;
};

/**
 * Near-miss + momentum + integrity — explicitly observational (not Tier A/B actionable).
 */
export function DashboardObservationalBand({
  opportunity,
  freshness,
  scanRunId,
}: DashboardObservationalBandProps) {
  return (
    <section
      className="dash-cockpit-v11__observational"
      aria-labelledby="dashboard-observational-heading"
      data-testid="dashboard-observational-band"
    >
      <header className="dash-cockpit-v11__observational-header">
        <div>
          <p className="dash-eyebrow">Observational only</p>
          <h2 id="dashboard-observational-heading" className="dash-section-title">
            Near-miss &amp; momentum
          </h2>
          <p className="dash-panel__subtitle">
            Scanner context and fresh-breakout audit — not validated Best Setups (Gate2
            breakout-pullback).
          </p>
        </div>
        <span className="dash-chip dash-chip--observational">Not actionable</span>
      </header>

      <div className="dash-cockpit-v11__observational-grid">
        <DashboardNearMissRejectionsPanel opportunity={opportunity} />
        <div className="dash-cockpit-v11__momentum-slot">
          <MomentumWatchSection />
        </div>
      </div>

      <div className="dash-cockpit-v11__integrity-slot">
        <DashboardDataIntegrityNotes freshness={freshness} scanRunId={scanRunId} />
      </div>
    </section>
  );
}
