import Link from "next/link";
import { EmptyState, Panel, Sparkline } from "@/components/terminal";
import {
  GAP,
  fmtNum,
  fmtPct,
  fmtPctSigned,
  priceToneClass,
  priceToneVar,
  semanticTone,
} from "@/lib/format/vn";
import type {
  F3AgentRow,
  F3HofRow,
  F3HumanRow,
} from "@/lib/paper-lab/terminal/f3-view-model";

/**
 * Băng cảnh báo mô phỏng. Không phải trang trí: màn này không dùng vốn thật và
 * người đọc phải biết điều đó trước khi nhìn bất kỳ con số nào.
 */
export function SimulationBanner({
  agentCount,
  decisionCount,
  battleCount,
}: {
  agentCount: number | null;
  decisionCount: number | null;
  battleCount: number | null;
}) {
  return (
    <div className="f3__disclaimer" role="note">
      <span className="f3__disclaimer-tag">MÔ PHỎNG</span>
      <span className="f3__disclaimer-text">
        Không dùng vốn thật — mọi danh mục, lệnh và kết quả trên màn này đều là giả lập.
      </span>
      <span className="tm-panel__spacer" />
      <span className="f3__disclaimer-meta">
        {fmtNum(agentCount, 0)} TÁC TỬ · {fmtNum(battleCount, 0)} TRẬN ·{" "}
        {fmtNum(decisionCount, 0)} QUYẾT ĐỊNH
      </span>
    </div>
  );
}

/** Bảng xếp hạng tác tử. */
export function LeaderboardPanel({
  rows,
  emptyReason,
}: {
  rows: F3AgentRow[];
  emptyReason: string | null;
}) {
  return (
    <Panel
      className="f3__leaderboard"
      title="BẢNG XẾP HẠNG TÁC TỬ"
      tone="accent"
      meta={rows.length > 0 ? `· ${fmtNum(rows.length, 0)} TÁC TỬ` : undefined}
      body={rows.length > 0 ? "scroll" : "pad"}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="◇"
          tone="var(--tm-ceil)"
          title="Chưa có tác tử nào chạy"
          note={emptyReason ?? "Chưa có danh mục mô phỏng nào được khởi tạo."}
          action={
            <Link href="/paper-lab/ops" className="tm-btn tm-btn--sm">
              CẤU HÌNH TÁC TỬ
            </Link>
          }
        />
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>TÁC TỬ</th>
              <th>LỚP</th>
              <th className="tm-t-num">LỆNH</th>
              <th className="tm-t-num">TỶ LỆ THẮNG</th>
              <th className="tm-t-num" title="Chỉ số dạng Sharpe do hệ thống tính">
                SHARPE~
              </th>
              <th className="tm-t-num">LỢI NHUẬN</th>
              <th className="tm-t-num">SỤT GIẢM</th>
              <th className="tm-t-spark">ĐƯỜNG VỐN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agentId}>
                <td
                  className="tm-t-num"
                  style={{ textAlign: "left", fontSize: 11, color: "var(--tm-text-dim)" }}
                >
                  {String(row.rank).padStart(2, "0")}
                </td>
                <td style={{ fontWeight: 600, color: "var(--tm-text-hi)", whiteSpace: "nowrap" }}>
                  {row.name}
                </td>
                <td>
                  <span
                    className="tm-mono"
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: ".05em",
                      color: row.classColor,
                    }}
                  >
                    {row.classLabel}
                  </span>
                </td>
                <td className="tm-t-num" style={{ color: "var(--tm-text-mute)" }}>
                  {fmtNum(row.tradeCount, 0)}
                </td>
                <td className="tm-t-num" style={{ color: "var(--tm-text-value)" }}>
                  {fmtPct(row.winRatePct, 1)}
                </td>
                <td className="tm-t-num" style={{ color: "var(--tm-text-value)" }}>
                  {fmtNum(row.sharpeLike, 2)}
                </td>
                <td className={`tm-t-num ${priceToneClass(row.pnlPct)}`} style={{ fontWeight: 600 }}>
                  {fmtPctSigned(row.pnlPct)}
                </td>
                <td
                  className="tm-t-num"
                  style={{ color: semanticTone(row.maxDrawdownPct, "var(--tm-down-soft)") }}
                >
                  {fmtPct(row.maxDrawdownPct, 1)}
                </td>
                <td className="tm-t-spark">
                  <Sparkline
                    values={row.navSparkline}
                    width={62}
                    tone={priceToneVar(row.pnlPct)}
                    label={`Đường vốn ${row.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** Bảng vàng — kỷ lục của đấu trường. */
export function HallOfFamePanel({
  rows,
  emptyReason,
}: {
  rows: F3HofRow[];
  emptyReason: string | null;
}) {
  return (
    <Panel title="BẢNG VÀNG" tone="ref" body="none" style={{ flex: "none" }}>
      {rows.length === 0 ? (
        <EmptyState
          icon="★"
          tone="var(--tm-ref)"
          title="Chưa có kỷ lục nào"
          note={emptyReason ?? "Chưa có trận nào chốt kết quả để ghi vào bảng vàng."}
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              KỶ LỤC ĐƯỢC GHI KHI TRẬN CHỐT KẾT QUẢ
            </span>
          }
        />
      ) : (
        <div>
          {rows.map((row) => (
            <div key={row.id} className="f3-hof__row">
              <span className="f3-hof__mark" aria-hidden="true">
                ★
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="f3-hof__type">{row.type}</div>
                <div className="f3-hof__meta">
                  {row.agent} · {row.symbol} · {row.session}
                </div>
              </div>
              <span className="f3-hof__value">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Nhật ký người vs tác tử — khi nào người ghi đè, khi nào đồng ý. */
export function HumanVsAgentPanel({
  rows,
  emptyReason,
}: {
  rows: F3HumanRow[];
  emptyReason: string | null;
}) {
  return (
    <Panel
      title="NGƯỜI vs TÁC TỬ"
      tone="floor"
      body="none"
      style={{ flex: 1, minHeight: 0 }}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="◇"
          tone="var(--tm-floor)"
          title="Chưa có quyết định nào của người"
          note={emptyReason ?? "Chưa có tác tử lớp NGƯỜI nào ghi quyết định trong đấu trường."}
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              CẦN MỘT TÁC TỬ LỚP NGƯỜI ĐANG HOẠT ĐỘNG
            </span>
          }
        />
      ) : (
        <div className="f3-human">
          {rows.map((row) => (
            <div key={row.id} className="f3-human__row">
              <span className="f3-human__tag" style={{ color: row.tagColor }}>
                {row.tag}
              </span>
              <span className="f3-human__m">{row.message || GAP}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
