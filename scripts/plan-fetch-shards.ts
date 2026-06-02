/**
 * Print shard layout and time estimates (no DB, no network).
 *
 * Usage:
 *   npx tsx scripts/plan-fetch-shards.ts --symbols=500
 *   npx tsx scripts/plan-fetch-shards.ts --symbols=206 --stale=38
 */
import { FETCH_SECONDS_PER_SYMBOL_ESTIMATE } from "./lib/fetch-target-selection";

function parseIntArg(argv: string[], prefix: string, fallback: number): number {
  const raw = argv.find((a) => a.startsWith(prefix));
  if (!raw) return fallback;
  const n = Number.parseInt(raw.slice(prefix.length), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function minutesForSymbols(n: number): number {
  return Number(((n * FETCH_SECONDS_PER_SYMBOL_ESTIMATE) / 60).toFixed(1));
}

function main(): void {
  const argv = process.argv.slice(2);
  const total = parseIntArg(argv, "--symbols=", 300);
  const staleOnly = parseIntArg(argv, "--stale=", 0);
  const ghaBudgetMin = parseIntArg(argv, "--gha-budget-min=", 45);

  const layouts = [
    { label: "300", symbols: 300, shards: 1 },
    { label: "500", symbols: 500, shards: 2 },
    { label: "1000", symbols: 1000, shards: 4 },
  ];

  const rows = layouts.map(({ label, symbols, shards }) => {
    const perShard = Math.ceil(symbols / shards);
    const fetchMin = minutesForSymbols(perShard);
    return {
      universe: label,
      totalSymbols: symbols,
      shardCount: shards,
      symbolsPerShard: perShard,
      estimatedFetchMinutesPerShard: fetchMin,
      fitsSingleGhaJob45m: fetchMin + 8 <= ghaBudgetMin,
      artifactPattern: `stock-bars-shard-{0..${shards - 1}}.json`,
    };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    secondsPerSymbolEstimate: FETCH_SECONDS_PER_SYMBOL_ESTIMATE,
    customTotal: total,
    customFullFetchMinutes: minutesForSymbols(total),
    customStaleOnlyCount: staleOnly,
    customStaleOnlyMinutes: minutesForSymbols(staleOnly),
    ghaBudgetMinutes: ghaBudgetMin,
    recommendedLayouts: rows,
    importStrategy:
      "Import each shard sequentially with import-stock-bars.ts (upsert idempotent).",
    failureThreshold:
      "Fail workflow if failed symbols > 5% of shard or any tier-1 core symbol fails.",
    retryStrategy:
      "build-fetch-retry-queue.ts on shard JSON → second pass fetch with --retry-file / --include-retry.",
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
