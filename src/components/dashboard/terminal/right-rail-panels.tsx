import { EmptyState, ErrorState, Panel } from "@/components/terminal";
import { sparklinePath } from "@/components/terminal/sparkline";
import { GAP, fmtNum, fmtPct, fmtPctSigned, priceToneClass, priceToneVar } from "@/lib/format/vn";
import type {
  F1FunnelRow,
  F1IndexPanel,
  F1PlanRow,
  F1WatchRow,
} from "@/lib/dashboard/terminal/f1-view-model";

const CHART_W = 300;
const CHART_H = 78;

/** VNINDEX 30 phiên — đường giá + vùng tô nhạt, không lưới, không nhãn thừa. */
export function IndexPanel({ index }: { index: F1IndexPanel }) {
  const line = sparklinePath(index.points, CHART_W, CHART_H);
  const tone = priceToneVar(index.changePct);

  return (
    <Panel
      title="VNINDEX · 30 PHIÊN"
      tone="floor"
      body="pad"
      style={{ flex: "none" }}
    >
      {index.error ? (
        <ErrorState
          title="Không đọc được lịch sử VNINDEX"
          note="Biểu đồ chỉ số và biến động phiên không hiển thị được cho tới khi truy vấn chạy lại."
                    evidence={index.error}
        />
      ) : index.points.length < 2 ? (
        <EmptyState
          icon="◴"
          tone="var(--tm-floor)"
          title="Chưa đủ bar VNINDEX"
          note={`Cần tối thiểu 2 phiên để vẽ đường, hiện có ${fmtNum(index.points.length, 0)}.`}
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              CHẠY `npm run data:vnindex`
            </span>
          }
        />
      ) : (
        <>
          <div className="f1-index__lead">
            <span className="f1-index__px">{fmtNum(index.latestClose, 2)}</span>
            <span
              className={`tm-mono ${priceToneClass(index.changePct)}`}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {fmtPctSigned(index.changePct)}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            width="100%"
            height={CHART_H}
            fill="none"
            style={{ display: "block" }}
            role="img"
            aria-label={`VNINDEX ${fmtNum(index.points.length, 0)} phiên gần nhất`}
          >
            <path d={`${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z`} fill={tone} fillOpacity="0.09" />
            <path d={line} stroke={tone} strokeWidth="1.6" />
          </svg>
          <div className="f1-index__axis">
            <span>{index.firstLabel}</span>
            <span>{index.lastLabel}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Phễu bộ quét — vũ trụ → lọc → khả năng giao dịch → suýt đạt → đạt Cổng 2. */
export function FunnelPanel({ rows }: { rows: F1FunnelRow[] }) {
  return (
    <Panel title="PHỄU BỘ QUÉT" tone="ceil" body="pad" style={{ flex: "none" }}>
      {rows.map((row) => (
        <div key={row.key} className="f1-funnel__row">
          <div className="f1-funnel__head">
            <span className="f1-funnel__k">{row.key}</span>
            <span className="f1-funnel__v" style={{ color: row.color }}>
              {fmtNum(row.value, 0)}
            </span>
            <span className="f1-funnel__pct">
              {row.pctOfUniverse == null ? GAP : fmtPct(row.pctOfUniverse, 1)}
            </span>
          </div>
          <div className="f1-funnel__bar">
            <span style={{ width: `${row.barWidth}%`, background: row.color }} />
          </div>
        </div>
      ))}
    </Panel>
  );
}

/** Kế hoạch phiên mai — mã theo dõi, điều kiện kích hoạt, thứ cần tránh. */
export function PlanPanel({ rows }: { rows: F1PlanRow[] }) {
  return (
    <Panel title="KẾ HOẠCH PHIÊN MAI" tone="up" body="none" style={{ flex: "none" }}>
      <div>
        {rows.map((row) => (
          <div key={`${row.n}-${row.title}`} className="f1-plan__row">
            <span className="f1-plan__n">{row.n}</span>
            <div style={{ minWidth: 0 }}>
              <div className="f1-plan__title">{row.title}</div>
              <div className="f1-plan__note">{row.note}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Danh mục theo dõi — mã đang ở trạng thái MỚI / THEO DÕI / SẴN SÀNG. */
export function WatchlistPanel({
  rows,
  truncated,
}: {
  rows: F1WatchRow[];
  truncated: boolean;
}) {
  return (
    <Panel
      title="DANH MỤC THEO DÕI"
      tone="floor"
      trailing={
        <span className="tm-mono" style={{ fontSize: 9, color: "var(--tm-text-dim)" }}>
          {truncated ? `${fmtNum(rows.length, 0)}+` : fmtNum(rows.length, 0)}
        </span>
      }
      body={rows.length > 0 ? "none" : "pad"}
      style={{ flex: "none" }}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="▤"
          tone="var(--tm-floor)"
          title="Danh mục theo dõi trống"
          note="Chưa có mã nào ở trạng thái MỚI / THEO DÕI / SẴN SÀNG từ bộ quét."
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              MÃ ĐƯỢC THÊM SAU MỖI LẦN QUÉT
            </span>
          }
        />
      ) : (
        <table className="tm-table tm-table--sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td className="tm-t-sym" style={{ fontSize: 11, fontWeight: 600, color: "var(--tm-text-strong)" }}>
                  {row.symbol}
                </td>
                <td>
                  <span
                    className="tm-mono"
                    style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".04em", color: row.stateColor }}
                  >
                    {row.state}
                  </span>
                </td>
                <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                  {fmtNum(row.close, 2)}
                </td>
                <td className={`tm-t-num ${priceToneClass(row.changePct)}`} style={{ fontSize: 11 }}>
                  {fmtPctSigned(row.changePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
