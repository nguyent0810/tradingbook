import type { PrismaClient } from "@/generated/prisma/client";
import { evaluateTradeHealth } from "./evaluate-trade-health";
import type { LatestTradeHealthLog, SetupLevelsSnapshot } from "./open-position-intelligence";

function parseSetupLevelsSnapshot(json: unknown): SetupLevelsSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const { breakoutLevel, pullbackZoneLow, pullbackZoneHigh } = obj;
  if (
    typeof breakoutLevel !== "number" ||
    typeof pullbackZoneLow !== "number" ||
    typeof pullbackZoneHigh !== "number"
  ) {
    return null;
  }
  return { breakoutLevel, pullbackZoneLow, pullbackZoneHigh };
}

/**
 * Nightly checkpoint for every OPEN trade — mirrors
 * `setup-health/persist-watch-health.ts`'s per-item, error-isolated loop so
 * one bad row (deleted symbol, transient DB blip) never aborts the batch.
 * Writes one append-only `TradeHealthLog` row per trade per run.
 */
export async function evaluateAndPersistHealthForOpenTrades(
  prisma: PrismaClient,
  evalBarDate: Date,
  now: Date = new Date()
): Promise<{ updated: number }> {
  const trades = await prisma.trade.findMany({
    where: { status: "OPEN" },
    include: {
      healthLogs: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });

  if (trades.length === 0) return { updated: 0 };

  const tickers = [...new Set(trades.map((t) => t.symbol))];
  const symbolRows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: tickers } },
    select: { id: true, symbol: true },
  });
  const symbolIdByTicker = new Map(symbolRows.map((r) => [r.symbol, r.id] as const));

  const symbolIds = [...symbolIdByTicker.values()];
  const barRows =
    symbolIds.length > 0
      ? await prisma.stockDailyBar.findMany({
          where: { symbolId: { in: symbolIds }, date: { lte: evalBarDate } },
          orderBy: { date: "desc" },
          select: { symbolId: true, date: true, close: true },
        })
      : [];
  const latestBarBySymbolId = new Map<string, { date: Date; close: number }>();
  for (const r of barRows) {
    if (!latestBarBySymbolId.has(r.symbolId)) {
      latestBarBySymbolId.set(r.symbolId, { date: r.date, close: r.close });
    }
  }

  let updated = 0;

  for (const t of trades) {
    try {
      const symbolId = symbolIdByTicker.get(t.symbol);
      const latestBar = symbolId != null ? (latestBarBySymbolId.get(symbolId) ?? null) : null;
      const setupLevels = parseSetupLevelsSnapshot(t.setupSnapshot);

      const lastLog = t.healthLogs[0];
      const latestHealthLog: LatestTradeHealthLog | null = lastLog
        ? {
            healthLevel: lastLog.healthLevel,
            structureStatus: lastLog.structureStatus,
            checkedAt: lastLog.checkedAt,
            reviewChecklist: null,
            reviewOutcome: null,
          }
        : null;

      const result = evaluateTradeHealth({
        direction: t.direction,
        entryPrice: t.entryPrice,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        latestClose: latestBar?.close ?? null,
        latestBarDate: latestBar?.date ?? null,
        evalBarDate,
        setupLevels,
        latestHealthLog,
      });

      await prisma.tradeHealthLog.create({
        data: {
          tradeId: t.id,
          checkedAt: now,
          healthLevel: result.healthLevel,
          healthScore: null,
          priceVsZone: result.priceVsZone,
          structureStatus: result.structureStatus,
          recommendedAction: result.recommendedAction,
        },
      });
      updated++;
    } catch (e) {
      console.error(`[trades] evaluateAndPersistHealthForOpenTrades failed for tradeId=${t.id}:`, e);
    }
  }

  return { updated };
}
