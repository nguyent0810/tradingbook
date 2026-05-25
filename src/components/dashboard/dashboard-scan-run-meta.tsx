import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardScanRunMetaProps = {
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

function formatRunAt(d: Date): string {
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function DashboardScanRunMeta({
  latestScan,
  delayedBackdrop,
}: DashboardScanRunMetaProps) {
  if (!latestScan) {
    return (
      <div className="dashboard-scan-meta" data-testid="dashboard-scan-meta-empty">
        <p className="dashboard-scan-meta__label">Latest scan</p>
        <p className="dashboard-scan-meta__value">No completed scan in database.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-scan-meta" data-testid="dashboard-scan-meta">
      <div className="dashboard-scan-meta__grid">
        <div>
          <p className="dashboard-scan-meta__label">Latest scan</p>
          <p className="dashboard-scan-meta__value">{formatRunAt(latestScan.runAt)}</p>
          <p className="dashboard-scan-meta__hint mono text-[11px]">{latestScan.id}</p>
        </div>
        <div>
          <p className="dashboard-scan-meta__label">Universe</p>
          <p className="dashboard-scan-meta__value">
            {latestScan.symbolCountScanned} / {latestScan.symbolCountTotal} scanned
          </p>
        </div>
        <div>
          <p className="dashboard-scan-meta__label">Surfaced</p>
          <p className="dashboard-scan-meta__value">
            {latestScan.candidateCountSurfaced} candidates (A{" "}
            {latestScan.candidateCountA} · B {latestScan.candidateCountB})
          </p>
        </div>
        <div>
          <p className="dashboard-scan-meta__label">Gate 1</p>
          <p className="dashboard-scan-meta__value">
            {displayGate1ScanLevel(latestScan.gate1Level)}
            {delayedBackdrop === true
              ? " · delayed backdrop"
              : delayedBackdrop === false
                ? " · backdrop OK"
                : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
