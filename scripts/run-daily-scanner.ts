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
import { collectGate2SetupCandidatesWithStats } from "../src/lib/scanner/gate2/collect-candidates";
import { toDailyScanGate2Notes } from "../src/lib/scanner/gate2-scan-diagnostics";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import {
  computeDailyTradingDecision,
  toPersistedDailyDecision,
} from "../src/lib/scanner/trading-decision";
import { evaluateTradabilityForAllActiveSymbols } from "../src/lib/scanner/tradability";

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

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    await prisma.dailyScanRun.create({
      data: {
        gate1Level: Gate1ScanLevel.WARNING,
        status: DailyScanRunStatus.FAILED,
        symbolCountTotal: 0,
        symbolCountAfterTradability: 0,
        symbolCountFilteredOut: 0,
        candidateCountA: 0,
        candidateCountB: 0,
        candidateCountSurfaced: 0,
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

  const { aggregate, tradableSymbolIds, items: tradItems } =
    await evaluateTradabilityForAllActiveSymbols(prisma, expectedLatestSession);

  const symbolKeyById = new Map(
    tradItems.map((t) => [t.symbolId, t.symbolKey] as const)
  );

  const { candidateCountA, candidateCountB, surfaced, diagnostics } =
    await collectGate2SetupCandidatesWithStats(
      prisma,
      tradableSymbolIds,
      regime.level,
      expectedLatestSession,
      symbolKeyById
    );

  const tradingDecision = computeDailyTradingDecision({
    gate1Level: regime.level as Gate1Level,
    candidateCountA,
    candidateCountB,
  });

  const scanNotes = {
    ...toDailyScanGate2Notes(diagnostics),
    decision: toPersistedDailyDecision(tradingDecision),
  };

  const summary = await prisma.$transaction(async (tx) => {
    const run = await tx.dailyScanRun.create({
      data: {
        gate1Level,
        status: DailyScanRunStatus.COMPLETED,
        symbolCountTotal: aggregate.totalSymbols,
        symbolCountAfterTradability: tradableSymbolIds.length,
        symbolCountFilteredOut: aggregate.filteredOut,
        candidateCountA,
        candidateCountB,
        candidateCountSurfaced: surfaced.length,
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

  const out = {
    scanRunId: summary.run.id,
    runAt: summary.run.runAt.toISOString(),
    expectedLatestSession: expectedLatestSession.toISOString(),
    gate1Level: regime.level,
    tradability: {
      totalSymbols: aggregate.totalSymbols,
      passedTradability: tradableSymbolIds.length,
      filteredOut: aggregate.filteredOut,
      breakdownByReason: aggregate.breakdownByReason,
    },
    symbolCountTotal: aggregate.totalSymbols,
    symbolCountAfterTradability: tradableSymbolIds.length,
    symbolCountFilteredOut: aggregate.filteredOut,
    candidateCountA,
    candidateCountB,
    candidateCountSurfaced: surfaced.length,
    setupCandidatesInserted: summary.candidatesInserted,
    tradabilityBreakdown: aggregate.breakdownByReason,
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
