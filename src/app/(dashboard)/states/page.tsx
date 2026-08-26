import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, Panel, PanelSkeleton, SourceTag, StaleBanner } from "@/components/terminal";
import { TERMINAL_SCREENS } from "@/lib/terminal/nav";
import { verdictTokens } from "@/lib/terminal/verdict-tokens";
import "@/styles/terminal-f8.css";

export const metadata: Metadata = {
  title: "F8 Trạng thái — TradeLog VN Terminal",
  description: "Trang tham chiếu nội bộ cho DEV/QA: trạng thái panel và token thiết kế.",
  robots: { index: false, follow: false },
};

/**
 * Màn F8 · Trạng thái & token bàn giao.
 *
 * **Không phải màn sản phẩm** (bàn giao §4): đây là trang tham chiếu cho DEV/QA,
 * dựng bằng đúng những primitive mà các màn thật dùng. Nhờ vậy nó vừa là tài
 * liệu sống vừa là bề mặt để soi hồi quy — sửa hỏng primitive là thấy ngay ở đây.
 *
 * Không có nav vào trang này trong bản chạy thật; mở bằng phím F8 hoặc lệnh STATES.
 */

const COLOR_TOKENS: { token: string; hex: string; note: string }[] = [
  { token: "--tm-bg-base", hex: "#0A0E11", note: "nền ứng dụng, cột chứa panel" },
  { token: "--tm-bg-panel", hex: "#0E1216", note: "thân panel, thân bảng" },
  { token: "--tm-bg-head", hex: "#141B21", note: "tiêu đề panel, thanh trạng thái" },
  { token: "--tm-bg-cell", hex: "#111720", note: "ô KPI, thead dính" },
  { token: "--tm-bg-sel", hex: "#16212A", note: "hàng đang chọn" },
  { token: "--tm-bg-btn", hex: "#1A222A", note: "nút phụ, input group" },
  { token: "--tm-line-panel", hex: "#1C242B", note: "viền panel và khe chia 1px" },
  { token: "--tm-line-row", hex: "#161D23", note: "viền dưới hàng bảng" },
  { token: "--tm-line-input", hex: "#29333C", note: "viền input, nút phụ" },
  { token: "--tm-text-hi", hex: "#F2F7FA", note: "mã cổ phiếu, số chính" },
  { token: "--tm-text-base", hex: "#DBE4EA", note: "nội dung, nhãn nút" },
  { token: "--tm-text-mute", hex: "#9DABB6", note: "diễn giải, ghi chú" },
  { token: "--tm-text-dim", hex: "#69757F", note: "nhãn 9–10px, thead" },
  { token: "--tm-accent", hex: "#FFA62B", note: "thương hiệu, PROBE, nhấn, focus" },
  { token: "--tm-up", hex: "#2BD47D", note: "tăng giá, ĐẠT, TRADE" },
  { token: "--tm-down", hex: "#FF4D5E", note: "giảm giá, FAIL, NO_TRADE" },
  { token: "--tm-ref", hex: "#F5D90A", note: "giá tham chiếu, cảnh báo nhẹ" },
  { token: "--tm-ceil", hex: "#B95CFF", note: "giá trần, nhóm chẩn đoán" },
  { token: "--tm-floor", hex: "#4CC2FF", note: "giá sàn, thông tin, liên kết" },
];

const TYPE_TOKENS: { key: string; spec: string; note: string }[] = [
  { key: "display/num", spec: "Mono 600 · 19–28px", note: "mã phán quyết, giá chính màn chi tiết" },
  { key: "kpi/num", spec: "Mono 600 · 17–19px", note: "ô KPI, phễu bộ quét" },
  { key: "data/num", spec: "Mono 400–600 · 12px", note: "ô bảng — tabular-nums, căn phải" },
  { key: "data/small", spec: "Mono 400 · 10–11px", note: "log, blotter, phụ đề kỹ thuật" },
  { key: "ui/label", spec: "Sans 600–700 · 11–12px", note: "nhãn hàng, nút, tiêu đề mục" },
  { key: "ui/eyebrow", spec: "Sans 700 · 9–10px · +0,1em · UPPER", note: "tiêu đề panel, thead" },
  { key: "body", spec: "Sans 400 · 11–12px · 1,45", note: "diễn giải, ghi chú" },
];

const METRICS: { key: string; value: string }[] = [
  { key: "Hàng bảng chính", value: "26–27px" },
  { key: "Hàng bảng phụ / danh sách", value: "23–24px" },
  { key: "Chiều cao thead", value: "21–22px" },
  { key: "Tiêu đề panel", value: "24px" },
  { key: "Thanh trên / dòng lệnh / trạng thái", value: "34 / 29 / 21px" },
  { key: "Băng giá / nav phím F", value: "25px / 29px" },
  { key: "Đệm ngang ô bảng", value: "6–8px" },
  { key: "Đệm thân panel", value: "9–13px" },
  { key: "Bo góc", value: "2px nút & ô · 3px panel & modal" },
  { key: "Bề rộng tối thiểu", value: "1000px (cài đặt) – 1160px (bảng điều khiển)" },
];

const PROVENANCE: { value: "real" | "derived" | "static_copy" | "config" | "gap"; note: string }[] = [
  { value: "real", note: "Đọc thẳng từ cơ sở dữ liệu, không biến đổi." },
  { value: "derived", note: "Tính ra từ dữ liệu thật; công thức nằm trong view model." },
  { value: "static_copy", note: "Chữ cố định, không phụ thuộc dữ liệu." },
  { value: "config", note: "Người dùng đặt trong Cài đặt (F5)." },
  { value: "gap", note: "Không có dữ liệu — hiện `—`, KHÔNG được dùng để tính phán quyết." },
];

export default function StatesPage() {
  return (
    <div className="f8" data-testid="f8-states">
      <div className="f8__head">
        <span className="f8__title">Trạng thái hệ thống &amp; token bàn giao</span>
        <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-dim)" }}>
          DÙNG CHO DEV/QA · KHÔNG PHẢI MÀN CHỨC NĂNG · KHÔNG CÓ TRONG NAV
        </span>
      </div>

      <div className="f8__grid2">
        <Panel title="ĐANG TẢI · SKELETON" tone="floor" body="pad">
          <PanelSkeleton rows={5} columns={[34, 160, 52, 40]} label="Ví dụ skeleton" />
          <div className="f8__note">
            Không dùng spinner. Skeleton giữ đúng chiều cao hàng thật (26px) để layout không nhảy.
          </div>
        </Panel>

        <Panel title="LỖI · KÈM BẰNG CHỨNG" tone="down" background="var(--tm-head-no-trade)" body="pad">
          <ErrorState
            title="Một phần dữ liệu bảng điều khiển không nạp được"
            note="Truy vấn Prisma thất bại. Các panel bên dưới có thể trống hoặc thiếu cột."
            evidence={"src/app/(dashboard)/dashboard/page.tsx\nprepareSurfacedCandidatesHealthView() → connection refused"}
            action={
              <Link href="/dashboard" className="tm-btn tm-btn--sm">
                TẢI LẠI
              </Link>
            }
          />
        </Panel>
      </div>

      <Panel title="DỮ LIỆU CŨ" tone="ref" body="none">
        <StaleBanner
          sessionLabel="24/08/2026"
          consequence="Nguồn T+0 chưa đồng bộ — phán quyết và định cỡ vị thế đều tính trên phiên này."
        />
      </Panel>

      <Panel title="TRẠNG THÁI RỖNG · 4 BIẾN THỂ" tone="accent" body="none">
        <div className="f8__grid4">
          {[
            {
              icon: "◴",
              tone: "var(--tm-floor)",
              title: "Bộ quét chưa chạy phiên hôm nay",
              note: "Lần quét gần nhất 24/08 · 09:15:02. Hệ thống tự quét lúc 09:15 phiên tới.",
              cta: "XEM ĐƯỜNG ỐNG",
            },
            {
              icon: "∅",
              tone: "var(--tm-accent)",
              title: "Không có ứng viên đạt Cổng 2",
              note: "612 mã qua thanh khoản, 0 mã đạt đủ tiêu chí. Xem 12 mã suýt đạt để biết vướng ở đâu.",
              cta: "XEM SUÝT ĐẠT",
            },
            {
              icon: "▤",
              tone: "var(--tm-up)",
              title: "Sổ lệnh còn trống",
              note: "Chưa có lệnh nào được ghi nhận. Ghi lệnh tay hoặc chốt kế hoạch từ bảng thiết lập.",
              cta: "+ GHI LỆNH TAY",
            },
            {
              icon: "◇",
              tone: "var(--tm-ceil)",
              title: "Chưa có trận đấu nào",
              note: "Cần tối thiểu 2 tác tử ra quyết định cùng một mã trong cùng phiên để tạo trận đấu.",
              cta: "CẤU HÌNH TÁC TỬ",
            },
          ].map((state) => (
            <div key={state.title} className="f8__empty-cell">
              <EmptyState
                icon={state.icon}
                tone={state.tone}
                title={state.title}
                note={state.note}
                action={
                  <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
                    {state.cta}
                  </span>
                }
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="f8__grid2">
        <Panel title="NHÃN NGUỒN DỮ LIỆU (PROVENANCE)" tone="ceil" body="none">
          <table className="tm-table tm-table--sm">
            <tbody>
              {PROVENANCE.map((row) => (
                <tr key={row.value}>
                  <td style={{ width: 76 }}>
                    <SourceTag provenance={row.value} />
                  </td>
                  <td style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="PHÁN QUYẾT · 3 MỨC" tone="accent" body="none">
          <table className="tm-table tm-table--sm">
            <thead>
              <tr>
                <th>MỨC</th>
                <th>MÃ</th>
                <th className="tm-t-num">KHỐI LƯỢNG</th>
                <th>Ý NGHĨA</th>
              </tr>
            </thead>
            <tbody>
              {(["NO_TRADE", "PROBE", "TRADE"] as const).map((level) => {
                const t = verdictTokens(level);
                return (
                  <tr key={level}>
                    <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                      {level}
                    </td>
                    <td>
                      <span className="tm-tag tm-tag--solid" style={{ ["--tm-tag-tone" as string]: t.color }}>
                        {t.code}
                      </span>
                    </td>
                    <td className="tm-t-num" style={{ color: t.color }}>
                      {t.sizeLabel}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>{t.sizeReason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="TOKEN MÀU" tone="floor" body="none">
        <table className="tm-table tm-table--sm">
          <thead>
            <tr>
              <th>TOKEN</th>
              <th>HEX</th>
              <th style={{ width: 56 }}>MẪU</th>
              <th>DÙNG Ở ĐÂU</th>
            </tr>
          </thead>
          <tbody>
            {COLOR_TOKENS.map((row) => (
              <tr key={row.token}>
                <td className="tm-mono" style={{ fontSize: 11 }}>
                  {row.token}
                </td>
                <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-dim)" }}>
                  {row.hex}
                </td>
                <td>
                  <span className="f8__swatch" style={{ background: `var(${row.token})` }} />
                </td>
                <td style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="f8__grid2">
        <Panel title="TOKEN CHỮ" tone="up" body="none">
          <table className="tm-table tm-table--sm">
            <tbody>
              {TYPE_TOKENS.map((row) => (
                <tr key={row.key}>
                  <td className="tm-mono" style={{ fontSize: 11, width: 110 }}>
                    {row.key}
                  </td>
                  <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-dim)" }}>
                    {row.spec}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="KÍCH THƯỚC" tone="ref" body="none">
          <table className="tm-table tm-table--sm">
            <tbody>
              {METRICS.map((row) => (
                <tr key={row.key}>
                  <td style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>{row.key}</td>
                  <td className="tm-mono tm-t-num" style={{ fontSize: 11 }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="BẢN ĐỒ MÀN → ĐƯỜNG DẪN" tone="ceil" body="none">
        <table className="tm-table tm-table--sm">
          <thead>
            <tr>
              <th style={{ width: 46 }}>PHÍM</th>
              <th>MÀN</th>
              <th>ĐƯỜNG DẪN</th>
              <th>LỆNH</th>
              <th style={{ width: 74 }}>TRONG NAV</th>
            </tr>
          </thead>
          <tbody>
            {TERMINAL_SCREENS.map((screen) => (
              <tr key={screen.key}>
                <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-accent)" }}>
                  {screen.key}
                </td>
                <td style={{ fontSize: 11, color: "var(--tm-text-base)" }}>{screen.label}</td>
                <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-dim)" }}>
                  {screen.href}
                </td>
                <td className="tm-mono" style={{ fontSize: 11, color: "var(--tm-text-quiet)" }}>
                  {screen.commands.join(" · ")}
                </td>
                <td
                  className="tm-mono"
                  style={{
                    fontSize: 10,
                    color: screen.inNav ? "var(--tm-up)" : "var(--tm-text-faint)",
                  }}
                >
                  {screen.inNav ? "CÓ" : "KHÔNG"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
