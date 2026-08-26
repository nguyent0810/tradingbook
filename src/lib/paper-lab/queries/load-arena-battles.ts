import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Latest 20 arena battles with full `battleDecisions` — shared by the paper-lab page's
 * "learning" summary and the Arena DTO's "recent battles" widget so the query runs once
 * per request instead of twice (React cache dedupes calls within the same render).
 *
 * `outcomes` and each decision's agent come along because the F3 battle table shows
 * which agent won and how it compared to the benchmark; loading them here keeps that
 * a single bounded query instead of one lookup per battle row.
 */
export type ArenaBattlesResult = {
  rows: Awaited<ReturnType<typeof queryArenaBattles>>;
  /** Bằng chứng thật khi truy vấn hỏng — `null` khi chỉ là chưa có trận nào. */
  error: string | null;
};

function queryArenaBattles() {
  return prisma.arenaBattle.findMany({
    orderBy: { sessionDate: "desc" },
    take: 20,
    include: {
      battleDecisions: {
        include: {
          agent: { select: { id: true, displayName: true, agentClass: true } },
        },
      },
      outcomes: true,
    },
  });
}

export const loadArenaBattlesResult = cache(async (): Promise<ArenaBattlesResult> => {
  try {
    return { rows: await queryArenaBattles(), error: null };
  } catch (e) {
    console.error("[paper-lab] loadArenaBattles failed:", e);
    // Không nuốt lỗi: "truy vấn hỏng" và "chưa có trận nào" là hai trạng thái
    // khác nhau, và UI phải phân biệt được để hiện bằng chứng thay vì ô rỗng.
    return { rows: [], error: `prisma.arenaBattle.findMany → ${String(e)}` };
  }
});

/** Bản chỉ lấy hàng, cho nơi gọi không cần phân biệt lỗi với rỗng. */
export const loadArenaBattles = cache(async () => (await loadArenaBattlesResult()).rows);
