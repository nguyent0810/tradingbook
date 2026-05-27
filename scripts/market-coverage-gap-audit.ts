/**
 * Read-only production market coverage gap audit.
 *
 * Usage:
 *   SMOKE_DATABASE=production npx tsx scripts/market-coverage-gap-audit.ts
 *   SMOKE_DATABASE=production npx tsx scripts/market-coverage-gap-audit.ts --json-out reports/market-coverage-gap-audit.json
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

const IMPORTANT_TICKERS = [
  "VND",
  "PDR",
  "SSI",
  "HCM",
  "VCI",
  "DIG",
  "DXG",
  "CEO",
  "KBC",
  "NVL",
  "HPG",
  "FPT",
  "MWG",
  "VHM",
  "VRE",
  "VIC",
  "CTG",
  "BID",
  "TCB",
  "MBB",
  "VPB",
] as const;

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  const x = utcDayOnly(d);
  return x.toISOString().slice(0, 10);
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const e = utcDayOnly(earlier).getTime();
  const l = utcDayOnly(later).getTime();
  return Math.round((l - e) / 86_400_000);
}

function countWeekdaysInclusive(start: Date, end: Date): number {
  const s = utcDayOnly(start);
  const e = utcDayOnly(end);
  if (e.getTime() < s.getTime()) return 0;
  let count = 0;
  const d = new Date(s);
  while (d.getTime() <= e.getTime()) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function guessReason(params: {
  active: boolean;
  barCount: number;
  sessionAligned: boolean;
  calendarDaysStale: number | null;
}): string {
  const { active, barCount, sessionAligned, calendarDaysStale } = params;
  if (barCount === 0) {
    return active ? "FETCH_FAILURE_OR_NEVER_FETCHED" : "ACTIVE_FLAG_COVERAGE";
  }
  if (sessionAligned) return "OK";
  if (!active) {
    return calendarDaysStale != null && calendarDaysStale > 15
      ? "IMPORT_UNIVERSE_GAP"
      : "ACTIVE_FLAG_COVERAGE";
  }
  if (calendarDaysStale != null && calendarDaysStale > 5) {
    return "FETCH_FAILURE";
  }
  return "FETCH_FAILURE";
}

function parseJsonOut(argv: string[]): string | null {
  const flag = argv.find((a) => a.startsWith("--json-out="));
  if (flag) return flag.slice("--json-out=".length);
  const idx = argv.indexOf("--json-out");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return null;
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is unset. Set SMOKE_DATABASE=production with .env.prod.local.");
    process.exit(1);
  }

  const jsonOut = parseJsonOut(process.argv.slice(2));

  const { prisma } = await import("../src/lib/prisma");
  const { describeDatabaseUrl } = await import("./load-env");
  const { getExpectedLatestSessionFromIndexBars } = await import(
    "../src/lib/scanner/expected-session"
  );
  const { tradedValueVnd } = await import("../src/lib/scanner/price-units");
  const { TRADABILITY_ROLLING_DAYS } = await import(
    "../src/lib/scanner/tradability-constants"
  );
  const { computeEffectiveScanUniverse, listActiveTacticalSymbols } =
    await import("../src/lib/tactical-universe");

  console.error("market-coverage-gap-audit.ts → DATABASE_URL:", describeDatabaseUrl());

  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    console.error("No VNINDEX session — abort.");
    process.exit(1);
  }

  const allSymbols = await prisma.stockSymbol.findMany({
    select: { id: true, symbol: true, active: true, name: true },
    orderBy: { symbol: "asc" },
  });

  const barCounts = await prisma.stockDailyBar.groupBy({
    by: ["symbolId"],
    _count: { _all: true },
    _max: { date: true },
  });
  const countById = new Map(
    barCounts.map((c) => [c.symbolId, c._count._all] as const)
  );
  const maxDateById = new Map(
    barCounts.map((c) => [c.symbolId, c._max.date] as const)
  );

  const coreSymbols = allSymbols.filter((s) => s.active);
  const tacticalSymbols = await listActiveTacticalSymbols(prisma);
  const tacticalKeys = [...new Set(tacticalSymbols.map((t) => t.symbol.trim().toUpperCase()))];
  const tacticalStockRows =
    tacticalKeys.length === 0
      ? []
      : await prisma.stockSymbol.findMany({
          where: { symbol: { in: tacticalKeys } },
          select: { id: true, symbol: true },
        });
  const stockIdBySymbol = new Map(
    tacticalStockRows.map((s) => [s.symbol.trim().toUpperCase(), s.id] as const)
  );
  const universe = computeEffectiveScanUniverse({
    coreRows: coreSymbols.map((s) => ({ id: s.id, symbol: s.symbol })),
    tacticalRows: tacticalSymbols.map((t) => ({
      tacticalId: t.id,
      tacticalSymbol: t.symbol,
      stockSymbolId: stockIdBySymbol.get(t.symbol.trim().toUpperCase()) ?? null,
    })),
  });
  const inUniverse = new Set(universe.symbols.map((s) => s.symbol));

  type Row = {
    symbol: string;
    name: string | null;
    active: boolean;
    barCount: number;
    latestBarDate: string | null;
    sessionAligned: boolean;
    calendarDaysStale: number | null;
    weekdaySessionsStale: number | null;
    avgValue20Vnd: number | null;
    inEffectiveUniverse: boolean;
    latestScanConsidered: boolean;
    reasonGuess: string;
    important: boolean;
  };

  const rows: Row[] = [];

  for (const sym of allSymbols) {
    const barCount = countById.get(sym.id) ?? 0;
    const latest = maxDateById.get(sym.id) ?? null;
    const sessionAligned =
      latest != null && utcDayOnly(latest).getTime() === utcDayOnly(expected).getTime();
    const calendarDaysStale =
      latest != null ? calendarDaysBetween(latest, expected) : null;
    const weekdaySessionsStale =
      latest != null ? countWeekdaysInclusive(latest, expected) - 1 : null;

    rows.push({
      symbol: sym.symbol,
      name: sym.name,
      active: sym.active,
      barCount,
      latestBarDate: latest ? isoDay(latest) : null,
      sessionAligned,
      calendarDaysStale,
      weekdaySessionsStale,
      avgValue20Vnd: null,
      inEffectiveUniverse: inUniverse.has(sym.symbol.trim().toUpperCase()),
      latestScanConsidered: sym.active,
      reasonGuess: guessReason({
        active: sym.active,
        barCount,
        sessionAligned,
        calendarDaysStale,
      }),
      important: IMPORTANT_TICKERS.includes(
        sym.symbol.trim().toUpperCase() as (typeof IMPORTANT_TICKERS)[number]
      ),
    });
  }

  const needsLiquidity = new Set(
    rows
      .filter(
        (r) =>
          r.important ||
          (r.barCount >= TRADABILITY_ROLLING_DAYS &&
            !r.sessionAligned &&
            r.barCount > 0)
      )
      .map((r) => r.symbol.trim().toUpperCase())
  );

  for (const sym of allSymbols) {
    const key = sym.symbol.trim().toUpperCase();
    if (!needsLiquidity.has(key)) continue;
    const last20 = await prisma.stockDailyBar.findMany({
      where: { symbolId: sym.id },
      orderBy: { date: "desc" },
      take: TRADABILITY_ROLLING_DAYS,
      select: { close: true, volume: true },
    });
    if (last20.length < TRADABILITY_ROLLING_DAYS) continue;
    const avgValue20Vnd = mean(last20.map((b) => tradedValueVnd(b.close, b.volume)));
    const row = rows.find((r) => r.symbol.trim().toUpperCase() === key);
    if (row) row.avgValue20Vnd = avgValue20Vnd;
  }

  const activeRows = rows.filter((r) => r.active);
  const inactiveRows = rows.filter((r) => !r.active);

  const snapshot = {
    totalStockSymbols: rows.length,
    activeTrue: activeRows.length,
    activeFalse: inactiveRows.length,
    activeWithFreshBars: activeRows.filter((r) => r.sessionAligned).length,
    activeWithStaleBars: activeRows.filter((r) => r.barCount > 0 && !r.sessionAligned).length,
    activeNoBars: activeRows.filter((r) => r.barCount === 0).length,
    inactiveWithFreshBars: inactiveRows.filter((r) => r.sessionAligned).length,
    inactiveWithStaleBars: inactiveRows.filter((r) => r.barCount > 0 && !r.sessionAligned).length,
    inactiveNoBars: inactiveRows.filter((r) => r.barCount === 0).length,
    symbolsWithNoBars: rows.filter((r) => r.barCount === 0).length,
    staleMoreThan5Sessions: rows.filter(
      (r) => r.weekdaySessionsStale != null && r.weekdaySessionsStale > 5
    ).length,
    staleMoreThan15Sessions: rows.filter(
      (r) => r.weekdaySessionsStale != null && r.weekdaySessionsStale > 15
    ).length,
  };

  const staleRanked = rows
    .filter((r) => !r.sessionAligned && r.barCount > 0)
    .sort((a, b) => {
      const sa = a.weekdaySessionsStale ?? 0;
      const sb = b.weekdaySessionsStale ?? 0;
      if (sb !== sa) return sb - sa;
      const va = a.avgValue20Vnd ?? 0;
      const vb = b.avgValue20Vnd ?? 0;
      if (vb !== va) return vb - va;
      if (a.important !== b.important) return a.important ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    });

  const topStaleLiquidInactive = staleRanked
    .filter((r) => !r.active && (r.avgValue20Vnd ?? 0) >= 2_000_000_000)
    .slice(0, 40);

  const importantAudit = IMPORTANT_TICKERS.map((ticker) => {
    const row = rows.find((r) => r.symbol.trim().toUpperCase() === ticker);
    if (!row) {
      return {
        symbol: ticker,
        exists: false,
        active: null,
        latestBarDate: null,
        inEffectiveUniverse: false,
        latestScanConsidered: false,
        notes: "Not in stock_symbols",
      };
    }
    const notes: string[] = [];
    if (!row.active) notes.push("inactive — excluded from import fetch + scan");
    if (row.barCount === 0) notes.push("no bars in DB");
    else if (!row.sessionAligned) {
      notes.push(
        `stale ${row.weekdaySessionsStale ?? "?"} weekday sessions (latest ${row.latestBarDate})`
      );
    } else notes.push("fresh session aligned");
    if (row.inEffectiveUniverse) notes.push("in effective scan universe");
    return {
      symbol: ticker,
      exists: true,
      active: row.active,
      latestBarDate: row.latestBarDate,
      inEffectiveUniverse: row.inEffectiveUniverse,
      latestScanConsidered: row.latestScanConsidered,
      barCount: row.barCount,
      avgValue20Vnd: row.avgValue20Vnd,
      reasonGuess: row.reasonGuess,
      notes: notes.join("; "),
    };
  });

  const indexLatest = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX" },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const equityMax = await prisma.stockDailyBar.aggregate({
    _max: { date: true },
    _count: true,
  });

  const latestScan = await prisma.dailyScanRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { runAt: "desc" },
    select: {
      id: true,
      runAt: true,
      symbolCountTotal: true,
      symbolCountAfterTradability: true,
      candidateCountSurfaced: true,
    },
  });

  const out = {
    probedAt: new Date().toISOString(),
    databaseUrlHint: describeDatabaseUrl(),
    expectedLatestSession: expected.toISOString(),
    expectedLatestSessionDay: isoDay(expected),
    vnindexLatest: indexLatest?.date.toISOString() ?? null,
    equityMaxDate: equityMax._max.date?.toISOString() ?? null,
    equityBarCount: equityMax._count,
    latestScan,
    effectiveUniverseCount: universe.stats.effectiveCount,
    snapshot,
    importantAudit,
    topStaleLiquidInactive,
    staleRanked: staleRanked.slice(0, 120),
    staleByLatestDate: Object.entries(
      staleRanked.reduce<Record<string, number>>((acc, r) => {
        const k = r.latestBarDate ?? "null";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([latestBarDate, count]) => ({ latestBarDate, count })),
  };

  if (jsonOut) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, JSON.stringify(out, null, 2), "utf-8");
    console.error(`Wrote ${jsonOut}`);
  }

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
