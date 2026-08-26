import type { PrismaClient } from "@/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";

export type VnindexHistoryPoint = {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  close: number;
};

async function queryVnindexHistory(
  prisma: PrismaClient,
  sessions: number
): Promise<VnindexHistoryPoint[]> {
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
}

/** Trailing N sessions of VNINDEX close, ascending by date — chart data only, not used by any gate/decision. */
export async function fetchVnindexHistory(
  prisma: PrismaClient,
  sessions: number = 30
): Promise<VnindexHistoryPoint[]> {
  try {
    return await queryVnindexHistory(prisma, sessions);
  } catch (e) {
    console.error("[fetch-vnindex-history] failed:", e);
    return [];
  }
}

export type VnindexHistoryResult = {
  points: VnindexHistoryPoint[];
  /**
   * Nguyên văn lỗi khi truy vấn ném — khác hẳn một kết quả rỗng thật.
   *
   * Trước đây đây là `boolean`: UI biết "có lỗi" nhưng không biết lỗi gì, nên chỉ
   * in được tên truy vấn viết cứng. Bàn giao §6 đòi bằng chứng THẬT, và một cờ
   * `true` thì không mang bằng chứng nào qua được ranh giới hàm.
   */
  error: string | null;
};

/** Cached wrapper using the shared prisma singleton — surfaces query failures instead of swallowing them. */
export async function fetchVnindexHistoryCached(
  sessions: number = 30
): Promise<VnindexHistoryResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  const { prisma } = await import("@/lib/prisma");
  try {
    return { points: await queryVnindexHistory(prisma, sessions), error: null };
  } catch (e) {
    console.error("[fetch-vnindex-history] failed:", e);
    return {
      points: [],
      error:
        "fetchVnindexHistoryCached(" +
        String(sessions) +
        ") thất bại (prisma.indexDailyBar.findMany symbol=VNINDEX): " +
        String(e),
    };
  }
}
