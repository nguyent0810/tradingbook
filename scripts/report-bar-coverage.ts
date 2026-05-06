/**
 * Report equity bar coverage vs expected latest session (VNINDEX IndexDailyBar).
 *
 * Usage:
 *   npx tsx scripts/report-bar-coverage.ts
 *   npx tsx scripts/report-bar-coverage.ts --sample=60
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { describeDatabaseUrl } from "./load-env";

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  const x = utcDayOnly(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseSampleLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--sample="));
  if (!raw) return 40;
  const n = Number.parseInt(raw.slice("--sample=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 40;
}

async function main(): Promise<void> {
  const sampleLimit = parseSampleLimit(process.argv.slice(2));

  console.error("report-bar-coverage.ts → DATABASE_URL:", describeDatabaseUrl());

  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    console.log(
      JSON.stringify(
        {
          error: "No VNINDEX IndexDailyBar rows — cannot compute expected latest session.",
        },
        null,
        2
      )
    );
    return;
  }

  const active = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const activeIds = active.map((a) => a.id);

  let activeWithAnyBar = 0;
  const counts = await prisma.stockDailyBar.groupBy({
    by: ["symbolId"],
    where: { symbolId: { in: activeIds } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.symbolId, c._count._all] as const));
  for (const id of activeIds) {
    if ((countById.get(id) ?? 0) > 0) activeWithAnyBar++;
  }

  const latestBars =
    activeIds.length === 0
      ? []
      : await prisma.stockDailyBar.findMany({
          where: { symbolId: { in: activeIds } },
          distinct: ["symbolId"],
          orderBy: [{ symbolId: "asc" }, { date: "desc" }],
          select: { symbolId: true, date: true },
        });

  const latestBySymbolId = new Map(latestBars.map((b) => [b.symbolId, b.date] as const));

  let activeWithLatestSessionBar = 0;
  const staleSamples: { symbol: string; latestBarDay: string | null; barCount: number }[] = [];

  const expectedMs = utcDayOnly(expected).getTime();

  for (const sym of active) {
    const latest = latestBySymbolId.get(sym.id);
    const barCount = countById.get(sym.id) ?? 0;
    const aligned = latest != null && utcDayOnly(latest).getTime() === expectedMs;
    if (aligned) {
      activeWithLatestSessionBar++;
      continue;
    }
    if (staleSamples.length < sampleLimit) {
      staleSamples.push({
        symbol: sym.symbol,
        latestBarDay: latest ? isoDay(latest) : null,
        barCount,
      });
    }
  }

  const activeNoBarsInDb = active.length - activeWithAnyBar;
  const staleOrMissingLatest =
    active.length - activeWithLatestSessionBar;

  const expectedDay = isoDay(expected);

  const out = {
    generatedAt: new Date().toISOString(),
    expectedLatestSession: expected.toISOString(),
    expectedLatestSessionDay: expectedDay,
    activeSymbols: active.length,
    activeWithAnyBar,
    activeNoBarsInDb,
    activeWithLatestSessionBar,
    activeStaleOrMissingLatestSession: staleOrMissingLatest,
    latestSessionCoveragePct:
      active.length === 0
        ? null
        : Number(((100 * activeWithLatestSessionBar) / active.length).toFixed(2)),
    sampleStaleSymbols: staleSamples.slice(0, sampleLimit),
    fetchHint: `Align equity fetch end to index session day: python scripts/fetch_stock_bars.py --limit <N> --sleep 3.2 --end-date ${expectedDay}`,
  };

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
