/**
 * Active-symbol universe quality vs VNINDEX session + scanner tradability thresholds.
 *
 * Usage:
 *   npx tsx scripts/report-symbol-universe-quality.ts
 *   npx tsx scripts/report-symbol-universe-quality.ts --sample=60
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { TRADABILITY_REASON } from "../src/lib/scanner/tradability-constants";
import { evaluateTradabilityForAllActiveSymbols } from "../src/lib/scanner/tradability";
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

/** Calendar days latest bar is strictly before expected session (0 = aligned). */
function calendarDaysStale(expected: Date, latest: Date): number {
  const e = utcDayOnly(expected).getTime();
  const l = utcDayOnly(latest).getTime();
  return Math.round((e - l) / 86_400_000);
}

function parseSampleLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--sample="));
  if (!raw) return 40;
  const n = Number.parseInt(raw.slice("--sample=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 40;
}

async function main(): Promise<void> {
  const sampleLimit = parseSampleLimit(process.argv.slice(2));

  console.error("report-symbol-universe-quality.ts → DATABASE_URL:", describeDatabaseUrl());

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
  const counts =
    activeIds.length === 0
      ? []
      : await prisma.stockDailyBar.groupBy({
          by: ["symbolId"],
          where: { symbolId: { in: activeIds } },
          _count: { _all: true },
        });
  const countById = new Map(counts.map((c) => [c.symbolId, c._count._all] as const));

  const latestRows =
    activeIds.length === 0
      ? []
      : await prisma.stockDailyBar.findMany({
          where: { symbolId: { in: activeIds } },
          distinct: ["symbolId"],
          orderBy: [{ symbolId: "asc" }, { date: "desc" }],
          select: { symbolId: true, date: true },
        });
  const latestBySymbolId = new Map(latestRows.map((r) => [r.symbolId, r.date] as const));

  const expectedMs = utcDayOnly(expected).getTime();

  let symbolsWithBars = 0;
  let symbolsWithLatestSessionBar = 0;
  let staleMissingBars = 0;
  let staleOneCalendarDay = 0;
  let staleTwoToFiveCalendarDays = 0;
  let staleGtFiveCalendarDays = 0;

  type StaleRow = {
    symbol: string;
    latestBarDay: string | null;
    barCount: number;
    calendarDaysBehindSession: number | null;
  };
  const staleForSort: StaleRow[] = [];

  for (const sym of active) {
    const barCount = countById.get(sym.id) ?? 0;
    const latest = latestBySymbolId.get(sym.id);

    if (barCount === 0 || latest == null) {
      staleMissingBars++;
      staleForSort.push({
        symbol: sym.symbol,
        latestBarDay: null,
        barCount: 0,
        calendarDaysBehindSession: null,
      });
      continue;
    }

    symbolsWithBars++;
    const aligned = utcDayOnly(latest).getTime() === expectedMs;
    if (aligned) {
      symbolsWithLatestSessionBar++;
      continue;
    }

    const behind = calendarDaysStale(expected, latest);
    if (behind === 1) staleOneCalendarDay++;
    else if (behind >= 2 && behind <= 5) staleTwoToFiveCalendarDays++;
    else staleGtFiveCalendarDays++;

    staleForSort.push({
      symbol: sym.symbol,
      latestBarDay: isoDay(latest),
      barCount,
      calendarDaysBehindSession: behind,
    });
  }

  staleForSort.sort((a, b) => {
    const ba = a.calendarDaysBehindSession ?? 9999;
    const bb = b.calendarDaysBehindSession ?? 9999;
    if (bb !== ba) return bb - ba;
    return a.symbol.localeCompare(b.symbol);
  });
  const sampleStaleSymbols = staleForSort.slice(0, sampleLimit);

  const { items, aggregate } = await evaluateTradabilityForAllActiveSymbols(
    prisma,
    expected
  );

  let symbolsFailingVolume20d = 0;
  let symbolsFailingValue20d = 0;
  let symbolsFailingPrice = 0;
  let symbolsFailingStaleSession = 0;
  let symbolsFailingGap = 0;
  let symbolsFailingInsufficientHistory = 0;

  for (const it of items) {
    const r = it.result.reasons;
    if (r.includes(TRADABILITY_REASON.VOLUME_20D)) symbolsFailingVolume20d++;
    if (r.includes(TRADABILITY_REASON.VALUE_20D)) symbolsFailingValue20d++;
    if (r.includes(TRADABILITY_REASON.PRICE)) symbolsFailingPrice++;
    if (r.includes(TRADABILITY_REASON.STALE_DATA)) symbolsFailingStaleSession++;
    if (r.includes(TRADABILITY_REASON.GAP_CALENDAR)) symbolsFailingGap++;
    if (r.includes(TRADABILITY_REASON.INSUFFICIENT_HISTORY))
      symbolsFailingInsufficientHistory++;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    expectedLatestSession: expected.toISOString(),
    expectedLatestSessionDay: isoDay(expected),
    activeSymbols: active.length,
    symbolsWithBars,
    symbolsWithoutBars: staleMissingBars,
    symbolsWithLatestSessionBar,
    staleByCalendarDayLag: {
      /** Latest bar exactly one UTC calendar day before expected session */
      oneDay: staleOneCalendarDay,
      /** Latest bar 2–5 UTC calendar days before expected session */
      twoToFiveDays: staleTwoToFiveCalendarDays,
      /** Latest bar more than 5 UTC calendar days before expected session */
      moreThanFiveDays: staleGtFiveCalendarDays,
      /** No bars or could not classify (missing rows only here + lag buckets) */
      missingBars: staleMissingBars,
    },
    tradabilityFromScannerHelpers: {
      passedTradability: aggregate.passedTradability,
      failedTradability: aggregate.filteredOut,
      breakdownByReasonMultiCounted: aggregate.breakdownByReason,
      symbolsFailingVolume20d,
      symbolsFailingValue20d,
      symbolsFailingPrice,
      symbolsFailingStaleSession,
      symbolsFailingGap,
      symbolsFailingInsufficientHistory,
    },
    sampleStaleSymbols,
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
