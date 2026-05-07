/**
 * Export active tactical symbols to a symbols file for fetch_stock_bars.py.
 *
 * Default output is JSON shape: { "symbols": ["AAA", "BBB"] } compatible with
 * `python scripts/fetch_stock_bars.py --symbols-file <path>`.
 *
 * Usage:
 *   npx tsx scripts/export-tactical-symbols.ts
 *   npx tsx scripts/export-tactical-symbols.ts --output data/tactical-symbols.json
 *   npx tsx scripts/export-tactical-symbols.ts --active-only --lines
 */
import "./load-env";
import { writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { buildActiveTacticalSymbolWhere } from "../src/lib/tactical-universe";
import { describeDatabaseUrl } from "./load-env";

function parseOutput(argv: readonly string[]): string {
  const hit = argv.find((a) => a.startsWith("--output="));
  if (!hit) return join(process.cwd(), "data", "tactical-symbols.json");
  const raw = hit.slice("--output=".length).trim();
  return raw.length > 0 ? raw : join(process.cwd(), "data", "tactical-symbols.json");
}

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const output = parseOutput(argv);
  const onlyActive = hasFlag(argv, "--active-only");
  const asLines = hasFlag(argv, "--lines");
  const now = new Date();

  console.error("export-tactical-symbols.ts → DATABASE_URL:", describeDatabaseUrl());

  const where = onlyActive ? buildActiveTacticalSymbolWhere(now) : {};
  const rows = await prisma.tacticalSymbol.findMany({
    where,
    orderBy: { symbol: "asc" },
    select: { symbol: true },
  });
  const symbols = [...new Set(rows.map((r) => r.symbol.trim().toUpperCase()))];

  if (asLines) {
    writeFileSync(output, `${symbols.join("\n")}${symbols.length ? "\n" : ""}`, "utf-8");
  } else {
    writeFileSync(output, JSON.stringify({ symbols }, null, 2), "utf-8");
  }

  console.log(
    JSON.stringify(
      {
        output,
        format: asLines ? "lines" : "json",
        onlyActive,
        count: symbols.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
