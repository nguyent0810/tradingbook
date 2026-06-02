/**
 * Build `data/fetch-retry-queue.json` from a fetch output JSON (empty bars or missing data).
 * Read-only regarding the database.
 *
 * Usage:
 *   npx tsx scripts/build-fetch-retry-queue.ts data/stock-bars.json
 *   npx tsx scripts/build-fetch-retry-queue.ts data/stock-bars.json --out data/fetch-retry-queue.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const DEFAULT_OUT = join(process.cwd(), "data", "fetch-retry-queue.json");

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath = argv.find((a) => !a.startsWith("--"));
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/build-fetch-retry-queue.ts <stock-bars.json> [--out=path]");
    process.exit(1);
  }
  const outFlag = argv.find((a) => a.startsWith("--out="));
  const outPath = outFlag ? outFlag.slice("--out=".length) : DEFAULT_OUT;

  const parsed = JSON.parse(readFileSync(inputPath, "utf-8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected top-level array in ${inputPath}`);
  }

  const failed: string[] = [];
  for (const entry of parsed) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.symbol !== "string") continue;
    const sym = e.symbol.trim().toUpperCase();
    if (!sym) continue;
    const bars = e.bars;
    if (!Array.isArray(bars) || bars.length === 0) {
      failed.push(sym);
    }
  }

  const unique = [...new Set(failed)].sort((a, b) => a.localeCompare(b));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFile: inputPath,
        symbols: unique,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        failedSymbolCount: unique.length,
        sample: unique.slice(0, 30),
      },
      null,
      2
    )
  );
}

main();
