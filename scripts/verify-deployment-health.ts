/**
 * Read-only deployment sanity check: latest DailyScanRun, active universe size, trade count.
 *
 * Point `DATABASE_URL` at the DB to inspect (local, staging, or production).
 *
 *   npx tsx scripts/verify-deployment-health.ts
 *   npx tsx scripts/verify-deployment-health.ts --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";

function hasJsonFlag(argv: string[]): boolean {
  return argv.includes("--json");
}

async function main(): Promise<void> {
  const json = hasJsonFlag(process.argv.slice(2));

  const latest = await prisma.dailyScanRun.findFirst({
    orderBy: { runAt: "desc" },
    select: {
      id: true,
      runAt: true,
      startedAt: true,
      finishedAt: true,
      status: true,
      gate1Level: true,
      symbolCountTotal: true,
      symbolCountScanned: true,
      symbolCountFailed: true,
      symbolCountAfterTradability: true,
      symbolCountFilteredOut: true,
      candidateCountA: true,
      candidateCountB: true,
      candidateCountSurfaced: true,
      setupCandidatesCreated: true,
      errorSummary: true,
    },
  });

  const activeSymbols = await prisma.stockSymbol.count({ where: { active: true } });
  const totalTrades = await prisma.trade.count();

  const out = {
    generatedAt: new Date().toISOString(),
    databaseUrlHint: describeDatabaseUrl(),
    latestDailyScanRun: latest,
    activeSymbolsCount: activeSymbols,
    totalTradesInDb: totalTrades,
    checks: {
      hasLatestScan: latest != null,
      scanCompleted:
        latest?.status === "COMPLETED" && latest.finishedAt != null,
    },
  };

  if (json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log("verify-deployment-health.ts →", describeDatabaseUrl());
    console.log("");
    console.log("Active StockSymbol (active=true):", activeSymbols);
    console.log("Total Trade rows:", totalTrades);
    console.log("");
    if (!latest) {
      console.log("Latest DailyScanRun: (none)");
    } else {
      console.log("Latest DailyScanRun:");
      console.log("  id:", latest.id);
      console.log("  runAt:", latest.runAt.toISOString());
      console.log(
        "  startedAt:",
        latest.startedAt ? latest.startedAt.toISOString() : "(null)"
      );
      console.log(
        "  finishedAt:",
        latest.finishedAt ? latest.finishedAt.toISOString() : "(null)"
      );
      console.log("  status:", latest.status);
      console.log("  gate1Level:", latest.gate1Level);
      console.log("  symbolCountTotal:", latest.symbolCountTotal);
      console.log("  symbolCountScanned:", latest.symbolCountScanned);
      console.log("  symbolCountFailed:", latest.symbolCountFailed);
      console.log(
        "  symbolCountAfterTradability:",
        latest.symbolCountAfterTradability
      );
      console.log("  setupCandidatesCreated:", latest.setupCandidatesCreated);
      if (latest.errorSummary) console.log("  errorSummary:", latest.errorSummary);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
