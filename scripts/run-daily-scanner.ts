/**
 * Resolve Gate 1 (VNINDEX), tradability, Gate 2 candidates, persist DailyScanRun + SetupCandidate.
 * Does not fetch new stock data — uses existing IndexDailyBar / StockDailyBar.
 *
 * Usage: npx tsx scripts/run-daily-scanner.ts
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { runDailyScanJob } from "../src/lib/scanner/run-daily-scan-job";
import { describeDatabaseUrl } from "./load-env";

async function main() {
  console.log("run-daily-scanner.ts → DATABASE_URL:", describeDatabaseUrl());

  const result = await runDailyScanJob(prisma);

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.kind === "FAILED_NO_INDEX_SESSION") {
    console.log(JSON.stringify(result.summaryJson, null, 2));
    return;
  }

  // Without this branch the summary below would print "Scanned 0/0 symbols ·
  // 0 setups found", which reads like an empty scan rather than a skipped one.
  if (result.kind === "SKIPPED_ALREADY_COMPLETED") {
    console.log(
      `Skipped — session ${String(result.summaryJson.expectedLatestSession).slice(0, 10)} already has a COMPLETED scan ` +
        `(run ${String(result.summaryJson.existingRunId)}). Re-run with SCAN_FORCE_RERUN=1 to override.`
    );
    console.log(JSON.stringify(result.summaryJson, null, 2));
    return;
  }

  const j = result.summaryJson;
  const scanned =
    typeof j.symbolCountScanned === "number" ? j.symbolCountScanned : 0;
  const total =
    typeof j.symbolCountTotal === "number" ? j.symbolCountTotal : 0;
  const setups =
    typeof j.candidateCountSurfaced === "number"
      ? j.candidateCountSurfaced
      : 0;
  const failed =
    typeof j.symbolCountFailed === "number" ? j.symbolCountFailed : 0;

  console.log(
    `Scanned ${scanned}/${total} symbols · ${setups} setups found · ${failed} failed`
  );
  console.log(JSON.stringify(result.summaryJson, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
