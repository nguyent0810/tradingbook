/**
 * Build market_context_daily + symbol_market_context_daily for a session.
 *
 * Usage:
 *   npx tsx scripts/build-market-context.ts
 *   npx tsx scripts/build-market-context.ts --session-date 2026-06-03
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import {
  computeMarketForeignRollup,
  computeSymbolForeignRollup,
  computeSymbolVolumeContext,
  computeVnindexContext,
  type DailyBarPoint,
  type ForeignDailyPoint,
} from "../src/lib/market/compute-market-context";
import { isoDayUtc, parseSessionDateUtc } from "../src/lib/market/session-date";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { loadEffectiveScanUniverse } from "../src/lib/tactical-universe";

function parseSessionDateArg(argv: string[]): string | undefined {
  const flag = argv.find((a) => a.startsWith("--session-date="));
  if (flag) return flag.slice("--session-date=".length);
  const idx = argv.indexOf("--session-date");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    throw new Error("No VNINDEX session — import index bars first.");
  }

  const sessionDay = parseSessionDateArg(argv) ?? isoDayUtc(expected);
  const sessionDate = parseSessionDateUtc(sessionDay);
  if (isoDayUtc(sessionDate) !== isoDayUtc(expected)) {
    throw new Error(
      `Session ${sessionDay} does not match expected VNINDEX session ${isoDayUtc(expected)}`
    );
  }

  const universe = await loadEffectiveScanUniverse(prisma);
  const symbolIds = universe.symbols
    .map((s) => s.stockSymbolId)
    .filter((id): id is string => Boolean(id));

  const indexBars = await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX", date: { lte: sessionDate } },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });

  const indexPoints: DailyBarPoint[] = indexBars.map((b) => ({
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  const vnindex = computeVnindexContext(indexPoints, sessionDate);

  const priorMarketRows = await prisma.marketContextDaily.findMany({
    where: { sessionDate: { lt: sessionDate } },
    orderBy: { sessionDate: "asc" },
    select: { sessionDate: true, foreignNetValue1d: true },
  });

  const foreignHistoryBySymbol = new Map<string, ForeignDailyPoint[]>();
  if (symbolIds.length > 0) {
    const foreignRows = await prisma.foreignTradeDaily.findMany({
      where: {
        symbolId: { in: symbolIds },
        sessionDate: { lte: sessionDate },
      },
      orderBy: { sessionDate: "asc" },
      select: {
        symbolId: true,
        sessionDate: true,
        netValueVnd: true,
        dataQuality: true,
      },
    });
    for (const row of foreignRows) {
      const list = foreignHistoryBySymbol.get(row.symbolId) ?? [];
      list.push({
        sessionDate: row.sessionDate,
        netValueVnd: row.netValueVnd,
        dataQuality: row.dataQuality,
      });
      foreignHistoryBySymbol.set(row.symbolId, list);
    }
  }

  const symbolRollups = [];
  const symbolWrites: Array<{
    symbolId: string;
    volCtx: ReturnType<typeof computeSymbolVolumeContext>;
    foreignRollup: ReturnType<typeof computeSymbolForeignRollup>;
  }> = [];

  for (const u of universe.symbols) {
    if (!u.stockSymbolId) continue;

    const stockBars = await prisma.stockDailyBar.findMany({
      where: { symbolId: u.stockSymbolId, date: { lte: sessionDate } },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    });

    const barPoints: DailyBarPoint[] = stockBars.map((b) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));

    const volCtx = computeSymbolVolumeContext(barPoints, sessionDate);
    const foreignHistory = foreignHistoryBySymbol.get(u.stockSymbolId) ?? [];
    const foreignRollup = computeSymbolForeignRollup(foreignHistory, sessionDate);

    symbolWrites.push({
      symbolId: u.stockSymbolId,
      volCtx,
      foreignRollup,
    });
    symbolRollups.push(foreignRollup);
  }

  const symbolsBuilt = symbolWrites.length;

  const marketForeign = computeMarketForeignRollup({
    symbolRollups,
    marketHistory1d: priorMarketRows.map((r) => ({
      sessionDate: r.sessionDate,
      foreignNetValue1d: r.foreignNetValue1d,
    })),
    sessionDate,
  });

  await prisma.marketContextDaily.upsert({
    where: { sessionDate },
    create: {
      sessionDate,
      vnindexClose: vnindex.vnindexClose,
      vnindexMa20: vnindex.vnindexMa20,
      vnindexMa50: vnindex.vnindexMa50,
      vnindexVolume: vnindex.vnindexVolume,
      vnindexVolMa20: vnindex.vnindexVolMa20,
      vnindexVolRatioMa20: vnindex.vnindexVolRatioMa20,
      gate1Level: vnindex.gate1Level,
      foreignNetValue1d: marketForeign.foreignNetValue1d,
      foreignNetValue5d: marketForeign.foreignNetValue5d,
      foreignNetValue10d: marketForeign.foreignNetValue10d,
      foreignSymbolsOk: marketForeign.foreignSymbolsOk,
      foreignSymbolsTotal: marketForeign.foreignSymbolsTotal,
      foreignCoveragePct: marketForeign.foreignCoveragePct,
      symbolsBuilt,
    },
    update: {
      vnindexClose: vnindex.vnindexClose,
      vnindexMa20: vnindex.vnindexMa20,
      vnindexMa50: vnindex.vnindexMa50,
      vnindexVolume: vnindex.vnindexVolume,
      vnindexVolMa20: vnindex.vnindexVolMa20,
      vnindexVolRatioMa20: vnindex.vnindexVolRatioMa20,
      gate1Level: vnindex.gate1Level,
      foreignNetValue1d: marketForeign.foreignNetValue1d,
      foreignNetValue5d: marketForeign.foreignNetValue5d,
      foreignNetValue10d: marketForeign.foreignNetValue10d,
      foreignSymbolsOk: marketForeign.foreignSymbolsOk,
      foreignSymbolsTotal: marketForeign.foreignSymbolsTotal,
      foreignCoveragePct: marketForeign.foreignCoveragePct,
      symbolsBuilt,
      builtAt: new Date(),
    },
  });

  for (const write of symbolWrites) {
    await prisma.symbolMarketContextDaily.upsert({
      where: {
        sessionDate_symbolId: {
          sessionDate,
          symbolId: write.symbolId,
        },
      },
      create: {
        sessionDate,
        symbolId: write.symbolId,
        close: write.volCtx?.close ?? null,
        volume: write.volCtx?.volume ?? null,
        volMa20: write.volCtx?.volMa20 ?? null,
        volRatioMa20: write.volCtx?.volRatioMa20 ?? null,
        foreignNetValue1d: write.foreignRollup.foreignNetValue1d,
        foreignNetValue5d: write.foreignRollup.foreignNetValue5d,
        foreignNetValue10d: write.foreignRollup.foreignNetValue10d,
        foreignDataQuality: write.foreignRollup.foreignDataQuality,
      },
      update: {
        close: write.volCtx?.close ?? null,
        volume: write.volCtx?.volume ?? null,
        volMa20: write.volCtx?.volMa20 ?? null,
        volRatioMa20: write.volCtx?.volRatioMa20 ?? null,
        foreignNetValue1d: write.foreignRollup.foreignNetValue1d,
        foreignNetValue5d: write.foreignRollup.foreignNetValue5d,
        foreignNetValue10d: write.foreignRollup.foreignNetValue10d,
        foreignDataQuality: write.foreignRollup.foreignDataQuality,
      },
    });
  }

  console.error("");
  console.error("=== build-market-context summary ===");
  console.error(
    JSON.stringify(
      {
        sessionDate: sessionDay,
        symbolsBuilt,
        foreignNetValue1d: marketForeign.foreignNetValue1d,
        foreignNetValue5d: marketForeign.foreignNetValue5d,
        foreignNetValue10d: marketForeign.foreignNetValue10d,
        gate1Level: vnindex.gate1Level,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
