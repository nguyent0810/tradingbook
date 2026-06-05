/**
 * Split a frozen stale symbol list into shard JSON files (no DB access).
 *
 *   npx tsx scripts/write-frozen-stale-shard-files.ts \
 *     --frozen-file=/path/stale-fetch-targets.json \
 *     --shard-count=2 \
 *     --work-dir=. \
 *     --runner-temp=/tmp
 */
import { copyFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  computeShardOverlapCount,
  frozenShardSplitStats,
  loadSymbolsFromFetchJson,
  partitionFetchTargets,
} from "./lib/fetch-target-selection";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

function main(): void {
  const argv = process.argv.slice(2);
  const frozenFile = parseArg(argv, "--frozen-file=");
  const workDir = parseArg(argv, "--work-dir=");
  const runnerTemp = parseArg(argv, "--runner-temp=");
  const shardCountRaw = parseArg(argv, "--shard-count=");

  if (!frozenFile || !workDir || !runnerTemp || !shardCountRaw) {
    console.error(
      "Usage: write-frozen-stale-shard-files.ts --frozen-file=PATH --shard-count=N --work-dir=DIR --runner-temp=DIR"
    );
    process.exit(1);
  }

  const shardCount = Number(shardCountRaw);
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    console.error("--shard-count must be a positive integer");
    process.exit(1);
  }

  const symbols = loadSymbolsFromFetchJson(frozenFile);
  if (symbols.length === 0) {
    console.error("Frozen stale file has no symbols");
    process.exit(1);
  }

  mkdirSync(workDir, { recursive: true });
  mkdirSync(runnerTemp, { recursive: true });

  const frozenSnapshotPath = join(workDir, "stale-fetch-targets-frozen.json");
  copyFileSync(frozenFile, frozenSnapshotPath);

  const shards = partitionFetchTargets(symbols, shardCount);
  const stats = frozenShardSplitStats(shards);
  const overlapViaSet = computeShardOverlapCount(shards);
  if (overlapViaSet !== stats.overlapCount) {
    console.error("Internal overlap stats mismatch");
    process.exit(1);
  }

  const shardSymbolPaths: string[] = [];
  for (let i = 0; i < shardCount; i++) {
    const payload = JSON.stringify({ symbols: shards[i] }, null, 2);
    const workPath = join(workDir, `stale-fetch-targets-shard-${i}.json`);
    const tempPath = join(runnerTemp, `stale-fetch-targets-shard-${i}.json`);
    writeFileSync(workPath, payload, "utf-8");
    writeFileSync(tempPath, payload, "utf-8");
    shardSymbolPaths.push(workPath);
  }

  console.log(
    JSON.stringify({
      ...stats,
      frozenSnapshotPath,
      shardSymbolPaths,
      runnerTempShardPaths: shardSymbolPaths.map((_, i) =>
        join(runnerTemp, `stale-fetch-targets-shard-${i}.json`)
      ),
    })
  );
}

main();
