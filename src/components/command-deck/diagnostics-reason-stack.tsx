import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import {
  rejectionBucketLabel,
  rejectionBucketTraderGuide,
} from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type DiagnosticsReasonStackProps = {
  rejectionBuckets: Array<[string, number]>;
  scanNotes: DailyScanGate2Notes | null;
  latestScan: LatestScanWithCandidates | null;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  testIdPanel?: string;
  testIdEmpty?: string;
  testIdStack?: string;
  embedded?: boolean;
};

export function DiagnosticsReasonStack({
  rejectionBuckets,
  scanNotes,
  latestScan,
  title = "Chẩn đoán từ chối",
  subtitle = "Gate 2 — lý do thiết lập chưa đạt",
  emptyTitle = "Không có chẩn đoán từ chối",
  testIdPanel = "setups-diagnostics-panel",
  testIdEmpty = "setups-diagnostics-empty",
  testIdStack = "setups-diagnostics-stack",
  embedded = false,
}: DiagnosticsReasonStackProps) {
  const body =
    rejectionBuckets.length === 0 ? (
      <div className="dash-empty-compact">
        <EmptyStateWithReason
          title={emptyTitle}
          reason={
            latestScan
              ? "Ghi chú lần quét gần nhất không có nhóm từ chối nào để tổng hợp, hoặc đủ điều kiện GD mà không có lỗi Gate 2."
              : "Chạy quét hàng ngày để có dữ liệu chẩn đoán từ chối."
          }
          data-testid={testIdEmpty}
        />
      </div>
    ) : (
      <ul className="dash-diagnostics-stack" data-testid={testIdStack}>
        {rejectionBuckets.map(([category, count]) => {
          const guide = rejectionBucketTraderGuide(category);
          const symbols = scanNotes?.rejectionSymbolsByCategory?.[category] ?? [];
          return (
            <li key={category} className="dash-diagnostics-stack__item">
              <div className="dash-diagnostics-stack__head">
                <span className="dash-diagnostics-stack__title">
                  {rejectionBucketLabel(category)}
                </span>
                <span className="dash-diagnostics-stack__count tabular-nums">{count}</span>
              </div>
              <p className="dash-diagnostics-stack__meaning">{guide.meaning}</p>
              <p className="dash-diagnostics-stack__wait">Wait for: {guide.waitFor}</p>
              {symbols.length > 0 ? (
                <p className="dash-diagnostics-stack__symbols">
                  Sample: {symbols.slice(0, 8).join(", ")}
                  {symbols.length > 8 ? ` +${symbols.length - 8} more` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );

  if (embedded) {
    return <div data-testid={testIdPanel}>{body}</div>;
  }

  return (
    <section className="pipeline-deck-panel dash-panel dash-surface-1" data-testid={testIdPanel}>
      <header className="dash-panel__header">
        <h2 className="dash-section-title">{title}</h2>
        <p className="dash-panel__subtitle">{subtitle}</p>
      </header>
      {body}
    </section>
  );
}
