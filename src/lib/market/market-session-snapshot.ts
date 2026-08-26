import type { PrismaClient } from "@/generated/prisma/client";
import { findLatestNonSmokeScanRunId } from "@/lib/scanner/latest-scan-run";

/** Single-flight-friendly snapshot for alignment banners (3 parallel reads, no N+1 per row). */
export type MarketSessionSnapshot = {
  benchmarkSessionDate: Date | null;
  latestEquityBarSessionDate: Date | null;
  latestScanRunAt: Date | null;
  /**
   * Bằng chứng khi ba truy vấn trên hỏng. Ba mốc `null` vì ĐỌC LỖI trông y hệt
   * ba mốc `null` vì DB trống — mà hệ quả khác hẳn: không đọc được nghĩa là mọi
   * phép kiểm dữ liệu cũ dựng trên chúng đều im lặng, và người dùng phải biết
   * điều đó thay vì tưởng "không có cảnh báo nào" là "mọi thứ đều tươi".
   */
  error: string | null;
};

export async function fetchMarketSessionSnapshot(
  prisma: PrismaClient
): Promise<MarketSessionSnapshot> {
  try {
    const [benchmark, equityAgg, latestScan] = await Promise.all([
      prisma.indexDailyBar.findFirst({
        where: { symbol: "VNINDEX" },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      prisma.stockDailyBar.aggregate({ _max: { date: true } }),
      // Cùng bộ lọc smoke với F1/F2/F7 — một lần quét smoke mới hơn sẽ làm phép
      // kiểm độ tươi so với một lần quét mà không màn nào đang hiển thị.
      findLatestNonSmokeScanRunId(prisma).then((id) =>
        id == null
          ? null
          : prisma.dailyScanRun.findUnique({ where: { id }, select: { runAt: true } })
      ),
    ]);

    return {
      benchmarkSessionDate: benchmark?.date ?? null,
      latestEquityBarSessionDate: equityAgg._max.date ?? null,
      latestScanRunAt: latestScan?.runAt ?? null,
      error: null,
    };
  } catch (e) {
    console.error("[market-session-snapshot] fetch failed:", e);
    return {
      benchmarkSessionDate: null,
      latestEquityBarSessionDate: null,
      latestScanRunAt: null,
      error:
        "fetchMarketSessionSnapshot() thất bại (indexDailyBar · stockDailyBar · dailyScanRun): " +
        String(e),
    };
  }
}
