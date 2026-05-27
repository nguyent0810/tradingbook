/**
 * Read-only per-symbol scanner pipeline diagnostic.
 * Usage: SMOKE_DATABASE=production npx tsx scripts/symbol-case-diagnostic.ts VND PDR
 */
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is unset. Set SMOKE_DATABASE=production with .env.prod.local.");
    process.exit(1);
  }

  const symbols = process.argv.slice(2).map((s) => s.trim().toUpperCase());
  if (symbols.length === 0) {
    console.error("Usage: SMOKE_DATABASE=production npx tsx scripts/symbol-case-diagnostic.ts VND PDR");
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const { describeDatabaseUrl } = await import("./load-env");
  const { getExpectedLatestSessionFromIndexBars } = await import(
    "../src/lib/scanner/expected-session"
  );
  const { getMarketRegimeFromDb } = await import(
    "../src/lib/playbook/get-market-regime"
  );
  const { evaluateTradability } = await import("../src/lib/scanner/tradability");
  const { tradedValueVnd, equityPriceToVnd } = await import(
    "../src/lib/scanner/price-units"
  );
  const { evaluateBreakoutPullbackCandidate } = await import(
    "../src/lib/scanner/gate2/breakout-pullback"
  );
  const { categorizeTerminalReason, terminalGate2Reason } = await import(
    "../src/lib/scanner/gate2-scan-diagnostics"
  );
  const {
    classifyFreshBreakout,
    computeFreshBreakoutMetrics,
    determineFreshBreakoutGroup,
    shouldIncludeFreshBreakoutRow,
  } = await import("../src/lib/scanner/fresh-breakout-audit");
  const { computeEffectiveScanUniverse, listActiveTacticalSymbols } =
    await import("../src/lib/tactical-universe");
  const { getLatestDailyScanRun, toCandidateRows } = await import(
    "../src/lib/scanner/setups-queries"
  );
  const { TRADABILITY_ROLLING_DAYS } = await import(
    "../src/lib/scanner/tradability-constants"
  );
  const { filterCandidatesByGate1Level } = await import(
    "../src/lib/scanner/gate2/collect-candidates"
  );

  console.error("symbol-case-diagnostic.ts → DATABASE_URL:", describeDatabaseUrl());

  const mean = (nums: number[]) =>
    nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  const regime = await getMarketRegimeFromDb("VNINDEX");
  const gate1Level = regime.level as "PASS" | "WARNING" | "FAIL";

  const coreSymbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
  });
  const tacticalSymbols = await listActiveTacticalSymbols(prisma);
  const tacticalKeys = [...new Set(tacticalSymbols.map((t) => t.symbol.trim().toUpperCase()))];
  const tacticalStockRows =
    tacticalKeys.length === 0
      ? []
      : await prisma.stockSymbol.findMany({
          where: { symbol: { in: tacticalKeys } },
          select: { id: true, symbol: true },
        });
  const stockIdBySymbol = new Map(
    tacticalStockRows.map((s) => [s.symbol.trim().toUpperCase(), s.id] as const)
  );
  const universe = computeEffectiveScanUniverse({
    coreRows: coreSymbols,
    tacticalRows: tacticalSymbols.map((t) => ({
      tacticalId: t.id,
      tacticalSymbol: t.symbol,
      stockSymbolId: stockIdBySymbol.get(t.symbol.trim().toUpperCase()) ?? null,
    })),
  });

  const latestScan = await getLatestDailyScanRun();
  const surfaced = toCandidateRows(latestScan);

  const indexLatest = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX" },
    orderBy: { date: "desc" },
    select: { date: true, close: true },
  });
  const equityMax = await prisma.stockDailyBar.aggregate({
    _max: { date: true },
    _count: true,
  });

  const symbolResults = [];
  for (const symbolKey of symbols) {
    const stock = await prisma.stockSymbol.findFirst({
      where: { symbol: symbolKey },
      select: { id: true, symbol: true, active: true, name: true },
    });

    if (!stock) {
      symbolResults.push({ symbol: symbolKey, error: "NOT_IN_STOCK_SYMBOLS" });
      continue;
    }

    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: stock.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    const latest = bars[bars.length - 1] ?? null;
    const last20 = bars.slice(-TRADABILITY_ROLLING_DAYS);
    const tradability = expectedLatestSession
      ? evaluateTradability(
          bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
          expectedLatestSession
        )
      : { passed: false, reasons: ["No expected session from VNINDEX"] };

    let gate2: Awaited<ReturnType<typeof evaluateBreakoutPullbackCandidate>> | null =
      null;
    let gate2TerminalCategory: string | null = null;
    if (expectedLatestSession && bars.length >= 50) {
      gate2 = evaluateBreakoutPullbackCandidate(bars, expectedLatestSession);
      if (gate2.quality === "INVALID") {
        gate2TerminalCategory = categorizeTerminalReason(
          terminalGate2Reason(gate2)
        ).category;
      }
    }

    const wouldSurface =
      gate2 &&
      gate2.quality !== "INVALID" &&
      filterCandidatesByGate1Level(gate1Level, [
        {
          symbolId: stock.id,
          quality: gate2.quality,
          close: gate2.close,
          rankScore: gate2.rankScore,
          breakoutLevel: gate2.breakoutLevel,
          pullbackZoneLow: gate2.pullbackZoneLow,
          pullbackZoneHigh: gate2.pullbackZoneHigh,
          stopLevel: gate2.stopLevel,
          reasons: gate2.reasons,
          barDate: gate2.barDate,
        },
      ]).length > 0;

    const freshMetrics =
      expectedLatestSession &&
      computeFreshBreakoutMetrics({
        bars: bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
        expectedLatestSession,
      });
    const freshClassification = freshMetrics
      ? classifyFreshBreakout({
          metrics: freshMetrics,
          tradability,
          recentBars: bars.map((b) => ({
            date: b.date,
            close: b.close,
            volume: b.volume,
          })),
        })
      : null;
    const freshGroup = freshClassification
      ? determineFreshBreakoutGroup({
          tradabilityPassed: tradability.passed,
          staleSession: freshMetrics!.staleSession,
          labels: freshClassification.labels,
        })
      : null;
    const momentumWatchIncluded = freshClassification
      ? shouldIncludeFreshBreakoutRow(
          {
            labels: freshClassification.labels,
            tradabilityPassed: tradability.passed,
            staleSession: freshMetrics!.staleSession,
          },
          { tradableOnly: true, includeFailedRisk: false }
        ) &&
        freshGroup !== "AVOID_RISK" &&
        freshGroup !== "COVERAGE_TRADABILITY_BLOCKED"
      : false;

    const tactical = await prisma.tacticalSymbol.findFirst({
      where: { symbol: symbolKey },
      select: { status: true, activeForScanner: true, expiresAt: true },
    });

    const inLatestScanCandidate = latestScan
      ? await prisma.setupCandidate.findFirst({
          where: { symbolId: stock.id, scanRunId: latestScan.id },
          select: { quality: true, rankScore: true, barDate: true, reasons: true },
        })
      : null;

    symbolResults.push({
      symbol: symbolKey,
      name: stock.name,
      active: stock.active,
      inEffectiveUniverse: universe.symbols.some((u) => u.symbol === symbolKey),
      universeSource:
        universe.symbols.find((u) => u.symbol === symbolKey)?.universeSource ?? null,
      tactical: tactical ?? null,
      barCount: bars.length,
      latestBarDate: latest?.date.toISOString() ?? null,
      latestCloseThousandVnd: latest?.close ?? null,
      latestCloseNominalVnd: latest ? equityPriceToVnd(latest.close) : null,
      latestVolume: latest?.volume ?? null,
      avgVol20: last20.length > 0 ? mean(last20.map((b) => b.volume)) : null,
      avgValue20Vnd:
        last20.length > 0
          ? mean(last20.map((b) => tradedValueVnd(b.close, b.volume)))
          : null,
      sessionAligned:
        latest &&
        expectedLatestSession &&
        latest.date.toISOString().slice(0, 10) ===
          expectedLatestSession.toISOString().slice(0, 10),
      tradability,
      gate2: gate2
        ? {
            quality: gate2.quality,
            rankScore: gate2.rankScore,
            terminalCategory: gate2TerminalCategory,
            terminalReason:
              gate2.quality === "INVALID" ? terminalGate2Reason(gate2) : null,
            lastReason: gate2.reasons[gate2.reasons.length - 1] ?? null,
          }
        : {
            quality: "NOT_EVALUATED",
            reason: expectedLatestSession
              ? "Insufficient bars for Gate 2 (<50)"
              : "No expected session",
          },
      gate1Level,
      wouldSurfaceAtScanTime: wouldSurface,
      freshBreakout: freshMetrics
        ? {
            closeAbovePrior20DayHigh: freshMetrics.closeAbovePriorNDayHigh,
            volumeRatio20: freshMetrics.volumeRatio20,
            breakoutExtensionPct: freshMetrics.breakoutExtensionPct,
            aboveMa20: freshMetrics.aboveMa20,
            aboveMa50: freshMetrics.aboveMa50,
            staleSession: freshMetrics.staleSession,
            labels: freshClassification?.labels ?? [],
            riskAnnotations: freshClassification?.riskAnnotations ?? [],
            group: freshGroup,
            momentumWatchIncluded,
          }
        : null,
      inLatestScanCandidate: inLatestScanCandidate ?? null,
    });
  }

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        databaseUrlHint: describeDatabaseUrl(),
        marketContext: {
          expectedLatestSession: expectedLatestSession?.toISOString() ?? null,
          gate1Level,
          gate1Reasons: regime.reasons,
          vnindexLatest: indexLatest?.date.toISOString() ?? null,
          equityMaxDate: equityMax._max.date?.toISOString() ?? null,
          equityBarCount: equityMax._count,
        },
        scanContext: latestScan
          ? {
              scanRunId: latestScan.id,
              runAt: latestScan.runAt.toISOString(),
              gate1Level: latestScan.gate1Level,
              symbolCountTotal: latestScan.symbolCountTotal,
              symbolCountAfterTradability: latestScan.symbolCountAfterTradability,
              candidateCountSurfaced: latestScan.candidateCountSurfaced,
              surfacedSymbols: surfaced.map((c) => c.symbolKey),
            }
          : null,
        universe: { effectiveCount: universe.stats.effectiveCount },
        symbols: symbolResults,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
