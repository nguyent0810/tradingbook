import type { PrismaClient } from "@/generated/prisma/client";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";

/** Latest close per symbolId, through `throughDate` inclusive — for watchlist zone-distance display. */
export async function buildLatestCloseBySymbol(
  prisma: PrismaClient,
  symbolIds: readonly string[],
  throughDate: Date
): Promise<Map<string, number>> {
  const barsBySymbol = await fetchStockBarsGroupedAscThroughDate(prisma, symbolIds, throughDate);
  const latestClose = new Map<string, number>();
  for (const [symbolId, bars] of barsBySymbol) {
    const last = bars[bars.length - 1];
    if (last) latestClose.set(symbolId, last.close);
  }
  return latestClose;
}
