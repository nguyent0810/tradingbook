import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardScanMetaStripProps = {
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

function formatRunAt(d: Date): string {
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

function scanIdChip(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

/** Compact scan metadata chips (Trading OS v2). */
export function DashboardScanMetaStrip({
  latestScan,
  delayedBackdrop,
}: DashboardScanMetaStripProps) {
  if (!latestScan) {
    return (
      <div
        className="dash-scan-strip dash-surface-1"
        data-testid="dashboard-scan-meta-empty"
      >
        <span className="dash-chip dash-chip--muted">No completed scan in database</span>
      </div>
    );
  }

  const backdropLabel =
    delayedBackdrop === true
      ? "Delayed backdrop"
      : delayedBackdrop === false
        ? "Backdrop OK"
        : "Backdrop —";

  return (
    <div className="dash-scan-strip dash-surface-1" data-testid="dashboard-scan-meta">
      <span className="dash-chip" title={latestScan.id}>
        Run {formatRunAt(latestScan.runAt)}
      </span>
      <span className="dash-chip mono" title={latestScan.id}>
        {scanIdChip(latestScan.id)}
      </span>
      <span className="dash-chip">
        {latestScan.symbolCountScanned}/{latestScan.symbolCountTotal} scanned
      </span>
      <span className="dash-chip">
        Surfaced {latestScan.candidateCountSurfaced} (A {latestScan.candidateCountA} · B{" "}
        {latestScan.candidateCountB})
      </span>
      <span className="dash-chip">{displayGate1ScanLevel(latestScan.gate1Level)}</span>
      <span
        className={`dash-chip${delayedBackdrop === true ? " dash-chip--warn" : delayedBackdrop === false ? " dash-chip--ok" : ""}`}
      >
        {backdropLabel}
      </span>
    </div>
  );
}
