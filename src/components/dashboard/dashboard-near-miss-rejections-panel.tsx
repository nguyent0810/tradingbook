import Link from "next/link";
import type {
  OpportunityBoardDto,
  OpportunityNearMissDto,
  SetupLadderStage,
} from "@/lib/dashboard/decision-cockpit-dto";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardNearMissRejectionsPanelProps = {
  opportunity: OpportunityBoardDto;
};

/** Near-miss cards have no quality tier — accent by ladder stage instead. */
const LADDER_ACCENT: Partial<Record<SetupLadderStage, string>> = {
  watch: "var(--cd-warning, var(--warning))",
  extended: "var(--cd-warning, var(--warning))",
  invalid: "var(--cd-text-dim, var(--text-tertiary))",
  avoid: "var(--cd-danger, var(--danger))",
};

function nearMissTraderNote(row: OpportunityNearMissDto): string | null {
  if (row.symbol === "VND" && row.terminalCategory === "pullback_zone_interaction") {
    return "Suýt đạt chuẩn — giá đang ở trên vùng pullback, chưa hành động được theo mẫu breakout-pullback hiện tại.";
  }
  if (row.symbol === "PDR" && row.terminalCategory === "breakout_recency") {
    return "Trượt Gate2 vì breakout chưa đủ mới; vẫn có thể xuất hiện trong Nhóm động lượng (chỉ mang tính quan sát, chưa phải thiết lập đã xác thực).";
  }
  return null;
}

function NearMissCard({ row }: { row: OpportunityNearMissDto }) {
  const note = nearMissTraderNote(row);
  const dist =
    row.distanceToZonePct != null
      ? `${row.distanceToZonePct.toFixed(1)}% from pullback zone`
      : null;

  return (
    <li
      className="dash-card dash-card--interactive dash-tile"
      data-testid={`dashboard-near-miss-${row.symbol}`}
      style={{ ["--dash-card-accent" as string]: LADDER_ACCENT[row.ladderStage] ?? "var(--border-primary)" }}
    >
      <div className="dash-tile__head">
        <span className="dash-tile__symbol font-mono">{row.symbol}</span>
        <span
          className="dash-chip dash-chip--muted text-xs"
          data-testid="dashboard-near-miss-diagnostic-status"
        >
          {row.executionStatusLabel}
        </span>
      </div>
      <div className="dash-tile__meta-row">
        <span className="dash-chip dash-chip--muted text-xs">
          {rejectionBucketLabel(row.terminalCategory)}
        </span>
        {dist ? <span className="dash-chip dash-chip--muted text-xs tabular-nums">{dist}</span> : null}
      </div>
      <p className="dash-tile__insight text-sm">{row.waitFor}</p>
      <div className="dash-tile__rs">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          detail="summary"
          testId={`dashboard-near-miss-rs-${row.symbol}`}
        />
      </div>
      {note ? (
        <details className="dash-tile__why">
          <summary className="dash-tile__why-toggle">Ghi chú</summary>
          <p className="dash-tile__why-line text-xs">{note}</p>
        </details>
      ) : null}
    </li>
  );
}

/** Near-miss / Gate2 rejection explainer (Command Center v1). */
export function DashboardNearMissRejectionsPanel({
  opportunity,
}: DashboardNearMissRejectionsPanelProps) {
  const rows = opportunity.nearMiss;

  return (
    <div className="dash-card dash-card--muted" data-testid="dashboard-near-miss-panel">
      <header className="dash-card__header">
        <h3 className="dash-card__title">Suýt đạt / bị loại</h3>
        <p className="dash-card__lead">
          Chỉ chẩn đoán Gate 2 — mã gần đạt chuẩn nhất, không phải tín hiệu giao dịch SetupCandidate.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="dash-v2-empty">
          <EmptyStateWithReason
            title="Không có xếp hạng suýt đạt trong lần quét gần nhất"
            reason={
              opportunity.emptyReason ??
              "Ghi chú bộ quét không có danh sách mã gần đạt chuẩn cho lần chạy này."
            }
            data-testid="dashboard-near-miss-empty"
          >
            <Link href="/setups" className="btn btn-secondary dash-v2-btn-secondary">
              Mở đường ống
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : (
        <>
          <ul className="dash-tile-grid">
            {rows.map((row) => (
              <NearMissCard key={row.symbol} row={row} />
            ))}
          </ul>
          <p className="dash-near-miss__footer text-xs">
            Toàn bộ nhóm lý do bị loại &amp; danh sách mã có tại{" "}
            <Link href="/setups" className="dash-v2-link">
              Thiết lập
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
