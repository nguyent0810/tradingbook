import type { ReactNode } from "react";
import { GAP, fmtClock, fmtDayMonth } from "@/lib/format/vn";
import { loadTerminalShellStatus } from "@/lib/terminal/shell-status";
import { loadTickerTape } from "@/lib/terminal/ticker-tape";
import { StatusBar } from "./status-bar";
import { TerminalChrome } from "./terminal-chrome";
import { TickerTape } from "./ticker-tape";
import { TopBar } from "./top-bar";

/**
 * Nhãn độ tươi dữ liệu cho thanh trên.
 * T+0 khi lần quét bám đúng phiên VNINDEX mới nhất; ngược lại nêu rõ phiên nào.
 */
function freshnessLabel(
  matches: boolean | null,
  scanRunAt: Date | null,
  scanSessionDate: Date | null
): string {
  if (matches === null) return GAP;
  if (matches) return scanRunAt ? `T+0 · ${fmtClock(scanRunAt)}` : "T+0";
  return scanSessionDate ? `PHIÊN ${fmtDayMonth(scanSessionDate)}` : "LỆCH PHIÊN";
}

/**
 * Shell terminal: thanh trên · băng giá · nav phím F · nội dung · dòng lệnh ·
 * thanh trạng thái. Bao mọi màn F1–F8.
 */
export async function TerminalShell({
  email,
  userId,
  className = "",
  children,
}: {
  email: string;
  userId: string;
  /** Class biến font gắn lên phần tử gốc để mọi con kế thừa. */
  className?: string;
  children: ReactNode;
}) {
  const [status, tape] = await Promise.all([
    loadTerminalShellStatus(userId),
    loadTickerTape(),
  ]);

  return (
    <div className={`tm-root${className ? ` ${className}` : ""}`}>
      <a href="#main-content" className="tm-skip">
        Bỏ qua để đến nội dung chính
      </a>

      <TopBar
        email={email}
        sessionDate={status.scanSessionDate ?? status.latestIndexSessionDate}
        // Truyền THẲNG ba trạng thái: `null` là chưa biết, không phải "cũ".
        live={status.scanMatchesLatestSession}
        dataFreshnessLabel={freshnessLabel(
          status.scanMatchesLatestSession,
          status.scanRunAt,
          status.scanSessionDate
        )}
      />

      <TickerTape items={tape} />

      <TerminalChrome statusBar={<StatusBar status={status} />}>{children}</TerminalChrome>
    </div>
  );
}
