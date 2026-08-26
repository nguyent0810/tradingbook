import Link from "next/link";
import { EmptyState, Panel } from "@/components/terminal";
import { fmtNum, fmtPctSigned } from "@/lib/format/vn";
import type { F1NearMissRow } from "@/lib/dashboard/terminal/f1-view-model";

/**
 * Suýt đạt — mã dừng sát ngưỡng Cổng 2. Không phải ứng viên vào lệnh:
 * tiêu đề panel nói rõ "KHÔNG VÀO LỆNH" để không ai nhầm hai bảng với nhau.
 */
export function NearMissTable({
  rows,
  emptyReason,
}: {
  rows: F1NearMissRow[];
  emptyReason: string | null;
}) {
  return (
    <Panel
      className="f1__near-miss"
      title="SUÝT ĐẠT · CHỜ ĐIỀU KIỆN"
      tone="accent"
      meta={rows.length > 0 ? `· ${fmtNum(rows.length, 0)} MÃ · KHÔNG VÀO LỆNH` : undefined}
      body={rows.length > 0 ? "scroll" : "pad"}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="◴"
          tone="var(--tm-floor)"
          title="Không có mã suýt đạt"
          note={emptyReason ?? "Lần quét gần nhất không ghi mã nào vào lane chẩn đoán."}
          action={
            <Link href="/setups" className="tm-btn tm-btn--sm">
              MỞ ĐƯỜNG ỐNG
            </Link>
          }
        />
      ) : (
        <table className="tm-table tm-table--sm">
          <thead>
            <tr>
              <th>MÃ</th>
              <th>TRẠNG THÁI</th>
              <th>LÝ DO DỪNG</th>
              <th className="tm-t-num">CÁCH VÙNG</th>
              <th className="tm-t-num">RS20</th>
              <th>CHỜ TÍN HIỆU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td
                  className="tm-t-sym"
                  style={{ fontWeight: 600, color: "var(--tm-text-strong)" }}
                >
                  {row.symbol}
                </td>
                <td>
                  <span
                    className="tm-mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      color: row.statusColor,
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>{row.reason}</td>
                <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                  {fmtPctSigned(row.distancePct)}
                </td>
                <td className="tm-t-num" style={{ fontSize: 11, color: row.rsColor }}>
                  {fmtPctSigned(row.rs20, 1)}
                </td>
                <td style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>{row.waitFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
