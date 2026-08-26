import {
  mapDecisionLevelToUxVerdict,
  resolveCanonicalGate1,
  resolveDecision,
  type Gate1Resolution,
  type VerdictUxLevel,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { LiveGate1Reading } from "@/lib/terminal/gate1-live";

export type TerminalVerdict = {
  /** Cổng 1 chuẩn; `null` khi chưa đo được chế độ trực tiếp. */
  gate1: Gate1Level | null;
  resolution: Gate1Resolution | null;
  /** Phán quyết phiên; `null` khi không có cơ sở để tính. */
  level: VerdictUxLevel | null;
  allocation: string | null;
  /** Bằng chứng khi không tính được, để UI hiện thay vì im lặng. */
  blockedReason: string | null;
};

/**
 * Phán quyết phiên dùng chung cho mọi màn terminal.
 *
 * Một nguồn duy nhất: nếu mỗi màn tự tính, F1 và thanh trạng thái sẽ lệch nhau
 * ngay lần đầu quy tắc đổi. Hai quy tắc bất biến ở đây:
 *
 * 1. Cổng 1 chuẩn là **giá trị xấu hơn** giữa bản đã lưu và bản trực tiếp.
 * 2. Chưa đo được chế độ trực tiếp thì **không có phán quyết** — `getMarketRegimeFromDb()`
 *    trả `WARNING` mặc định khi hỏng DB hoặc thiếu bar, tin mức đó là bịa ra một
 *    phán quyết từ chỗ không có phép đo.
 * 3. Mức phán quyết đi qua đúng `resolveDecision()` mà `DecisionCockpitDto` dùng —
 *    tự tính lại theo cách khác sẽ khiến F1 (đọc DTO) lệch F2 và thanh trạng thái.
 */
export function resolveTerminalVerdict(input: {
  scanGate1: Gate1Level | null;
  candidateCountA: number | null;
  candidateCountB: number | null;
  liveGate1: LiveGate1Reading;
  /** Ghi chú lần quét, để lấy quyết định đã lưu đúng như DTO làm. */
  scanNotes?: DailyScanGate2Notes | null;
  /** Metadata lần quét cho `resolveDecision`. */
  scan?: { id: string; runAt: Date; candidateCountSurfaced: number } | null;
}): TerminalVerdict {
  const { scanGate1, candidateCountA, candidateCountB, liveGate1 } = input;

  if (liveGate1.level == null) {
    return {
      gate1: null,
      resolution: null,
      level: null,
      allocation: null,
      blockedReason: liveGate1.error ?? "Cổng 1 trực tiếp chưa đánh giá được.",
    };
  }

  const resolution = resolveCanonicalGate1({
    scanGate1,
    liveRegimeGate1: liveGate1.level,
  });

  if (candidateCountA == null || candidateCountB == null) {
    return {
      gate1: resolution.canonical,
      resolution,
      level: null,
      allocation: null,
      blockedReason: "Chưa có lần quét hằng ngày nào để đếm ứng viên Cổng 2.",
    };
  }

  const decision = resolveDecision(input.scanNotes ?? null, resolution, {
    id: input.scan?.id ?? "",
    runAt: input.scan?.runAt ?? new Date(0),
    gate1Level: scanGate1 ?? resolution.canonical,
    candidateCountA,
    candidateCountB,
    candidateCountSurfaced: input.scan?.candidateCountSurfaced ?? 0,
  });

  return {
    gate1: resolution.canonical,
    resolution,
    level: mapDecisionLevelToUxVerdict(decision.level),
    allocation: decision.allocation,
    blockedReason: null,
  };
}
