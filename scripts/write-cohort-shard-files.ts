/**
 * Build frozen shard files from expansion cohort JSON (no DB access).
 *
 *   npx tsx scripts/write-cohort-shard-files.ts \
 *     --cohort-file=data/expansion-300-cohort.json \
 *     --tier=a \
 *     --shard-count=2 \
 *     --work-dir=. \
 *     --runner-temp=/tmp
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  computeShardOverlapCount,
  frozenShardSplitStats,
  partitionFetchTargets,
} from "./lib/fetch-target-selection";
import {
  type ExpansionCohortDoc,
  normalizeCohortTier,
  validateTierSymbolsOffline,
} from "./lib/cohort-tier";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function main(): void {
  const argv = process.argv.slice(2);
  const cohortFile = parseArg(argv, "--cohort-file=") ?? resolve(process.cwd(), "data/expansion-300-cohort.json");
  const tierRaw = parseArg(argv, "--tier=") ?? "a";
  const workDir = parseArg(argv, "--work-dir=");
  const runnerTemp = parseArg(argv, "--runner-temp=");
  const shardCountRaw = parseArg(argv, "--shard-count=");
  const allowBaselineFetch = hasFlag(argv, "--allow-baseline-fetch");

  if (!workDir || !runnerTemp || !shardCountRaw) {
    console.error(
      "Usage: write-cohort-shard-files.ts --cohort-file=PATH --tier=a|b|all --shard-count=N --work-dir=DIR --runner-temp=DIR [--allow-baseline-fetch]"
    );
    process.exit(1);
  }

  const shardCount = Number(shardCountRaw);
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    console.error("--shard-count must be a positive integer");
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as ExpansionCohortDoc;
  let tier: ReturnType<typeof normalizeCohortTier>;
  let offline: ReturnType<typeof validateTierSymbolsOffline>;
  try {
    tier = normalizeCohortTier(tierRaw);
    offline = validateTierSymbolsOffline(doc, tierRaw);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const symbols = offline.symbols;
  if (symbols.length === 0) {
    console.error("Cohort tier has no symbols");
    process.exit(1);
  }
  if (offline.duplicateSymbols.length > 0) {
    console.error(`Duplicate symbols in tier: ${offline.duplicateSymbols.join(", ")}`);
    process.exit(1);
  }
  if (offline.baselineOverlap.length > 0 && !allowBaselineFetch) {
    console.error(
      `Tier includes baseline active symbols (use --allow-baseline-fetch to override): ${offline.baselineOverlap.join(", ")}`
    );
    process.exit(1);
  }

  mkdirSync(workDir, { recursive: true });
  mkdirSync(runnerTemp, { recursive: true });

  const frozenSnapshotPath = join(workDir, `cohort-tier-${tier}-frozen.json`);
  writeFileSync(frozenSnapshotPath, JSON.stringify({ symbols }, null, 2), "utf-8");

  const shards = partitionFetchTargets(symbols, shardCount);
  const stats = frozenShardSplitStats(shards);
  if (computeShardOverlapCount(shards) !== stats.overlapCount) {
    console.error("Internal overlap stats mismatch");
    process.exit(1);
  }
  if (stats.overlapCount !== 0) {
    console.error(`Shard overlap ${stats.overlapCount} (expected 0)`);
    process.exit(1);
  }

  const shardSymbolPaths: string[] = [];
  for (let i = 0; i < shardCount; i++) {
    const payload = JSON.stringify({ symbols: shards[i] }, null, 2);
    const workPath = join(workDir, `cohort-fetch-targets-shard-${i}.json`);
    const tempPath = join(runnerTemp, `cohort-fetch-targets-shard-${i}.json`);
    writeFileSync(workPath, payload, "utf-8");
    writeFileSync(tempPath, payload, "utf-8");
    shardSymbolPaths.push(workPath);
  }

  console.log(
    JSON.stringify({
      cohortFile,
      tier,
      allowBaselineFetch,
      ...stats,
      frozenSnapshotPath,
      shardSymbolPaths,
      runnerTempShardPaths: shardSymbolPaths.map((_, i) =>
        join(runnerTemp, `cohort-fetch-targets-shard-${i}.json`)
      ),
    })
  );
}

main();
