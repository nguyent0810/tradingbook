import Link from "next/link";
import { GAP, fmtSessionDate } from "@/lib/format/vn";
import { dataFreshness } from "@/lib/terminal/labels";
import { TerminalLogoutButton } from "./logout-button";
import { TerminalClock } from "./clock";
import { SymbolLookup } from "./symbol-lookup";

export type TopBarProps = {
  email: string;
  /** Phiên giao dịch mà dữ liệu đang hiển thị. */
  sessionDate: Date | null;
  /** Dữ liệu có khớp phiên gần nhất hay không — quyết định đèn TRỰC TIẾP. */
  /**
   * Lần quét có bám đúng phiên thị trường mới nhất không.
   *
   * `null` = **CHƯA BIẾT** (thiếu một trong hai mốc phiên, hoặc đọc lỗi) — khác
   * hẳn `false` = biết chắc là cũ. Ép `null` thành `false` sẽ khẳng định "DỮ LIỆU
   * CŨ" ở nơi ta không đo được gì.
   */
  live: boolean | null;
  /** Nhãn độ tươi dữ liệu, ví dụ "T+0 · 15:00". */
  dataFreshnessLabel: string;
};

/** Thanh trên 34px: thương hiệu · tìm mã · trạng thái phiên · người dùng. */
export function TopBar({ email, sessionDate, live, dataFreshnessLabel }: TopBarProps) {
  const freshness = dataFreshness(live);
  return (
    <header className="tm-topbar">
      <Link href="/dashboard" className="tm-topbar__brand" aria-label="TradeLog — Bảng điều khiển">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <span>TRADELOG</span>
      </Link>

      <div className="tm-topbar__cell tm-topbar__cell--tight">VN TERMINAL · v4.0</div>

      <div className="tm-topbar__cell">
        <SymbolLookup />
      </div>

      <div className="tm-topbar__cell tm-topbar__cell--data">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {freshness.led ? <span className="tm-led" aria-hidden="true" /> : null}
          <span
            style={{ color: freshness.color, fontWeight: 600, letterSpacing: ".08em" }}
            title={freshness.title}
          >
            {freshness.label}
          </span>
        </span>
        <span style={{ color: "var(--tm-text-faint)" }}>
          PHIÊN{" "}
          <span style={{ color: "var(--tm-text-base)" }}>
            {sessionDate ? fmtSessionDate(sessionDate) : GAP}
          </span>
        </span>
        <TerminalClock />
        <span style={{ color: "var(--tm-text-faint)" }}>ICT</span>
      </div>

      <div className="tm-topbar__spacer" />

      <div className="tm-topbar__end">
        <span style={{ color: "var(--tm-text-faint)" }}>DỮ LIỆU</span>
        <span style={{ color: freshness.color }}>
          {dataFreshnessLabel}
        </span>
        <span className="tm-topbar__divider" />
        <span className="tm-topbar__user" title={email}>
          {email}
        </span>
        <TerminalLogoutButton />
      </div>
    </header>
  );
}
