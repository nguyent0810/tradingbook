import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Resolve the **expected last completed EOD session** for tradability freshness checks.
 *
 * **Do not** use `new Date()` / server “today”: Vietnam holidays, weekends, and EOD
 * import lag mean “calendar today” is wrong. After daily index import, the latest
 * `IndexDailyBar` row for the benchmark (default **VNINDEX**) defines the session date
 * all stock bars should match.
 *
 * @returns The latest index bar’s `date` (UTC calendar day as stored), or **null** if no rows.
 */
export async function getExpectedLatestSessionFromIndexBars(
  prisma: PrismaClient,
  symbol = "VNINDEX"
): Promise<Date | null> {
  const row = await prisma.indexDailyBar.findFirst({
    where: { symbol },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!row) return null;
  return row.date;
}
