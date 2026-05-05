/**
 * Resolve Gate 1 (VNINDEX), tradability, Gate 2 candidates, persist DailyScanRun + SetupCandidate.
 * Does not fetch new stock data — uses existing IndexDailyBar / StockDailyBar.
 *
 * Usage: npx tsx scripts/run-daily-scanner.ts
 */
import "./load-env";
import {
  DailyScanRunStatus,
  Gate1ScanLevel,
  ScanQuality,
  ScanSetupType,
} from "../src/generated/prisma/client";
import { describeDatabaseUrl } from "./load-env";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";
import { prisma } from "../src/lib/prisma";
import type { Gate1Level } from "../src/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "../src/lib/scanner/gate2";
import {
  buildGate2ScanDiagnosticsSummary,
  toDailyScanGate2Notes,
  type Gate2DiagnosticEvaluationRow,
} from "../src/lib/scanner/gate2-scan-diagnostics";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import {
  computeDailyTradingDecision,
  toPersistedDailyDecision,
} from "../src/lib/scanner/trading-decision";
import {
  aggregateTradabilityResults,
  evaluateTradabilityForSymbolId,
} from "../src/lib/scanner/tradability";
import {
  evaluateAndPersistHealthForActiveWatchItems,
  syncWatchItemsFromSurfacedCandidates,
} from "../src/lib/setup-health";
import type { SetupCandidate } from "../src/lib/scanner/gate2/types";

function toGate1ScanLevel(level: string): Gate1ScanLevel {
  switch (level) {
    case "PASS":
      return Gate1ScanLevel.PASS;
    case "WARNING":
      return Gate1ScanLevel.WARNING;
    case "FAIL":
      return Gate1ScanLevel.FAIL;
    default:
      return Gate1ScanLevel.WARNING;
  }
}

async function main() {
  console.log("run-daily-scanner.ts → DATABASE_URL:", describeDatabaseUrl());
  const startedAt = new Date();
  const scanLimitRaw = process.env.SCAN_SYMBOL_LIMIT?.trim();
  const scanLimit =
    scanLimitRaw && Number.isFinite(Number(scanLimitRaw)) && Number(scanLimitRaw) > 0
      ? Math.floor(Number(scanLimitRaw))
      : 0;

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    const finishedAt = new Date();
    await prisma.dailyScanRun.create({
      data: {
        startedAt,
        finishedAt,
        gate1Level: Gate1ScanLevel.WARNING,
        status: DailyScanRunStatus.FAILED,
        symbolCountTotal: 0,
        symbolCountScanned: 0,
        symbolCountFailed: 0,
        symbolCountAfterTradability: 0,
        symbolCountFilteredOut: 0,
        candidateCountA: 0,
        candidateCountB: 0,
        candidateCountSurfaced: 0,
        setupCandidatesCreated: 0,
        errorSummary:
          "No VNINDEX IndexDailyBar rows — cannot resolve expected latest session.",
        notes: {
          decision: {
            level: "NO_TRADE",
            allocation: "0%",
            explanation: "Cannot evaluate — no VNINDEX session in database. Import index bars first.",
          },
        },
      },
    });
    console.log(
      JSON.stringify(
        {
          status: "FAILED",
          errorSummary: "No VNINDEX session date in database.",
          dbRows: { dailyScanRuns: 1, setupCandidates: 0 },
        },
        null,
        2
      )
    );
    return;
  }

  const regime = await getMarketRegimeFromDb();
  const gate1Level = toGate1ScanLevel(regime.level);
  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  const symbolsToScan = scanLimit > 0 ? symbols.slice(0, scanLimit) : symbols;
  const totalSymbols = symbolsToScan.length;
  const tradItems: Array<{ symbolId: string; symbolKey: string; result: { passed: boolean; reasons: string[] } }> =
    [];
  const failedSymbolKeys = new Set<string>();
  const failedSymbolErrors: Array<{ symbol: string; stage: "tradability" | "gate2"; error: string }> = [];

  for (const symbol of symbolsToScan) {
    try {
      const result = await evaluateTradabilityForSymbolId(prisma, symbol.id, expectedLatestSession);
      tradItems.push({
        symbolId: symbol.id,
        symbolKey: symbol.symbol,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedSymbolKeys.add(symbol.symbol);
      failedSymbolErrors.push({ symbol: symbol.symbol, stage: "tradability", error: message });
    }
  }

  const aggregate = aggregateTradabilityResults(
    tradItems.map((item) => ({ symbolKey: item.symbolKey, result: item.result }))
  );
  const tradableSymbolIds = tradItems.filter((item) => item.result.passed).map((item) => item.symbolId);

  const symbolKeyById = new Map(
    tradItems.map((t) => [t.symbolId, t.symbolKey] as const)
  );

  let candidateCountA = 0;
  let candidateCountB = 0;
  const surfaced: SetupCandidate[] = [];
  const diagnosticRows: Gate2DiagnosticEvaluationRow[] = [];

  for (const symbolId of tradableSymbolIds) {
    const symbolKey = symbolKeyById.get(symbolId) ?? symbolId;
    try {
      const rows = await prisma.stockDailyBar.findMany({
        where: { symbolId },
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
      const ev = evaluateBreakoutPullbackCandidate(rows, expectedLatestSession);
      diagnosticRows.push({
        symbol: symbolKey,
        symbolId,
        evaluation: ev,
      });
      if (ev.quality === "INVALID") continue;
      if (ev.quality === "A") candidateCountA++;
      else candidateCountB++;
      if (regime.level === "FAIL") continue;
      if (regime.level === "WARNING" && ev.quality !== "A") continue;

      surfaced.push({
        symbolId,
        quality: ev.quality,
        close: ev.close,
        rankScore: ev.rankScore,
        breakoutLevel: ev.breakoutLevel,
        pullbackZoneLow: ev.pullbackZoneLow,
        pullbackZoneHigh: ev.pullbackZoneHigh,
        stopLevel: ev.stopLevel,
        reasons: ev.reasons,
        barDate: ev.barDate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedSymbolKeys.add(symbolKey);
      failedSymbolErrors.push({ symbol: symbolKey, stage: "gate2", error: message });
    }
  }

  const diagnostics = buildGate2ScanDiagnosticsSummary(diagnosticRows);

  const tradingDecision = computeDailyTradingDecision({
    gate1Level: regime.level as Gate1Level,
    candidateCountA,
    candidateCountB,
  });

  const scanNotes = {
    ...toDailyScanGate2Notes(diagnostics),
    decision: toPersistedDailyDecision(tradingDecision),
  };
  const failedCount = failedSymbolKeys.size;
  const scannedCount = Math.max(0, totalSymbols - failedCount);
  const finishedAt = new Date();

  const summary = await prisma.$transaction(async (tx) => {
    const run = await tx.dailyScanRun.create({
      data: {
        startedAt,
        finishedAt,
        gate1Level,
        status: DailyScanRunStatus.COMPLETED,
        symbolCountTotal: totalSymbols,
        symbolCountScanned: scannedCount,
        symbolCountFailed: failedCount,
        symbolCountAfterTradability: tradableSymbolIds.length,
        symbolCountFilteredOut: aggregate.filteredOut,
        candidateCountA,
        candidateCountB,
        candidateCountSurfaced: surfaced.length,
        setupCandidatesCreated: surfaced.length,
        tradabilityBreakdown: aggregate.breakdownByReason,
        notes: scanNotes,
      },
    });

    let candidatesInserted = 0;
    if (surfaced.length > 0) {
      const result = await tx.setupCandidate.createMany({
        data: surfaced.map((c) => ({
          scanRunId: run.id,
          symbolId: c.symbolId,
          setupType: ScanSetupType.BREAKOUT_PULLBACK,
          quality: c.quality === "A" ? ScanQuality.A : ScanQuality.B,
          close: c.close,
          breakoutLevel: c.breakoutLevel,
          pullbackZoneLow: c.pullbackZoneLow,
          pullbackZoneHigh: c.pullbackZoneHigh,
          stopLevel: c.stopLevel,
          reasons: c.reasons,
          rankScore: c.rankScore,
          barDate: c.barDate,
        })),
      });
      candidatesInserted = result.count;
    }

    return { run, candidatesInserted };
  });

  if (surfaced.length > 0) {
    await syncWatchItemsFromSurfacedCandidates(prisma, summary.run.id, surfaced);
  }
  await evaluateAndPersistHealthForActiveWatchItems(prisma, expectedLatestSession);

  const failedPreview = [...failedSymbolKeys].slice(0, 10);
  const out = {
    scanRunId: summary.run.id,
    runAt: summary.run.runAt.toISOString(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    scanSymbolLimit: scanLimit > 0 ? scanLimit : null,
    expectedLatestSession: expectedLatestSession.toISOString(),
    gate1Level: regime.level,
    tradability: {
      totalSymbols,
      scannedCount,
      failedCount,
      passedTradability: tradableSymbolIds.length,
      filteredOut: aggregate.filteredOut,
      breakdownByReason: aggregate.breakdownByReason,
    },
    symbolCountTotal: totalSymbols,
    symbolCountScanned: scannedCount,
    symbolCountFailed: failedCount,
    symbolCountAfterTradability: tradableSymbolIds.length,
    symbolCountFilteredOut: aggregate.filteredOut,
    candidateCountA,
    candidateCountB,
    candidateCountSurfaced: surfaced.length,
    setupCandidatesInserted: summary.candidatesInserted,
    tradabilityBreakdown: aggregate.breakdownByReason,
    failedSymbols:
      failedPreview.length > 0
        ? {
            preview: failedPreview,
            omitted: Math.max(0, failedCount - failedPreview.length),
          }
        : null,
    failedSymbolErrorsPreview: failedSymbolErrors.slice(0, 5),
    gate2RejectionSummary: {
      invalidCountByCategory: diagnostics.invalidCountByCategory,
      topRejectionCategories: diagnostics.topRejectionCategories,
      topRejectionTerminalReasons: diagnostics.topRejectionTerminalReasons,
    },
    gate2QualityCounts: diagnostics.gate2QualityCounts,
    closestToValidSymbols: diagnostics.closestToValidSymbols,
    recommendation: diagnostics.recommendation,
    tradingDecision,
    persistedNotesKeys: Object.keys(scanNotes),
  };

  console.log(`Scanned ${scannedCount}/${totalSymbols} symbols · ${surfaced.length} setups found · ${failedCount} failed`);
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
