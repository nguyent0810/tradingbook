/**
 * Export active production symbols for fetch_stock_bars.py (excludes smoke tickers).
 *
 * Usage:
 *   npx tsx scripts/export-active-symbol-keys.ts
 *   npx tsx scripts/export-active-symbol-keys.ts --out /tmp/active-symbol-keys.json
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import "./load-env";
import { describeDatabaseUrl } from "./load-env";
import { isSmokeProductionSymbol } from "../src/lib/scanner/production-smoke-markers";
import { validateProductionDatabaseUrl } from "../src/lib/ops/production-database-guard";
import { prisma } from "../src/lib/prisma";

const DEFAULT_OUT = join(process.cwd(), "data", "active-symbol-keys.json");

function parseOutPath(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith("--out="));
  if (flag) return flag.slice("--out=".length);
  const idx = argv.indexOf("--out");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return DEFAULT_OUT;
}

async function main(): Promise<void> {
  const guard = validateProductionDatabaseUrl();
  if (!guard.ok) {
    console.error("[export-active-symbol-keys]", guard.reason);
    process.exit(1);
  }

  const outPath = parseOutPath(process.argv.slice(2));
  console.error("[export-active-symbol-keys] DATABASE_URL:", describeDatabaseUrl());

  const rows = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { symbol: true },
    orderBy: { symbol: "asc" },
  });

  const symbols = rows
    .map((r) => r.symbol.trim().toUpperCase())
    .filter((s) => s.length > 0 && !isSmokeProductionSymbol(s));

  const excludedSmoke = rows.length - symbols.length;
  if (excludedSmoke > 0) {
    console.error(
      `[export-active-symbol-keys] excluded ${excludedSmoke} smoke symbol(s) from export`
    );
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ symbols }, null, 2), "utf-8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        activeExported: symbols.length,
        excludedSmoke,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
