/**
 * Read-only market data alignment check (DB + scan metadata).
 *
 * Usage: npx tsx scripts/verify-market-data.ts
 *        npm run verify:market-data
 *
 * Requires DATABASE_URL (see scripts/load-env.ts).
 * Does not modify production data.
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { analyzeMarketDataAlignment } from "../src/lib/market/market-data-alignment";
import { fetchMarketSessionSnapshot } from "../src/lib/market/market-session-snapshot";
import { buildMarketDataFreshnessReport } from "../src/lib/market/market-data-freshness-report";

async function main(): Promise<void> {
  const snapshot = await fetchMarketSessionSnapshot(prisma);
  const alignment = analyzeMarketDataAlignment(snapshot);
  const { lines, recommendedActions } = buildMarketDataFreshnessReport(snapshot, alignment);

  for (const line of lines) console.log(line);
  console.log("");
  console.log("=== Recommended actions ===");
  for (const a of recommendedActions) console.log(`- ${a}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
