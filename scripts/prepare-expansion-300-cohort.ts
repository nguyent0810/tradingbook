/**
 * Read-only: build reviewed additive 206→300 expansion cohort JSON.
 * No DB writes. Does not activate symbols.
 *
 *   SMOKE_DATABASE=production npx tsx scripts/prepare-expansion-300-cohort.ts
 *   SMOKE_DATABASE=production npx tsx scripts/prepare-expansion-300-cohort.ts --out=data/expansion-300-cohort.json
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

import { describeDatabaseUrl } from "./load-env";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import {
  TRADABILITY_MIN_AVG_VALUE_VND_20,
  TRADABILITY_MIN_BARS,
  TRADABILITY_ROLLING_DAYS,
} from "../src/lib/scanner/tradability-constants";
import { tradedValueVnd } from "../src/lib/scanner/price-units";

const TARGET_ACTIVE = 300;
const ADDITIVE_COUNT = 94;
const MAX_WEEKDAY_STALE = 60;

/** Separate cold-start track — never in +94 additive cohort unless explicitly approved. */
const COLD_START_TRACK = new Set(["HCM", "VCI", "DIG", "DXG", "KBC"]);

/** Manual review exclusions (extreme staleness / prior recovery notes). */
const MANUAL_EXCLUDE: Record<string, string> = {
  BCG: "Extreme staleness (172 weekday sessions); excluded in core-universe-recovery notes",
  DAG: "Extreme staleness (472 weekday sessions)",
  CCP: "Extreme staleness (180 weekday sessions)",
  CK8: "Extreme staleness (140 weekday sessions)",
};

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  return utcDayOnly(d).toISOString().slice(0, 10);
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

function parseOut(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith("--out="));
  if (flag) return flag.slice("--out=".length);
  return resolve(root, "data", "expansion-300-cohort.json");
}

type SymbolMeta = {
  symbol: string;
  tier: "A" | "B";
  barCount: number;
  latestBarDate: string | null;
  weekdaySessionsStale: number | null;
  avgValue20Vnd: number | null;
  exchange: string | null;
  name: string | null;
  sessionAligned: boolean;
  notes: string | null;
};

type Exclusion = {
  symbol: string;
  reason: string;
  category: "cold_start" | "extreme_staleness" | "manual" | "zero_bars" | "insufficient_bars" | "already_active";
  barCount?: number;
  weekdaySessionsStale?: number | null;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL unset. Use SMOKE_DATABASE=production with .env.prod.local.");
    process.exit(1);
  }

  const outPath = parseOut(process.argv.slice(2));
  const { prisma } = await import("../src/lib/prisma");

  console.error("prepare-expansion-300-cohort.ts → DATABASE_URL:", describeDatabaseUrl());

  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    console.error("No VNINDEX session.");
    process.exit(1);
  }
  const expectedMs = utcDayOnly(expected).getTime();

  const allSymbols = await prisma.stockSymbol.findMany({
    select: { id: true, symbol: true, name: true, active: true, exchange: true },
    orderBy: { symbol: "asc" },
  });

  const barCounts = await prisma.stockDailyBar.groupBy({
    by: ["symbolId"],
    _count: { _all: true },
    _max: { date: true },
  });
  const countById = new Map(barCounts.map((c) => [c.symbolId, c._count._all] as const));
  const maxDateById = new Map(barCounts.map((c) => [c.symbolId, c._max.date] as const));

  const baselineActiveSymbols = allSymbols
    .filter((s) => s.active)
    .map((s) => s.symbol.trim().toUpperCase())
    .sort((a, b) => a.localeCompare(b));

  if (baselineActiveSymbols.length !== 206) {
    console.error(
      `Warning: expected 206 baseline actives, found ${baselineActiveSymbols.length}. Proceeding with live snapshot.`
    );
  }

  const exclusions: Exclusion[] = [];
  const activeSet = new Set(baselineActiveSymbols);

  for (const sym of COLD_START_TRACK) {
    exclusions.push({
      symbol: sym,
      reason: "0-bar cold-start track — separate fetch path before any activation",
      category: "cold_start",
      barCount: countById.get(allSymbols.find((s) => s.symbol.toUpperCase() === sym)?.id ?? "") ?? 0,
    });
  }

  for (const [sym, reason] of Object.entries(MANUAL_EXCLUDE)) {
    exclusions.push({ symbol: sym, reason, category: "manual" });
  }

  type Candidate = SymbolMeta & { avgValue20VndSort: number };
  const candidates: Candidate[] = [];

  for (const sym of allSymbols) {
    const key = sym.symbol.trim().toUpperCase();
    if (sym.active) {
      if ([...COLD_START_TRACK, ...Object.keys(MANUAL_EXCLUDE)].includes(key)) {
        exclusions.push({
          symbol: key,
          reason: "Already active in baseline — not additive",
          category: "already_active",
        });
      }
      continue;
    }

    const barCount = countById.get(sym.id) ?? 0;
    const latest = maxDateById.get(sym.id) ?? null;
    const sessionAligned =
      latest != null && utcDayOnly(latest).getTime() === expectedMs;
    const weekdaySessionsStale =
      latest != null ? countWeekdaysInclusive(latest, expected) - 1 : null;

    if (barCount === 0) {
      if (!COLD_START_TRACK.has(key)) {
        exclusions.push({
          symbol: key,
          reason: "No bars in DB — not in approved cold-start track",
          category: "zero_bars",
          barCount: 0,
        });
      }
      continue;
    }

    if (barCount < TRADABILITY_MIN_BARS) {
      exclusions.push({
        symbol: key,
        reason: `barCount ${barCount} < ${TRADABILITY_MIN_BARS}`,
        category: "insufficient_bars",
        barCount,
      });
      continue;
    }

    if (COLD_START_TRACK.has(key) || MANUAL_EXCLUDE[key]) continue;

    if (weekdaySessionsStale != null && weekdaySessionsStale > MAX_WEEKDAY_STALE) {
      exclusions.push({
        symbol: key,
        reason: `weekdaySessionsStale ${weekdaySessionsStale} > ${MAX_WEEKDAY_STALE}`,
        category: "extreme_staleness",
        barCount,
        weekdaySessionsStale,
      });
      continue;
    }

    const last20 = await prisma.stockDailyBar.findMany({
      where: { symbolId: sym.id },
      orderBy: { date: "desc" },
      take: TRADABILITY_ROLLING_DAYS,
      select: { close: true, volume: true },
    });
    const avgValue20Vnd =
      last20.length >= TRADABILITY_ROLLING_DAYS
        ? last20.reduce((s, b) => s + tradedValueVnd(b.close, b.volume), 0) / last20.length
        : null;

    candidates.push({
      symbol: key,
      tier: "B",
      barCount,
      latestBarDate: latest ? isoDay(latest) : null,
      weekdaySessionsStale,
      avgValue20Vnd,
      exchange: sym.exchange,
      name: sym.name,
      sessionAligned,
      notes: sessionAligned ? null : "Requires backfill before scan contribution",
      avgValue20VndSort: avgValue20Vnd ?? 0,
    });
  }

  const tierA = candidates
    .filter(
      (c) =>
        c.avgValue20Vnd != null && c.avgValue20Vnd >= TRADABILITY_MIN_AVG_VALUE_VND_20
    )
    .sort((a, b) => b.avgValue20VndSort - a.avgValue20VndSort || a.symbol.localeCompare(b.symbol))
    .map((c) => ({ ...c, tier: "A" as const }));

  const tierAKeys = new Set(tierA.map((c) => c.symbol));
  const tierBPool = candidates
    .filter((c) => !tierAKeys.has(c.symbol))
    .sort((a, b) => b.avgValue20VndSort - a.avgValue20VndSort || a.symbol.localeCompare(b.symbol));

  const additivePicked: SymbolMeta[] = [...tierA];
  for (const c of tierBPool) {
    if (additivePicked.length >= ADDITIVE_COUNT) break;
    additivePicked.push({ ...c, tier: "B" });
  }

  if (additivePicked.length < ADDITIVE_COUNT) {
    console.error(
      `Error: only ${additivePicked.length} additive candidates after filters (need ${ADDITIVE_COUNT}).`
    );
    process.exit(1);
  }

  const additiveSymbols = additivePicked.slice(0, ADDITIVE_COUNT).map((c) => c.symbol);
  const additiveSet = new Set(additiveSymbols);
  if (additiveSet.size !== ADDITIVE_COUNT) {
    console.error("Error: duplicate symbols in additive pick.");
    process.exit(1);
  }

  for (const sym of baselineActiveSymbols) {
    if (additiveSet.has(sym)) {
      console.error(`Error: baseline active ${sym} also in additive list.`);
      process.exit(1);
    }
  }

  const doc = {
    version: 1,
    generatedAt: new Date().toISOString(),
    databaseUrlHint: describeDatabaseUrl(),
    expectedLatestSessionDay: isoDay(expected),
    policy: {
      mode: "additive_only",
      baselineActiveCount: baselineActiveSymbols.length,
      additiveTargetCount: ADDITIVE_COUNT,
      intendedActiveCount: baselineActiveSymbols.length + ADDITIVE_COUNT,
      batchB1: "NO-GO",
      wholesaleCurateApply: "NO-GO",
      coldStartTrack: [...COLD_START_TRACK].sort(),
      minBars: TRADABILITY_MIN_BARS,
      tierAMinAvgValue20Vnd: TRADABILITY_MIN_AVG_VALUE_VND_20,
      maxWeekdaySessionsStale: MAX_WEEKDAY_STALE,
    },
    baselineActiveSymbols,
    additiveSymbols,
    additiveByTier: {
      tierA: additivePicked.filter((c) => c.tier === "A").map((c) => c.symbol),
      tierB: additivePicked.filter((c) => c.tier === "B").map((c) => c.symbol),
    },
    symbolMetadata: Object.fromEntries(
      additivePicked.map((c) => [
        c.symbol,
        {
          tier: c.tier,
          barCount: c.barCount,
          latestBarDate: c.latestBarDate,
          weekdaySessionsStale: c.weekdaySessionsStale,
          avgValue20Vnd: c.avgValue20Vnd,
          exchange: c.exchange,
          name: c.name,
          sessionAligned: c.sessionAligned,
          notes: c.notes,
        },
      ])
    ),
    exclusions: exclusions.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    reviewWarnings: [
      "All additive symbols require session backfill (0 session-aligned inactive at audit time).",
      "Tier B tail includes names below 2B VND 20d avg — review liquidity before backfill GO.",
      "Do not use curate-active-symbols --apply (would deactivate baseline actives).",
    ],
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
  console.log(
    JSON.stringify(
      {
        outPath,
        baselineActiveCount: baselineActiveSymbols.length,
        additiveCount: additiveSymbols.length,
        tierACount: doc.additiveByTier.tierA.length,
        tierBCount: doc.additiveByTier.tierB.length,
        intendedActiveCount: doc.policy.intendedActiveCount,
        exclusionCount: exclusions.length,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
