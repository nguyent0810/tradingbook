import type { PrismaClient } from "@/generated/prisma/client";
import type { OhlcvBar } from "./types";

/** Daily bars per symbol, ascending date, through `throughDate` inclusive. */
export async function fetchStockBarsGroupedAscThroughDate(
  prisma: PrismaClient,
  symbolIds: readonly string[],
  throughDate: Date
): Promise<Map<string, OhlcvBar[]>> {
  if (symbolIds.length === 0) return new Map();

  const rows = await prisma.stockDailyBar.findMany({
    where: {
      symbolId: { in: [...symbolIds] },
      date: { lte: throughDate },
    },
    orderBy: [{ symbolId: "asc" }, { date: "asc" }],
    select: {
      symbolId: true,
      date: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  const map = new Map<string, OhlcvBar[]>();
  for (const r of rows) {
    const bar: OhlcvBar = {
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    };
    const list = map.get(r.symbolId);
    if (list) list.push(bar);
    else map.set(r.symbolId, [bar]);
  }
  return map;
}
