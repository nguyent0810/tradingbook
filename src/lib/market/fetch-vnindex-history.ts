import type { PrismaClient } from "@/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";

export type VnindexHistoryPoint = {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  close: number;
};

/** Trailing N sessions of VNINDEX close, ascending by date — chart data only, not used by any gate/decision. */
export async function fetchVnindexHistory(
  prisma: PrismaClient,
  sessions: number = 30
): Promise<VnindexHistoryPoint[]> {
  try {
    const bars = await prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      orderBy: { date: "desc" },
      take: sessions,
      select: { date: true, close: true },
    });
    return bars
      .slice()
      .reverse()
      .map((b) => ({ date: b.date.toISOString().slice(0, 10), close: b.close }));
  } catch (e) {
    console.error("[fetch-vnindex-history] failed:", e);
    return [];
  }
}

/** Cached wrapper around {@link fetchVnindexHistory} using the shared prisma singleton. */
export async function fetchVnindexHistoryCached(
  sessions: number = 30
): Promise<VnindexHistoryPoint[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  const { prisma } = await import("@/lib/prisma");
  return fetchVnindexHistory(prisma, sessions);
}
