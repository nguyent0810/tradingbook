import type { PrismaClient } from "@/generated/prisma/client";

/** Single-flight-friendly snapshot for alignment banners (3 parallel reads, no N+1 per row). */
export type MarketSessionSnapshot = {
  benchmarkSessionDate: Date | null;
  latestEquityBarSessionDate: Date | null;
  latestScanRunAt: Date | null;
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
      prisma.dailyScanRun.findFirst({
        orderBy: { runAt: "desc" },
        select: { runAt: true },
      }),
    ]);

    return {
      benchmarkSessionDate: benchmark?.date ?? null,
      latestEquityBarSessionDate: equityAgg._max.date ?? null,
      latestScanRunAt: latestScan?.runAt ?? null,
    };
  } catch (e) {
    console.error("[market-session-snapshot] fetch failed:", e);
    return {
      benchmarkSessionDate: null,
      latestEquityBarSessionDate: null,
      latestScanRunAt: null,
    };
  }
}
