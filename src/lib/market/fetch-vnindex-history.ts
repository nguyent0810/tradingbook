import type { PrismaClient } from "@/generated/prisma/client";

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
