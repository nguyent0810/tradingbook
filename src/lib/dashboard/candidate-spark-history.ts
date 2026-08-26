import type { PrismaClient } from "@/generated/prisma/client";

export type SparkHistory = {
  /** Giá đóng cửa theo thứ tự thời gian tăng dần (phiên cũ → mới). */
  closes: number[];
};

/**
 * Số ngày lịch kéo về để chắc chắn có đủ `sessions` phiên giao dịch.
 * ~20 phiên ≈ 4 tuần, cộng nghỉ lễ — 60 ngày là dư an toàn mà vẫn bị chặn.
 */
const CALENDAR_LOOKBACK_DAYS = 60;

/**
 * Lịch sử giá đóng cửa cho sparkline 20 phiên.
 *
 * **Một truy vấn cho mọi mã** — không lặp theo mã. Sparkline chỉ là trang trí
 * thông tin ở ô bảng, không đáng để trả giá N+1 trên đường render dashboard.
 */
export async function loadCandidateSparkHistory(
  prisma: PrismaClient,
  symbolIds: readonly string[],
  throughDate: Date,
  sessions = 20
): Promise<Map<string, number[]>> {
  const ids = [...new Set(symbolIds)];
  const out = new Map<string, number[]>();
  if (ids.length === 0) return out;

  const fromDate = new Date(throughDate.getTime() - CALENDAR_LOOKBACK_DAYS * 86_400_000);

  const bars = await prisma.stockDailyBar.findMany({
    where: {
      symbolId: { in: ids },
      date: { gte: fromDate, lte: throughDate },
    },
    orderBy: [{ symbolId: "asc" }, { date: "asc" }],
    select: { symbolId: true, close: true },
  });

  for (const bar of bars) {
    const list = out.get(bar.symbolId);
    if (list) list.push(bar.close);
    else out.set(bar.symbolId, [bar.close]);
  }

  // Giữ `sessions` phiên gần nhất, vẫn theo thứ tự cũ → mới.
  for (const [symbolId, closes] of out) {
    if (closes.length > sessions) out.set(symbolId, closes.slice(-sessions));
  }

  return out;
}

/**
 * Biến động % của phiên cuối so với phiên liền trước.
 * `null` khi chưa đủ hai phiên — ô sẽ hiện `—`, không hiện 0%.
 */
export function sessionChangePct(closes: readonly number[] | undefined): number | null {
  if (!closes || closes.length < 2) return null;
  const latest = closes[closes.length - 1];
  const previous = closes[closes.length - 2];
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}
