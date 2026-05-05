/**
 * Gate 2 diagnostics on symbols that pass tradability: quality counts, INVALID
 * breakdown by category, and closest-to-valid ranking (pipeline depth proxy).
 *
 * Usage: npx tsx scripts/gate2-audit.ts
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import {
  buildGate2ScanDiagnosticsSummary,
  type Gate2DiagnosticEvaluationRow,
} from "../src/lib/scanner/gate2-scan-diagnostics";
import { evaluateBreakoutPullbackCandidate } from "../src/lib/scanner/gate2/breakout-pullback";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForAllActiveSymbols } from "../src/lib/scanner/tradability";
import { describeDatabaseUrl } from "./load-env";

async function main(): Promise<void> {
  console.error("gate2-audit.ts → DATABASE_URL:", describeDatabaseUrl());

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    console.log(
      JSON.stringify(
        {
          error: "No VNINDEX session date — cannot align Gate 2 evaluation.",
        },
        null,
        2
      )
    );
    return;
  }

  const { items: tradItems, tradableSymbolIds } =
    await evaluateTradabilityForAllActiveSymbols(prisma, expectedLatestSession);

  const symbolKeyById = new Map(
    tradItems.map((t) => [t.symbolId, t.symbolKey] as const)
  );

  const rows: Gate2DiagnosticEvaluationRow[] = [];

  for (const symbolId of tradableSymbolIds) {
    const symbol = symbolKeyById.get(symbolId) ?? symbolId;
    const dbBars = await prisma.stockDailyBar.findMany({
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

    const bars = dbBars.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const evaluation = evaluateBreakoutPullbackCandidate(bars, expectedLatestSession);
    rows.push({ symbol, symbolId, evaluation });
  }

  const diag = buildGate2ScanDiagnosticsSummary(rows);

  const out = {
    expectedLatestSession: expectedLatestSession.toISOString(),
    totalTradableSymbols: tradableSymbolIds.length,
    totalActiveSymbolsScannedForTradability: tradItems.length,
    gate2QualityCounts: diag.gate2QualityCounts,
    invalidCountByCategory: diag.invalidCountByCategory,
    topRejectionCategories: diag.topRejectionCategories,
    rejectionSymbolsByCategory: diag.rejectionSymbolsByCategory,
    topRejectionTerminalReasons: diag.topRejectionTerminalReasons,
    closestToValidSymbols: diag.closestToValidSymbols,
    recommendation: diag.recommendation,
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
