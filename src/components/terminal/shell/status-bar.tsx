import { GAP, fmtClock, fmtNum } from "@/lib/format/vn";
import { gate1Color, gate1Label, verdictTokens } from "@/lib/terminal/verdict-tokens";
import type { TerminalShellStatus } from "@/lib/terminal/shell-status";

type Cell = { key: string; value: string; color: string };

/**
 * Thanh trạng thái 21px — sáu ô chỉ số phiên.
 *
 * Ô PHÁN QUYẾT lấy màu từ cùng token với panel phán quyết ở F1, nên đổi mức
 * phán quyết là cả hai đổi màu đồng bộ (QA §4).
 */
function buildCells(status: TerminalShellStatus): Cell[] {
  const dim = "var(--tm-text-quiet)";
  const gapColor = "var(--tm-text-faint)";

  const verdict = status.verdict ? verdictTokens(status.verdict) : null;

  return [
    {
      key: "CỔNG 1",
      value: status.gate1 ? gate1Label(status.gate1) : GAP,
      color: status.gate1 ? gate1Color(status.gate1) : gapColor,
    },
    {
      key: "PHÁN QUYẾT",
      value: verdict ? verdict.code : GAP,
      color: verdict ? verdict.color : gapColor,
    },
    {
      key: "A/B",
      value: fmtNum(status.candidateCountAb, 0),
      color: status.candidateCountAb == null ? gapColor : "var(--tm-up)",
    },
    {
      key: "SUÝT ĐẠT",
      value: fmtNum(status.nearMissCount, 0),
      color: status.nearMissCount == null ? gapColor : "var(--tm-accent)",
    },
    {
      key: "LỆNH MỞ",
      value: fmtNum(status.openTradeCount, 0),
      color: status.openTradeCount == null ? gapColor : "var(--tm-floor)",
    },
    {
      key: "QUÉT",
      value: status.scanRunAt ? fmtClock(status.scanRunAt) : GAP,
      color: status.scanRunAt ? dim : gapColor,
    },
  ];
}

export function StatusBar({ status }: { status: TerminalShellStatus }) {
  const cells = buildCells(status);

  return (
    <footer className="tm-statusbar" aria-label="Trạng thái phiên">
      {cells.map((cell) => (
        <span key={cell.key} className="tm-statusbar__cell">
          <span className="tm-statusbar__k">{cell.key}</span>
          <span className="tm-statusbar__v" style={{ color: cell.color }}>
            {cell.value}
          </span>
        </span>
      ))}
      <span className="tm-statusbar__fill" />
      <span className="tm-statusbar__hint">
        F1–F8 chuyển màn · F9 trợ giúp · ESC đóng lớp phủ
      </span>
    </footer>
  );
}
