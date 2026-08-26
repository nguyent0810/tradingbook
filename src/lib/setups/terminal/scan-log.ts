import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { gate1Label } from "@/lib/terminal/verdict-tokens";
import { fmtClock, fmtNum, fmtSessionDate } from "@/lib/format/vn";

export type ScanLogTone = "info" | "muted" | "good" | "warn" | "bad";

export type ScanLogRow = {
  /** Dấu thời gian hiển thị; rỗng khi mốc đó không được ghi lại. */
  time: string;
  message: string;
  tone: ScanLogTone;
};

export type ScanLogInput = {
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  expectedSessionDate: Date | null;
  status: string;
  gate1Level: string;
  symbolCountTotal: number;
  symbolCountScanned: number;
  symbolCountFailed: number;
  symbolCountAfterTradability: number;
  symbolCountFilteredOut: number;
  candidateCountA: number;
  candidateCountB: number;
  candidateCountSurfaced: number;
  errorSummary: string | null;
  notes: DailyScanGate2Notes | null;
  /** Ứng viên đã lộ diện, để ghi dòng "ĐẠT". */
  surfaced: { symbol: string; quality: "A" | "B"; rankScore: number }[];
};

/**
 * Nhật ký bộ quét dựng lại từ **dữ liệu đã lưu của lần quét**, không phải log
 * thời gian thực: hệ thống không giữ log từng bước, nên đây là biên bản đọc
 * ngược từ các con số run đã ghi. Không thêm dòng nào không có số chống lưng.
 */
export function buildScanLog(input: ScanLogInput): ScanLogRow[] {
  const rows: ScanLogRow[] = [];
  const startStamp = fmtClock(input.startedAt ?? input.runAt);
  const endStamp = input.finishedAt ? fmtClock(input.finishedAt) : startStamp;

  const push = (time: string, message: string, tone: ScanLogTone = "info") =>
    rows.push({ time, message, tone });

  push(
    startStamp,
    `Bắt đầu quét phiên ${
      input.expectedSessionDate ? fmtSessionDate(input.expectedSessionDate) : "không rõ"
    }`
  );
  push(startStamp, `Nạp vũ trụ mã: ${fmtNum(input.symbolCountTotal, 0)} mã`);

  const gate1 = gate1Label(input.gate1Level as "PASS" | "WARNING" | "FAIL");
  push(
    startStamp,
    `Cổng 1 = ${gate1}`,
    input.gate1Level === "PASS" ? "good" : input.gate1Level === "WARNING" ? "warn" : "bad"
  );

  push(
    endStamp,
    `Đã quét ${fmtNum(input.symbolCountScanned, 0)} mã` +
      (input.symbolCountFilteredOut > 0
        ? ` · lọc bỏ ${fmtNum(input.symbolCountFilteredOut, 0)}`
        : "")
  );
  if (input.symbolCountFailed > 0) {
    push(endStamp, `Lỗi khi quét ${fmtNum(input.symbolCountFailed, 0)} mã`, "bad");
  }
  push(
    endStamp,
    `Qua thanh khoản: ${fmtNum(input.symbolCountAfterTradability, 0)} mã`
  );

  const rejections = Object.entries(input.notes?.topRejectionCategories ?? {}).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [category, count] of rejections) {
    push(endStamp, `Loại: ${rejectionBucketLabel(category)} ${fmtNum(count, 0)}`, "muted");
  }

  const nearMissCount = input.notes?.closestToValidSymbols?.length ?? 0;
  if (nearMissCount > 0) {
    push(endStamp, `SUÝT ĐẠT: ${fmtNum(nearMissCount, 0)} mã vào lane chẩn đoán`, "warn");
  }

  if (input.surfaced.length > 0) {
    const byTier = (tier: "A" | "B") =>
      input.surfaced
        .filter((s) => s.quality === tier)
        .map((s) => `${s.symbol} (${tier} · ${fmtNum(s.rankScore, 1)})`);
    for (const tier of ["A", "B"] as const) {
      const list = byTier(tier);
      if (list.length > 0) push(endStamp, `ĐẠT: ${list.join(" · ")}`, "good");
    }
  } else {
    push(
      endStamp,
      `ĐẠT: 0 mã · Cổng 2 chấm ${fmtNum(input.candidateCountA + input.candidateCountB, 0)} ứng viên, lộ diện ${fmtNum(input.candidateCountSurfaced, 0)}`,
      "warn"
    );
  }

  const decision = input.notes?.decision;
  if (decision) {
    push(
      endStamp,
      `Phán quyết đã lưu = ${decision.level} · phân bổ ${decision.allocation}`,
      decision.level === "NO_TRADE" ? "bad" : decision.level === "PROBE" ? "warn" : "good"
    );
  }

  if (input.startedAt && input.finishedAt) {
    const seconds = (input.finishedAt.getTime() - input.startedAt.getTime()) / 1000;
    if (Number.isFinite(seconds) && seconds >= 0) {
      push(endStamp, `Hoàn tất trong ${fmtNum(seconds, 1)}s · trạng thái ${input.status}`, "info");
    }
  } else {
    push(endStamp, `Trạng thái lần quét: ${input.status}`, "info");
  }

  if (input.errorSummary) {
    push(endStamp, `Lỗi: ${input.errorSummary}`, "bad");
  }

  return rows;
}
