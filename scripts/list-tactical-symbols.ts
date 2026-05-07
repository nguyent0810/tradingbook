/**
 * List tactical symbols.
 *
 * Usage:
 *   npx tsx scripts/list-tactical-symbols.ts
 *   npx tsx scripts/list-tactical-symbols.ts --active
 *   npx tsx scripts/list-tactical-symbols.ts --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { buildActiveTacticalSymbolWhere } from "../src/lib/tactical-universe";
import { describeDatabaseUrl } from "./load-env";

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

function pad(v: string, w: number): string {
  return (v.length > w ? `${v.slice(0, w - 1)}…` : v).padEnd(w, " ");
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString() : "-";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const onlyActive = hasFlag(argv, "--active");
  const asJson = hasFlag(argv, "--json");
  const now = new Date();

  console.error("list-tactical-symbols.ts → DATABASE_URL:", describeDatabaseUrl());

  const where = onlyActive ? buildActiveTacticalSymbolWhere(now) : {};
  const rows = await prisma.tacticalSymbol.findMany({
    where,
    orderBy: [{ status: "asc" }, { symbol: "asc" }],
    select: {
      symbol: true,
      status: true,
      activeForScanner: true,
      expiresAt: true,
      importedBarsAt: true,
      lastEvaluatedAt: true,
      source: true,
    },
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          generatedAt: now.toISOString(),
          activeFilter: onlyActive,
          count: rows.length,
          rows,
        },
        null,
        2
      )
    );
    return;
  }

  const header =
    `${pad("symbol", 8)}${pad("status", 10)}${pad("active", 8)}` +
    `${pad("expiresAt", 26)}${pad("importedBarsAt", 26)}` +
    `${pad("lastEvaluatedAt", 26)}${pad("source", 16)}`;
  console.log(header);
  console.log("-".repeat(Math.min(140, header.length)));
  for (const r of rows) {
    console.log(
      `${pad(r.symbol, 8)}${pad(r.status, 10)}${pad(String(r.activeForScanner), 8)}` +
        `${pad(fmtDate(r.expiresAt), 26)}${pad(fmtDate(r.importedBarsAt), 26)}` +
        `${pad(fmtDate(r.lastEvaluatedAt), 26)}${pad(r.source, 16)}`
    );
  }
  console.log("");
  console.log(`Rows: ${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
