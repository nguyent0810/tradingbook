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

export function DashboardObservationalBand({
  opportunity,
  freshness,
  scanRunId,
}: DashboardObservationalBandProps) {
  return (
    <section
      className="dash-v2-zone dash-v2-zone--observational"
      aria-labelledby="dashboard-observational-heading"
      data-testid="dashboard-observational-band"
    >
      <header className="dash-v2-zone-header dash-v2-zone-header--row">
        <div>
          <p className="dash-v2-eyebrow">Observational only</p>
          <h2 id="dashboard-observational-heading" className="dash-v2-zone-title">
            Near-miss &amp; momentum
          </h2>
          <p className="dash-v2-zone-lead">
            Scanner context and fresh-breakout audit — not validated Best Setups.
          </p>
        </div>
        <span className="dash-v2-tag dash-v2-tag--observational">Watch, don&apos;t act</span>
      </header>

      <div className="dash-v2-observational-grid">
        <DashboardNearMissRejectionsPanel opportunity={opportunity} />
        <div className="dash-v2-card dash-v2-card--inset dash-v2-momentum-slot">
          <MomentumWatchSection />
        </div>
      </div>

      <details className="dash-v2-details dash-v2-details--quiet">
        <summary className="dash-v2-details__summary">Data integrity notes</summary>
        <div className="dash-v2-details__body">
          <DashboardDataIntegrityNotes freshness={freshness} scanRunId={scanRunId} />
        </div>
      </details>
    </section>
  );
}
