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
        <span className="dash-chip dash-chip--muted">Chưa có lần quét nào hoàn tất trong dữ liệu</span>
      </div>
    );
  }

  const backdropLabel =
    delayedBackdrop === true
      ? "Nền thị trường bị trễ"
      : delayedBackdrop === false
        ? "Nền thị trường ổn"
        : "Nền thị trường —";

  return (
    <div className="dash-scan-strip dash-surface-1" data-testid="dashboard-scan-meta">
      <span className="dash-chip" title={latestScan.id}>
        Chạy lúc {formatRunAt(latestScan.runAt)}
      </span>
      <span className="dash-chip mono" title={latestScan.id}>
        {scanIdChip(latestScan.id)}
      </span>
      <span className="dash-chip">
        {latestScan.symbolCountScanned}/{latestScan.symbolCountTotal} đã quét
      </span>
      <span className="dash-chip">
        Đủ điều kiện GD {latestScan.symbolCountAfterTradability}
      </span>
      <span className="dash-chip">
        Đã lọc ra {latestScan.candidateCountSurfaced} (A {latestScan.candidateCountA} · B{" "}
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
