/**
 * Market Memory persistence + computation job.
 *
 * `computeAndPersistMarketMemory` derives per-style setup outcomes from the
 * symbol universe's bars and writes one MarketMemoryDaily row for the session.
 * `loadMarketMemory` reads the most recent row dated <= (asOf - 1 day), so a
 * decision at S never reads memory computed on S (no lookahead).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  computeMarketMemory,
  deriveSetupOutcomes,
  type MarketMemory,
  type SetupOutcomeRecord,
} from "@/lib/paper-lab/dna/market-memory";

function toBars(rows: { date: Date; open: number; high: number; low: number; close: number; volume: number }[]): Gate2BarInput[] {
  return rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
}

export async function computeAndPersistMarketMemory(
  prisma: PrismaClient,
  sessionDate: Date,
  symbols: string[]
): Promise<MarketMemory> {
  const asOf = sessionDate.toISOString().slice(0, 10);
  const indexRows = await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX", date: { lte: sessionDate } },
    orderBy: { date: "asc" },
    take: 400,
  });
  const indexBars = indexRows.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));

  const records: SetupOutcomeRecord[] = [];
  for (const symbol of symbols) {
    const stock = await prisma.stockSymbol.findUnique({
      where: { symbol },
      include: { bars: { where: { date: { lte: sessionDate } }, orderBy: { date: "asc" }, take: 400 } },
    });
    if (!stock || stock.bars.length < 60) continue;
    records.push(...deriveSetupOutcomes(toBars(stock.bars), indexBars));
  }

  const memory = computeMarketMemory(records, asOf, indexBars);
  await prisma.marketMemoryDaily.upsert({
    where: { sessionDate },
    update: { memoryJson: memory as object },
    create: { sessionDate, memoryJson: memory as object },
  });
  return memory;
}

/** Load the latest memory row strictly before `sessionDate` (no lookahead). */
export async function loadMarketMemory(prisma: PrismaClient, sessionDate: Date): Promise<MarketMemory | null> {
  const row = await prisma.marketMemoryDaily.findFirst({
    where: { sessionDate: { lt: sessionDate } },
    orderBy: { sessionDate: "desc" },
  });
  return row ? (row.memoryJson as unknown as MarketMemory) : null;
}
