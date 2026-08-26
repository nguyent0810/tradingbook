import { EmptyState, Panel } from "@/components/terminal";
import { sparklinePath } from "@/components/terminal/sparkline";
import { GAP, fmtNum, fmtPctSigned, priceToneClass } from "@/lib/format/vn";
import type {
  F2Detail,
  F2FunnelCell,
  F2NearMissRow,
} from "@/lib/setups/terminal/f2-view-model";
import type { ScanLogRow } from "@/lib/setups/terminal/scan-log";

/** Dải phễu trên cùng — năm bước đường ống + mốc lần quét. */
export function FunnelStrip({
  cells,
  scanLabel,
}: {
  cells: F2FunnelCell[];
  scanLabel: string;
}) {
  return (
    <div className="f2__funnel" aria-label="Phễu bộ quét">
      {cells.map((cell) => (
        <div key={cell.key} className="f2-funnel__cell">
          <span className="f2-funnel__rule" style={{ background: cell.color }} />
          <div style={{ minWidth: 0 }}>
            <div className="f2-funnel__k">{cell.key}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                className="f2-funnel__v"
                style={{ color: cell.value == null ? "var(--tm-text-faint)" : cell.color }}
              >
                {fmtNum(cell.value, 0)}
              </span>
              <span className="f2-funnel__sub">{cell.sub}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="f2-funnel__meta">
        <div className="f2-funnel__k">LẦN QUÉT</div>
        <div className="f2-funnel__meta-v">{scanLabel}</div>
      </div>
    </div>
  );
}

/** Danh sách phụ trong cột trái — suýt đạt và RS dẫn dắt. */
export function SubList({
  title,
  rows,
  emptyReason,
}: {
  title: string;
  rows: F2NearMissRow[];
  emptyReason: string | null;
}) {
  return (
    <div className="f2-sublist">
      <div className="f2-sublist__k">
        {title} ({fmtNum(rows.length, 0)})
      </div>
      {rows.length === 0 ? (
        <p className="f2-sublist__note">
          {emptyReason ?? "Lần quét gần nhất không ghi mã nào vào nhóm này."}
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.symbol} className="f2-sublist__row">
            <span className="f2-sublist__sym">{row.symbol}</span>
            <span className="f2-sublist__status" style={{ color: row.statusColor }} title={row.status}>
              {row.status}
            </span>
            <span className="f2-sublist__rs" style={{ color: row.rsColor }}>
              {fmtPctSigned(row.rs20, 1)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const CHART_W = 420;
const CHART_H = 96;

/** Biểu đồ hồ sơ: đường giá + dải vùng mua + vạch cắt lỗ. */
function ProfileChart({ detail }: { detail: F2Detail }) {
  const closes = detail.closes;
  if (closes.length < 2) {
    return (
      <div
        className="tm-body"
        style={{ height: CHART_H, display: "flex", alignItems: "center", fontSize: 11 }}
      >
        Chưa đủ hai phiên giá đã lưu cho {detail.symbol} để vẽ đường — hiện có{" "}
        {fmtNum(closes.length, 0)}.
      </div>
    );
  }

  // Thang đo phải bao cả vùng mua và cắt lỗ, nếu không hai mốc đó rơi ngoài khung.
  const min = Math.min(...closes, detail.zoneLow, detail.stop);
  const max = Math.max(...closes, detail.zoneHigh);
  const range = max - min || 1;
  const y = (v: number) => CHART_H - ((v - min) / range) * (CHART_H - 4) - 2;

  const line = sparklinePath(closes, CHART_W, CHART_H);
  // Đường được vẽ trên thang riêng của sparklinePath; dựng lại theo thang chung
  // để vùng mua và cắt lỗ nằm đúng chỗ so với giá.
  const scaled = closes
    .map((v, i) => `${i ? "L" : "M"}${((i / (closes.length - 1)) * CHART_W).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const path = scaled || line;

  const zoneTop = y(detail.zoneHigh);
  const zoneHeight = Math.max(1, y(detail.zoneLow) - zoneTop);

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      width="100%"
      height={CHART_H}
      fill="none"
      style={{ display: "block", marginBottom: 9 }}
      role="img"
      aria-label={`${detail.symbol}: giá ${fmtNum(closes.length, 0)} phiên, vùng mua và cắt lỗ`}
    >
      <rect x="0" y={zoneTop} width={CHART_W} height={zoneHeight} fill="var(--tm-up)" fillOpacity="0.09" />
      <line
        x1="0"
        y1={y(detail.stop)}
        x2={CHART_W}
        y2={y(detail.stop)}
        stroke="var(--tm-down)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <path d={`${path} L${CHART_W},${CHART_H} L0,${CHART_H} Z`} fill="var(--tm-floor)" fillOpacity="0.07" />
      <path d={path} stroke="var(--tm-floor)" strokeWidth="1.7" />
    </svg>
  );
}

/** Hồ sơ thiết lập của mã đang chọn: biểu đồ + KPI + định cỡ vị thế. */
export function SetupProfile({
  detail,
  verdictNote,
  onLogTrade,
}: {
  detail: F2Detail;
  verdictNote: string | null;
  onLogTrade: () => void;
}) {
  return (
    <Panel
      title={`HỒ SƠ THIẾT LẬP · ${detail.symbol}`}
      tone="accent"
      trailing={
        <span className="tm-mono" style={{ fontSize: 9, color: "var(--tm-text-dim)" }}>
          CỔNG 2 · ĐIỂM {fmtNum(detail.rankScore, 1)}
        </span>
      }
      body="none"
      style={{ flex: "none" }}
    >
      <div className="f2-profile">
        <div className="f2-profile__main">
          <div className="f2-profile__lead">
            <span className="f2-profile__sym">{detail.symbol}</span>
            <span className="f2-profile__px">{fmtNum(detail.close, 2)}</span>
            <span
              className={`tm-mono ${priceToneClass(detail.changePct)}`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {fmtPctSigned(detail.changePct)}
            </span>
            <span className="tm-panel__spacer" />
            <span
              className="f2-profile__tier"
              style={
                detail.tier === "A"
                  ? { background: "var(--tm-up)", color: "var(--tm-bg-base)" }
                  : { background: "var(--tm-line-panel)", color: "var(--tm-text-mute)" }
              }
            >
              HẠNG {detail.tier}
            </span>
          </div>

          <ProfileChart detail={detail} />

          <div className="tm-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {detail.kpis.map((kpi) => (
              <div key={kpi.key} className="tm-kpi">
                <div className="tm-kpi__k">{kpi.key}</div>
                <div className="tm-kpi__v tm-kpi__v--sm" style={{ color: kpi.color }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="f2-profile__side">
          <div className="tm-eyebrow--dim" style={{ marginBottom: 8 }}>
            ĐỊNH CỠ VỊ THẾ ĐỀ XUẤT
          </div>

          {detail.sizingBlocked ? (
            <div className="tm-evidence">{detail.sizingBlocked}</div>
          ) : (
            detail.sizing.map((row) => (
              <div key={row.key} className="f2-sizing__row">
                <span className="f2-sizing__k">{row.key}</span>
                <span className="f2-sizing__v" style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))
          )}

          <div className="tm-btn-group" style={{ marginTop: 11 }}>
            <button
              type="button"
              className="tm-btn tm-btn--primary"
              style={{ flex: 1, ["--tm-btn-tone" as string]: "var(--tm-up)" }}
              onClick={onLogTrade}
              disabled={detail.sizingBlocked != null}
            >
              GHI VÀO SỔ LỆNH
            </button>
          </div>

          {verdictNote ? (
            <div className="tm-note" style={{ marginTop: 9 }}>
              {verdictNote}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/** Tiêu chí Cổng 2 của mã đang chọn. */
export function Gate2Criteria({ rows }: { rows: F2Detail["gate2"] }) {
  return (
    <Panel title="TIÊU CHÍ CỔNG 2" tone="up" body="none" style={{ flex: "none" }}>
      {rows.length === 0 ? (
        <EmptyState
          icon="∅"
          tone="var(--tm-accent)"
          title="Lần quét không lưu dòng lý do nào"
          note="Ứng viên này đạt Cổng 2 nhưng bản ghi không kèm chi tiết tiêu chí — chạy lại bộ quét để sinh lại chẩn đoán."
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              CHẠY `npm run gate1:check`
            </span>
          }
        />
      ) : (
        <div className="f2-gate2">
          {rows.map((row, i) => (
            <div key={`${row.mark}-${i}-${row.label}`} className="f2-gate2__row">
              <span className="f2-gate2__mark" style={{ color: row.color }}>
                {row.mark}
              </span>
              <span className="f2-gate2__label">{row.label}</span>
              <span className="f2-gate2__value" style={{ color: row.color }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Nhật ký bộ quét — dựng lại từ dữ liệu lần quét đã lưu. */
export function ScanLogPanel({ rows }: { rows: ScanLogRow[] }) {
  return (
    <Panel
      className="f2__log"
      title="NHẬT KÝ BỘ QUÉT"
      tone="floor"
      meta="· dựng từ dữ liệu lần quét"
      body="none"
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="◴"
          tone="var(--tm-floor)"
          title="Chưa có lần quét nào"
          note="Bộ quét hằng ngày chưa chạy lần nào nên không có gì để ghi lại."
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              LỊCH QUÉT 09:15 MỖI PHIÊN
            </span>
          }
        />
      ) : (
        <div className="f2-log">
          {rows.map((row, i) => (
            <div key={`${i}-${row.message}`} className="f2-log__row">
              <span className="f2-log__t">{row.time || GAP}</span>
              <span className="f2-log__m" data-tone={row.tone}>
                {row.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
