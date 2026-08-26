import "server-only";

import { prisma } from "@/lib/prisma";
import { findLatestNonSmokeScanRunId } from "@/lib/scanner/latest-scan-run";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { readLiveGate1, type LiveGate1Reading } from "@/lib/terminal/gate1-live";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import type { DailyTradingDecisionLevel } from "@/lib/scanner/trading-decision";
import type { Gate1Resolution, VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { resolveTerminalVerdict } from "@/lib/terminal/verdict-resolve";

/**
 * Trạng thái tối thiểu cho thanh dưới cùng của shell — hiện trên **mọi** màn,
 * nên phải rẻ: chỉ đọc metadata lần quét gần nhất, chế độ VNINDEX và đếm lệnh mở.
 * Không kéo bảng ứng viên.
 *
 * Mỗi trường có thể là `null` (gap) độc lập: một truy vấn hỏng không được làm
 * sập cả shell.
 */
export type TerminalShellStatus = {
  gate1: Gate1Level | null;
  gate1Resolution: Gate1Resolution | null;
  verdict: VerdictUxLevel | null;
  persistedDecision: DailyTradingDecisionLevel | null;
  candidateCountAb: number | null;
  nearMissCount: number | null;
  openTradeCount: number | null;
  scanRunAt: Date | null;
  scanRunId: string | null;
  /** Phiên mà lần quét đánh giá — dùng cho banner dữ liệu cũ. */
  scanSessionDate: Date | null;
  /** Phiên VNINDEX mới nhất đã lưu — mốc so sánh độ tươi dữ liệu. */
  latestIndexSessionDate: Date | null;
  /**
   * Lần quét có bám đúng phiên VNINDEX mới nhất không. `null` khi thiếu một
   * trong hai mốc — không đoán "trực tiếp" từ dữ liệu không có.
   */
  scanMatchesLatestSession: boolean | null;
  /** Lỗi từng phần, để panel nào cần thì hiện bằng chứng thật. */
  errors: string[];
};

const EMPTY: TerminalShellStatus = {
  gate1: null,
  gate1Resolution: null,
  verdict: null,
  persistedDecision: null,
  candidateCountAb: null,
  nearMissCount: null,
  openTradeCount: null,
  scanRunAt: null,
  scanRunId: null,
  scanSessionDate: null,
  latestIndexSessionDate: null,
  scanMatchesLatestSession: null,
  errors: [],
};

/**
 * Hai mốc có cùng ngày phiên không. So theo ngày UTC vì cả hai cột đều lưu
 * dạng `@db.Date` / ngày phiên, không phải dấu thời gian địa phương.
 */
function sameSessionDay(a: Date | null, b: Date | null): boolean | null {
  if (a == null || b == null) return null;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Metadata lần quét THẬT gần nhất — không join bảng ứng viên.
 *
 * Dùng chung bộ lọc smoke với F1/F2/F7: nếu thanh trạng thái lấy lần quét thô,
 * ô PHÁN QUYẾT và mốc thời gian trên thanh sẽ nói về một lần quét khác với lần
 * quét mà màn bên dưới đang hiển thị.
 */
async function loadLatestScanMeta() {
  const latestId = await findLatestNonSmokeScanRunId(prisma);
  if (latestId == null) return null;
  return prisma.dailyScanRun.findUnique({
    where: { id: latestId },
    select: {
      id: true,
      runAt: true,
      expectedSessionDate: true,
      gate1Level: true,
      candidateCountA: true,
      candidateCountB: true,
      candidateCountSurfaced: true,
      notes: true,
    },
  });
}

export async function loadTerminalShellStatus(
  userId: string | null
): Promise<TerminalShellStatus> {
  const errors: string[] = [];

  const [scanResult, regimeResult, openCountResult] = await Promise.allSettled([
    loadLatestScanMeta(),
    getMarketRegimeFromDb(),
    userId
      ? prisma.trade.count({ where: { userId, status: "OPEN" } })
      : Promise.resolve(null),
  ]);

  const scan = scanResult.status === "fulfilled" ? scanResult.value : null;
  if (scanResult.status === "rejected") {
    errors.push(`loadLatestScanMeta() → ${String(scanResult.reason)}`);
  }

  const liveGate1: LiveGate1Reading =
    regimeResult.status === "fulfilled"
      ? readLiveGate1(regimeResult.value)
      : { level: null, error: `getMarketRegimeFromDb() → ${String(regimeResult.reason)}` };
  if (liveGate1.error) errors.push(liveGate1.error);

  const openTradeCount =
    openCountResult.status === "fulfilled" ? openCountResult.value : null;
  if (openCountResult.status === "rejected") {
    errors.push(`prisma.trade.count(status=OPEN) → ${String(openCountResult.reason)}`);
  }

  // Bar mới nhất vẫn dùng được kể cả khi chưa đủ bar để đánh giá Cổng 1 — đó là
  // dữ liệu thật, chỉ là chưa đủ dài cho MA50.
  const latestIndexSessionDate =
    regimeResult.status === "fulfilled" ? (regimeResult.value.latestBar?.date ?? null) : null;

  if (!scan && liveGate1.level == null) {
    return { ...EMPTY, openTradeCount, latestIndexSessionDate, errors };
  }

  const notes = scan ? parseDailyScanGate2Notes(scan.notes) : null;
  const candidateCountAb = scan ? scan.candidateCountA + scan.candidateCountB : null;
  const nearMissCount = notes?.closestToValidSymbols?.length ?? null;

  // Phán quyết tính lại trên Cổng 1 chuẩn — không tin thẳng quyết định đã lưu
  // (QA §5). Cùng hàm với các màn khác nên không thể lệch nhau.
  const resolved = resolveTerminalVerdict({
    scanGate1: (scan?.gate1Level as Gate1Level | undefined) ?? null,
    candidateCountA: scan?.candidateCountA ?? null,
    candidateCountB: scan?.candidateCountB ?? null,
    liveGate1,
    scanNotes: notes,
    scan: scan
      ? { id: scan.id, runAt: scan.runAt, candidateCountSurfaced: scan.candidateCountSurfaced }
      : null,
  });

  return {
    gate1: resolved.gate1,
    gate1Resolution: resolved.resolution,
    verdict: resolved.level,
    persistedDecision: notes?.decision?.level ?? null,
    candidateCountAb,
    nearMissCount,
    openTradeCount,
    scanRunAt: scan?.runAt ?? null,
    scanRunId: scan?.id ?? null,
    scanSessionDate: scan?.expectedSessionDate ?? null,
    latestIndexSessionDate,
    scanMatchesLatestSession: sameSessionDay(
      scan?.expectedSessionDate ?? null,
      latestIndexSessionDate
    ),
    errors,
  };
}
