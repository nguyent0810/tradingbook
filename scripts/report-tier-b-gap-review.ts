/**
 * Post-backfill gap review for Tier B symbols not session-aligned (read-only + report).
 *
 *   SMOKE_DATABASE=production npx tsx scripts/report-tier-b-gap-review.ts \
 *     --cohort-file=data/expansion-300-cohort.json \
 *     --fetch-dir=reports/cohort-backfill \
 *     --out=reports/cohort-backfill/tier-b-gap-report.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (process.env.SMOKE_DATABASE === "production") {
  config({ path: resolve(root, ".env.prod.local"), override: true });
}

import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { describeDatabaseUrl } from "./load-env";
import { resolveTierSymbols } from "./lib/cohort-tier";

type CohortDoc = {
  additiveByTier?: { tierB?: string[] };
  symbolMetadata?: Record<
    string,
    {
      tier?: string;
      barCount?: number;
      latestBarDate?: string;
      weekdaySessionsStale?: number;
      avgValue20Vnd?: number;
    }
  >;
};

type GapClassification =
  | "illiquid_no_trade_on_latest_session"
  | "provider_missing_latest_bar"
  | "stale_retryable"
  | "exclude_from_activation_cohort";

type FetchOutcome =
  | "no_usable_rows"
  | "rows_but_no_latest_session"
  | "rows_include_latest_session";

function parseArg(argv: string[], prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length);
}

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  return utcDayOnly(d).toISOString().slice(0, 10);
}

function countWeekdaysInclusive(start: Date, end: Date): number {
  const a = utcDayOnly(start);
  const b = utcDayOnly(end);
  if (b.getTime() < a.getTime()) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

function sessionsBehind(latest: Date | null, expected: Date): number | null {
  if (!latest) return null;
  return Math.max(0, countWeekdaysInclusive(latest, expected) - 1);
}

function loadFetchMaxBySymbol(fetchDir: string): Map<string, { barCount: number; maxDay: string | null }> {
  const out = new Map<string, { barCount: number; maxDay: string | null }>();
  let files: string[];
  try {
    files = readdirSync(fetchDir).filter((f) => f.startsWith("cohort-stock-bars-shard-") && f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(fetchDir, file), "utf-8")) as unknown;
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (entry == null || typeof entry !== "object") continue;
      const e = entry as { symbol?: string; bars?: Array<{ time?: number }> };
      const sym = e.symbol?.trim().toUpperCase();
      if (!sym) continue;
      const bars = Array.isArray(e.bars) ? e.bars : [];
      let maxMs = 0;
      for (const b of bars) {
        if (typeof b.time === "number" && b.time > maxMs) maxMs = b.time;
      }
      const maxDay = maxMs > 0 ? isoDay(new Date(maxMs)) : null;
      const prev = out.get(sym);
      if (!prev || (maxDay ?? "") > (prev.maxDay ?? "")) {
        out.set(sym, { barCount: bars.length, maxDay });
      }
    }
  }
  return out;
}

function classifyGap(input: {
  sessionsBehind: number | null;
  avgValue20Vnd: number | null;
  fetchOutcome: FetchOutcome;
  fetchImproved: boolean;
}): GapClassification {
  const sb = input.sessionsBehind ?? 999;
  const liq = input.avgValue20Vnd ?? 0;

  if (sb >= 10 || (sb >= 6 && liq < 100_000_000)) {
    return "exclude_from_activation_cohort";
  }
  if (input.fetchOutcome === "no_usable_rows") {
    return sb <= 4 ? "stale_retryable" : "provider_missing_latest_bar";
  }
  if (sb <= 4 && liq >= 100_000_000) {
    return "stale_retryable";
  }
  if (sb <= 4) {
    return "illiquid_no_trade_on_latest_session";
  }
  if (sb <= 9 && !input.fetchImproved) {
    return "provider_missing_latest_bar";
  }
  return "illiquid_no_trade_on_latest_session";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cohortFile =
    parseArg(argv, "--cohort-file=") ?? resolve(root, "data/expansion-300-cohort.json");
  const fetchDir = parseArg(argv, "--fetch-dir=") ?? resolve(root, "reports/cohort-backfill");
  const outPath =
    parseArg(argv, "--out=") ?? resolve(root, "reports/cohort-backfill/tier-b-gap-report.json");

  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as CohortDoc;
  const tierB = resolveTierSymbols(doc, "b");
  const tierBRank = new Map(tierB.map((s, i) => [s, i + 1]));
  const fetchBySym = loadFetchMaxBySymbol(fetchDir);

  const { prisma } = await import("../src/lib/prisma");
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) throw new Error("No VNINDEX session");
  const expectedDay = isoDay(expected);
  const expectedMs = utcDayOnly(expected).getTime();

  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: tierB } },
    select: {
      symbol: true,
      active: true,
      bars: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      _count: { select: { bars: true } },
    },
  });
  const rowBy = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

  const gaps: Array<Record<string, unknown>> = [];
  for (const sym of tierB) {
    const row = rowBy.get(sym);
    const latest = row?.bars[0]?.date ?? null;
    const aligned = latest != null && utcDayOnly(latest).getTime() === expectedMs;
    if (aligned) continue;

    const meta = doc.symbolMetadata?.[sym];
    const latestDay = latest ? isoDay(latest) : null;
    const sb = sessionsBehind(latest, expected);
    const fetch = fetchBySym.get(sym);
    const fetchMax = fetch?.maxDay ?? null;
    const preAuditLatest = meta?.latestBarDate ?? null;

    let fetchOutcome: FetchOutcome = "no_usable_rows";
    if (fetch && fetch.barCount > 0) {
      fetchOutcome =
        fetchMax != null && utcDayOnly(new Date(fetchMax)).getTime() >= expectedMs
          ? "rows_include_latest_session"
          : "rows_but_no_latest_session";
    }
    const fetchImproved =
      preAuditLatest != null && latestDay != null ? latestDay > preAuditLatest : latestDay != null;

    const classification = classifyGap({
      sessionsBehind: sb,
      avgValue20Vnd: meta?.avgValue20Vnd ?? null,
      fetchOutcome,
      fetchImproved,
    });

    gaps.push({
      symbol: sym,
      latestBarDate: latestDay,
      weekdaySessionsStale: sb,
      barCount: row?._count.bars ?? 0,
      avgValue20Vnd: meta?.avgValue20Vnd ?? null,
      tier: meta?.tier ?? "B",
      tierBLiquidityRank: tierBRank.get(sym) ?? null,
      fetchOutcome,
      fetchMaxBarDate: fetchMax,
      fetchBarCount: fetch?.barCount ?? 0,
      preAuditLatestBarDate: preAuditLatest,
      fetchImprovedVsAudit: fetchImproved,
      classification,
      retryable: classification === "stale_retryable",
    });
  }

  const retryable = gaps.filter((g) => g.retryable === true).map((g) => g.symbol as string);
  const byClass = gaps.reduce(
    (acc, g) => {
      const k = g.classification as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const report = {
    generatedAt: new Date().toISOString(),
    databaseUrlHint: describeDatabaseUrl(),
    expectedLatestSessionDay: expectedDay,
    tierBTotal: tierB.length,
    gapCount: gaps.length,
    alignedCount: tierB.length - gaps.length,
    classificationCounts: byClass,
    retryableSymbols: retryable,
    retryableCount: retryable.length,
    gaps,
  };

  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  const retryPath = resolve(root, "reports/cohort-backfill/tier-b-gap-retry-symbols.json");
  writeFileSync(retryPath, JSON.stringify({ symbols: retryable }, null, 2), "utf-8");

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
