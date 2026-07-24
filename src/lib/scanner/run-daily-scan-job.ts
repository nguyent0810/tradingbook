import {
  DailyScanRunStatus,
  Gate1ScanLevel,
  PrismaClient,
  ScanQuality,
  ScanSetupType,
} from "@/generated/prisma/client";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2";
import { deriveGate1SurfacingRule } from "@/lib/scanner/gate2/collect-candidates";
import {
  buildGate2ScanDiagnosticsSummary,
  toDailyScanGate2Notes,
  type Gate2DiagnosticEvaluationRow,
} from "@/lib/scanner/gate2-scan-diagnostics";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  computeDailyTradingDecision,
  toPersistedDailyDecision,
} from "@/lib/scanner/trading-decision";
import {
  aggregateTradabilityResults,
  evaluateTradabilityForSymbolId,
} from "@/lib/scanner/tradability";
import type { SetupCandidate } from "@/lib/scanner/gate2/types";
import {
  evaluateAndPersistHealthForActiveWatchItems,
  syncWatchItemsFromSurfacedCandidates,
} from "@/lib/setup-health";
import { evaluateAndPersistHealthForOpenTrades } from "@/lib/trades/persist-trade-health";
import {
  loadEffectiveScanUniverse,
  type UniverseSource,
} from "@/lib/tactical-universe";
import { isBenchmarkStaleVsEquity } from "@/lib/market/market-data-freshness-report";
import { computeScanSessionCoverage } from "@/lib/scanner/scan-session-coverage";
import { serializeSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";

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

export type DailyScanJobOutcome =
  | {
      ok: true;
      kind: "COMPLETED";
      summaryJson: Record<string, unknown>;
    }
  | {
      ok: true;
      kind: "FAILED_NO_INDEX_SESSION";
      summaryJson: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

function resolveScanLimit(envScanLimit: string | undefined): number {
  const raw = envScanLimit?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Core persistence path shared by `run-daily-scanner.ts` and `/api/cron/daily-scan`.
 * Uses existing bars/regime only — same semantics as the CLI scanner (rules unchanged).
 */
export async function runDailyScanJob(
  prisma: PrismaClient,
  options?: { scanSymbolLimit?: number }
): Promise<DailyScanJobOutcome> {
  const scanLimit =
    options?.scanSymbolLimit ?? resolveScanLimit(process.env.SCAN_SYMBOL_LIMIT);
  const startedAt = new Date();

  try {
    const expectedLatestSession =
      await getExpectedLatestSessionFromIndexBars(prisma);
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
              explanation:
                "Cannot evaluate — no VNINDEX session in database. Import index bars first.",
            },
          },
        },
      });
      return {
        ok: true,
        kind: "FAILED_NO_INDEX_SESSION",
        summaryJson: {
          status: "FAILED",
          errorSummary: "No VNINDEX session date in database.",
        },
      };
    }

    const regime = await getMarketRegimeFromDb();
    const gate1Level = toGate1ScanLevel(regime.level);
    const effectiveUniverse = await loadEffectiveScanUniverse(prisma, startedAt);
    const symbolsToScan =
      scanLimit > 0
        ? effectiveUniverse.symbols.slice(0, scanLimit)
        : effectiveUniverse.symbols;
    const totalSymbols = symbolsToScan.length;

    const selectedSourceCounts = symbolsToScan.reduce(
      (acc, row) => {
        acc[row.universeSource] = (acc[row.universeSource] ?? 0) + 1;
        return acc;
      },
      { CORE: 0, TACTICAL: 0, BOTH: 0 } as Record<UniverseSource, number>
    );

    console.info("[runDailyScanJob] universe_merge", {
      ...effectiveUniverse.stats,
      selectedForScanCount: totalSymbols,
      selectedSourceCounts,
      scanSymbolLimit: scanLimit > 0 ? scanLimit : null,
    });
    const tradItems: Array<{
      symbolId: string;
      symbolKey: string;
      universeSource: UniverseSource;
      result: { passed: boolean; reasons: string[] };
    }> = [];
    const failedSymbolKeys = new Set<string>();
    const failedSymbolErrors: Array<{
      symbol: string;
      stage: "tradability" | "gate2";
      error: string;
    }> = [];

    for (const symbol of symbolsToScan) {
      try {
        const result = await evaluateTradabilityForSymbolId(
          prisma,
          symbol.symbolId,
          expectedLatestSession
        );
        tradItems.push({
          symbolId: symbol.symbolId,
          symbolKey: symbol.symbol,
          universeSource: symbol.universeSource,
          result,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        failedSymbolKeys.add(symbol.symbol);
        failedSymbolErrors.push({
          symbol: symbol.symbol,
          stage: "tradability",
          error: message,
        });
      }
    }

    const aggregate = aggregateTradabilityResults(
      tradItems.map((item) => ({ symbolKey: item.symbolKey, result: item.result }))
    );
    const sessionCoverage = computeScanSessionCoverage({
      expectedLatestSession,
      universeScanned: totalSymbols,
      tradabilityItems: tradItems,
    });
    if (sessionCoverage.weakCoverage) {
      console.warn("[runDailyScanJob] weak_session_coverage", {
        expectedSession: sessionCoverage.expectedSessionDate,
        staleSessionCount: sessionCoverage.staleSessionCount,
        tradabilityEvaluated: sessionCoverage.tradabilityEvaluated,
        staleSessionFrac: sessionCoverage.staleSessionFrac,
      });
    }
    const tradableSymbolIds = tradItems
      .filter((item) => item.result.passed)
      .map((item) => item.symbolId);

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

        const surfacingRule = deriveGate1SurfacingRule(regime.level as Gate1Level);
        if (surfacingRule === "none") continue;
        if (surfacingRule === "tier-a-only" && ev.quality !== "A") continue;

        surfaced.push({
          symbolId,
          quality: ev.quality,
          close: ev.close,
          rankScore: ev.rankScore,
          rankComponents: ev.rankComponents,
          breakoutLevel: ev.breakoutLevel,
          pullbackZoneLow: ev.pullbackZoneLow,
          pullbackZoneHigh: ev.pullbackZoneHigh,
          stopLevel: ev.stopLevel,
          reasons: ev.reasons,
          barDate: ev.barDate,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        failedSymbolKeys.add(symbolKey);
        failedSymbolErrors.push({
          symbol: symbolKey,
          stage: "gate2",
          error: message,
        });
      }
    }

    const diagnostics =
      buildGate2ScanDiagnosticsSummary(diagnosticRows);

    const tradingDecision = computeDailyTradingDecision({
      gate1Level: regime.level as Gate1Level,
      candidateCountA,
      candidateCountB,
    });

    const equityMaxRow = await prisma.stockDailyBar.aggregate({
      _max: { date: true },
    });
    const equityMaxDate = equityMaxRow._max.date;
    const delayedBackdrop = isBenchmarkStaleVsEquity(
      expectedLatestSession,
      equityMaxDate
    );
    if (delayedBackdrop) {
      console.warn("[runDailyScanJob] benchmark_backdrop_delayed", {
        vnindexSession: expectedLatestSession.toISOString().slice(0, 10),
        equityBarsMax: equityMaxDate?.toISOString().slice(0, 10) ?? null,
      });
    }

    const scanNotes = {
      ...toDailyScanGate2Notes(diagnostics),
      decision: toPersistedDailyDecision(tradingDecision),
      benchmarkBackdrop: {
        vnindexSessionDate: expectedLatestSession.toISOString().slice(0, 10),
        equityBarsMaxDate: equityMaxDate
          ? equityMaxDate.toISOString().slice(0, 10)
          : null,
        delayedBackdrop,
      },
      sessionCoverage,
    };
    const failedCount = failedSymbolKeys.size;
    const scannedCount = Math.max(0, totalSymbols - failedCount);
    const finishedAt = new Date();

    const selectedSymbolSet = new Set(
      symbolsToScan.map((s) => s.symbol.trim().toUpperCase())
    );
    const selectedTacticalIds = effectiveUniverse.tacticalRows
      .filter((t) => selectedSymbolSet.has(t.symbol.trim().toUpperCase()))
      .map((t) => t.id);

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
            reasons: serializeSetupCandidateReasons(c.reasons, c.rankComponents),
            rankScore: c.rankScore,
            barDate: c.barDate,
          })),
        });
        candidatesInserted = result.count;
      }

      if (selectedTacticalIds.length > 0) {
        await tx.tacticalSymbol.updateMany({
          where: {
            id: { in: selectedTacticalIds },
            status: "ACTIVE",
            activeForScanner: true,
            expiresAt: { gt: startedAt },
          },
          data: { lastEvaluatedAt: finishedAt },
        });
      }

      return { run, candidatesInserted };
    });

    if (surfaced.length > 0) {
      await syncWatchItemsFromSurfacedCandidates(
        prisma,
        summary.run.id,
        surfaced
      );
    }
    await evaluateAndPersistHealthForActiveWatchItems(
      prisma,
      expectedLatestSession
    );
    await evaluateAndPersistHealthForOpenTrades(prisma, expectedLatestSession);

    const failedPreview = [...failedSymbolKeys].slice(0, 10);
    const summaryJson: Record<string, unknown> = {
      scanRunId: summary.run.id,
      runAt: summary.run.runAt.toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      scanSymbolLimit: scanLimit > 0 ? scanLimit : null,
      expectedLatestSession: expectedLatestSession.toISOString(),
      universeMerge: {
        ...effectiveUniverse.stats,
        selectedForScanCount: totalSymbols,
        selectedSourceCounts,
      },
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
      benchmarkBackdrop: scanNotes.benchmarkBackdrop,
      sessionCoverage,
      persistedNotesKeys: Object.keys(scanNotes),
    };

    return { ok: true, kind: "COMPLETED", summaryJson };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[runDailyScanJob]", e);
    return { ok: false, error };
  }
}
