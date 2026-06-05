/**
 * Read-only: session alignment for cohort tier symbols after backfill.
 *
 *   SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts \
 *     --cohort-file=data/expansion-300-cohort.json --tier=a
 *
 *   SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts --tier=b
 *   SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts --tier=all
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { describeDatabaseUrl } from "./load-env";
import { type ExpansionCohortDoc, resolveTierSymbols } from "./lib/cohort-tier";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cohortFile =
    parseArg(argv, "--cohort-file=") ?? resolve(root, "data/expansion-300-cohort.json");
  const tier = parseArg(argv, "--tier=") ?? "a";
  const failOnMismatch = !argv.includes("--allow-partial");

  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as ExpansionCohortDoc;
  let symbols: string[];
  try {
    symbols = resolveTierSymbols(doc, tier);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) throw new Error("No VNINDEX session");
  const expectedMs = utcDayOnly(expected).getTime();

  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: symbols } },
    select: {
      symbol: true,
      active: true,
      bars: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      _count: { select: { bars: true } },
    },
  });
  const rowBy = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

  const perSymbol: Array<Record<string, unknown>> = [];
  let aligned = 0;
  let stillInactive = 0;
  const failures: string[] = [];

  for (const sym of symbols) {
    const row = rowBy.get(sym);
    if (!row) {
      failures.push(`${sym}: not in DB`);
      continue;
    }
    if (row.active) failures.push(`${sym}: unexpectedly active`);
    else stillInactive++;
    const latest = row.bars[0]?.date ?? null;
    const ok = latest != null && utcDayOnly(latest).getTime() === expectedMs;
    if (ok) aligned++;
    else failures.push(`${sym}: latest ${latest?.toISOString().slice(0, 10) ?? "none"} != expected`);
    perSymbol.push({
      symbol: sym,
      active: row.active,
      barCount: row._count.bars,
      latestBarDay: latest?.toISOString().slice(0, 10) ?? null,
      sessionAligned: ok,
    });
  }

  const activeCount = await prisma.stockSymbol.count({ where: { active: true } });
  const baseline = doc.baselineActiveSymbols?.length ?? null;
  const ok = failures.length === 0;

  console.log(
    JSON.stringify(
      {
        ok,
        databaseUrlHint: describeDatabaseUrl(),
        expectedLatestSessionDay: expected.toISOString().slice(0, 10),
        tier,
        requestedCount: symbols.length,
        alignedCount: aligned,
        stillInactiveCount: stillInactive,
        activeCountInDb: activeCount,
        baselineActiveExpected: baseline,
        universeUnchanged: baseline == null ? null : activeCount === baseline,
        failures,
        perSymbol,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
  if (!ok && failOnMismatch) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
