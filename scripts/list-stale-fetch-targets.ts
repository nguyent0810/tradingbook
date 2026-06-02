/**
 * Read-only: list symbols that need equity fetch (stale or missing vs VNINDEX session).
 * Does not call vnstock, import bars, or mutate StockSymbol / StockDailyBar.
 *
 * Usage:
 *   npx tsx scripts/list-stale-fetch-targets.ts --active-only --json
 *   npx tsx scripts/list-stale-fetch-targets.ts --write-symbols-file=data/stale-fetch-targets.json
 *   npx tsx scripts/list-stale-fetch-targets.ts --shard-index=0 --shard-count=2 --write-symbols-file=data/shard-0.json
 *
 * Production read-only (no DB writes):
 *   SMOKE_DATABASE=production npx tsx scripts/list-stale-fetch-targets.ts --production-read-only --active-only --json
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { validateProductionDatabaseUrl } from "../src/lib/ops/production-database-guard";
import {
  FETCH_SECONDS_PER_SYMBOL_ESTIMATE,
  loadSymbolsFromFetchJson,
  selectFetchTargets,
  sliceShard,
} from "./lib/fetch-target-selection";

const DEFAULT_RETRY_QUEUE = join(process.cwd(), "data", "fetch-retry-queue.json");
const DEFAULT_SYMBOLS_OUT = join(process.cwd(), "data", "stale-fetch-targets.json");

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function parseArg(argv: string[], prefix: string): string | null {
  const raw = argv.find((a) => a.startsWith(prefix));
  if (!raw) return null;
  return raw.slice(prefix.length).trim() || null;
}

function parsePositiveIntArg(argv: string[], prefix: string): number | null {
  const raw = parseArg(argv, prefix);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function loadRetrySymbols(path: string): string[] {
  try {
    return loadSymbolsFromFetchJson(path);
  } catch {
    console.error(`[list-stale-fetch-targets] Could not read retry file: ${path}`);
    return [];
  }
}

function assertReadOnlyTarget(hint: string, productionReadOnly: boolean): void {
  const isNeon = hint.includes("neon.tech");
  if (isNeon && !productionReadOnly) {
    console.error(
      "Abort: production database detected. Pass --production-read-only with SMOKE_DATABASE=production for read-only listing, or unset SMOKE_DATABASE for local."
    );
    process.exit(2);
  }
  if (productionReadOnly) {
    if (process.env.SMOKE_DATABASE !== "production") {
      console.error(
        "Abort: --production-read-only requires SMOKE_DATABASE=production."
      );
      process.exit(2);
    }
    if (!isNeon) {
      console.error(
        "Abort: --production-read-only but databaseUrlHint is not a production host."
      );
      process.exit(2);
    }
    const guard = validateProductionDatabaseUrl();
    console.error(
      "[list-stale-fetch-targets] production read-only:",
      guard.ok ? "ok" : guard.reason,
      guard.databaseUrlHint
    );
  }
  if (!isNeon && process.env.SMOKE_DATABASE === "production") {
    console.error(
      "Abort: SMOKE_DATABASE=production but databaseUrlHint is not production."
    );
    process.exit(2);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const activeOnly = hasFlag(argv, "--active-only");
  const asJson = hasFlag(argv, "--json");
  const productionReadOnly = hasFlag(argv, "--production-read-only");
  const includeRetry = hasFlag(argv, "--include-retry");
  const writeSymbolsFile = parseArg(argv, "--write-symbols-file=");
  const retryFile = parseArg(argv, "--retry-file=") ?? DEFAULT_RETRY_QUEUE;
  const shardIndex = parsePositiveIntArg(argv, "--shard-index=");
  const shardCount = parsePositiveIntArg(argv, "--shard-count=");

  if (
    (shardIndex != null && shardCount == null) ||
    (shardIndex == null && shardCount != null)
  ) {
    console.error("Use both --shard-index=N and --shard-count=M together.");
    process.exit(1);
  }

  const hint = describeDatabaseUrl();
  console.error("list-stale-fetch-targets.ts → DATABASE_URL:", hint);
  assertReadOnlyTarget(hint, productionReadOnly);

  const retrySymbols = includeRetry ? loadRetrySymbols(retryFile) : [];
  const selection = await selectFetchTargets(prisma, {
    activeOnly,
    includeRetrySymbols: retrySymbols,
  });

  let shardTargets = selection.fetchTargets;
  if (shardIndex != null && shardCount != null) {
    shardTargets = sliceShard(selection.fetchTargets, shardIndex, shardCount);
  }

  const projectedFetchSeconds =
    shardTargets.length * FETCH_SECONDS_PER_SYMBOL_ESTIMATE;

  const outPath = writeSymbolsFile ?? (hasFlag(argv, "--write-symbols") ? DEFAULT_SYMBOLS_OUT : null);
  let symbolsFileWritten: string | null = null;
  if (outPath) {
    if (productionReadOnly) {
      console.error(
        "Note: --write-symbols-file writes a local JSON file only (no production DB writes)."
      );
    }
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify({ symbols: shardTargets }, null, 2),
      "utf-8"
    );
    symbolsFileWritten = outPath;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    databaseUrlHint: hint,
    mode: productionReadOnly ? "production_read_only" : "local_or_staging",
    readOnly: true,
    expectedLatestSessionDay: selection.expectedLatestSessionDay,
    scope: activeOnly ? "active_only" : "all_symbols",
    activeSymbolCount: selection.activeSymbolCount,
    universeSize: selection.universeSize,
    alignedCount: selection.alignedCount,
    missingBarsCount: selection.missingBarsCount,
    staleSessionCount: selection.staleSessionCount,
    fetchTargetCount: selection.fetchTargetCount,
    retrySymbolsMerged: retrySymbols.length,
    shard:
      shardIndex != null && shardCount != null
        ? { shardIndex, shardCount, shardTargetCount: shardTargets.length }
        : null,
    latestSessionCoveragePct: selection.latestSessionCoveragePct,
    projectedFetchMinutesAt3_55sPerSymbol: Number(
      (projectedFetchSeconds / 60).toFixed(1)
    ),
    secondsPerSymbolEstimate: FETCH_SECONDS_PER_SYMBOL_ESTIMATE,
    symbolsFileWritten,
    fetchCommandHint: symbolsFileWritten
      ? `python scripts/fetch_stock_bars.py --symbols-file ${symbolsFileWritten} --sleep 3.2 --end-date ${selection.expectedLatestSessionDay}`
      : null,
    sampleMissingBars: selection.rows
      .filter((r) => r.reason === "missing_bars")
      .slice(0, 20)
      .map((r) => r.symbol),
    sampleStaleSession: selection.rows
      .filter((r) => r.reason === "stale_session")
      .slice(0, 20),
  };

  console.log(JSON.stringify(out, null, 2));
  if (!asJson) {
    // stdout is always JSON summary; --json kept for CLI compatibility
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
