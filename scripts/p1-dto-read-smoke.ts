/**
 * Read-only P1 DTO smoke — no writes.
 *
 *   SMOKE_DATABASE=production npx tsx scripts/p1-dto-read-smoke.ts
 */
import { config } from "dotenv";

async function run(): Promise<void> {
  const useProd = process.env.SMOKE_DATABASE === "production";
  if (useProd) {
    config({ path: ".env.prod.local", override: true });
  } else {
    await import("./load-env");
  }

  const { prisma } = await import("../src/lib/prisma");
  const { fetchMarketFreshnessDto } = await import("../src/lib/market/market-freshness-dto");
  const {
    normalizeSetupLifecycleFromDb,
    normalizeSetupLifecycleFromSurfacedSortLabel,
  } = await import("../src/lib/setup-lifecycle/setup-lifecycle-dto");
  const { SetupLifecycleStatus } = await import("../src/generated/prisma/client");

  const freshness = await fetchMarketFreshnessDto(prisma);
  const lifecycleDb = normalizeSetupLifecycleFromDb(SetupLifecycleStatus.READY);
  const lifecycleComputed = normalizeSetupLifecycleFromSurfacedSortLabel("WATCHING");

  const watch = await prisma.setupWatchItem.findFirst({
    select: { lifecycleStatus: true, symbol: { select: { symbol: true } } },
  });

  console.log(
    JSON.stringify(
      {
        database: useProd ? "production" : "local",
        marketFreshnessDto: freshness,
        sampleLifecycleDb: lifecycleDb,
        sampleLifecycleComputed: lifecycleComputed,
        sampleWatchItem: watch
          ? {
              symbol: watch.symbol.symbol,
              lifecycle: normalizeSetupLifecycleFromDb(watch.lifecycleStatus),
            }
          : null,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("[P1 DTO smoke] failed:", e);
  process.exit(1);
});
