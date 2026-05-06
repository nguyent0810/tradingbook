/**
 * Explicit DB curation: choose which StockSymbol rows are `active` based on bar coverage
 * and optional scanner-compatible tradability checks. Does **not** change scanner rules.
 *
 * Default is dry-run (no writes). Persist only with `--apply`.
 *
 * Usage:
 *   npx tsx scripts/curate-active-symbols.ts --target=300 --require-latest-bar --min-bars=120
 *   npx tsx scripts/curate-active-symbols.ts --target=300 --require-tradability --sort=liquidity20d --apply
 *
 * `--min-bars` is the minimum count of daily bars stored (matches TRADABILITY_MIN_BARS when set to 120).
 */
import { writeFileSync } from "fs";
import { join } from "path";
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { TRADABILITY_MIN_BARS } from "../src/lib/scanner/tradability-constants";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import { describeDatabaseUrl } from "./load-env";

const ACTIVE_KEYS_OUT = join(process.cwd(), "data", "active-symbol-keys.json");

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parsePositiveInt(argv: string[], prefix: string): number | null {
  const raw = argv.find((x) => x.startsWith(prefix));
  if (!raw) return null;
  const v = Number.parseInt(raw.slice(prefix.length), 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

async function meanVolumeLast20(symbolId: string): Promise<number> {
  const rows = await prisma.stockDailyBar.findMany({
    where: { symbolId },
    orderBy: { date: "desc" },
    take: 20,
    select: { volume: true },
  });
  if (rows.length === 0) return 0;
  const sum = rows.reduce((a, r) => a + r.volume, 0);
  return sum / rows.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const target = parsePositiveInt(argv, "--target=") ?? 300;
  const minBars = parsePositiveInt(argv, "--min-bars=") ?? TRADABILITY_MIN_BARS;
  const requireLatestBar = hasFlag(argv, "--require-latest-bar");
  const requireTradability = hasFlag(argv, "--require-tradability");
  const sortRaw = argv.find((a) => a.startsWith("--sort="));
  const sortMode =
    sortRaw?.slice("--sort=".length).trim() === "liquidity20d"
      ? "liquidity20d"
      : "alphabetical";
  const apply = hasFlag(argv, "--apply");

  console.error("curate-active-symbols.ts → DATABASE_URL:", describeDatabaseUrl());
  console.error(
    JSON.stringify(
      {
        target,
        minBars,
        requireLatestBar,
        requireTradability,
        sortMode,
        apply,
      },
      null,
      2
    )
  );

  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    console.error("Abort: no VNINDEX IndexDailyBar — cannot align session.");
    process.exit(1);
  }

  const expectedMs = utcDayOnly(expected).getTime();

  const allSymbols = await prisma.stockSymbol.findMany({
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  const allIds = allSymbols.map((s) => s.id);

  const counts =
    allIds.length === 0
      ? []
      : await prisma.stockDailyBar.groupBy({
          by: ["symbolId"],
          where: { symbolId: { in: allIds } },
          _count: { _all: true },
        });
  const countById = new Map(counts.map((c) => [c.symbolId, c._count._all] as const));

  const latestRows =
    allIds.length === 0
      ? []
      : await prisma.stockDailyBar.findMany({
          where: { symbolId: { in: allIds } },
          distinct: ["symbolId"],
          orderBy: [{ symbolId: "asc" }, { date: "desc" }],
          select: { symbolId: true, date: true },
        });
  const latestBySymbolId = new Map(latestRows.map((r) => [r.symbolId, r.date] as const));

  let eligible = allSymbols.filter((s) => {
    const n = countById.get(s.id) ?? 0;
    if (n < minBars) return false;
    if (requireLatestBar) {
      const latest = latestBySymbolId.get(s.id);
      if (latest == null || utcDayOnly(latest).getTime() !== expectedMs) return false;
    }
    return true;
  });

  if (requireTradability) {
    const next: typeof eligible = [];
    for (const s of eligible) {
      const res = await evaluateTradabilityForSymbolId(prisma, s.id, expected);
      if (res.passed) next.push(s);
    }
    eligible = next;
  }

  if (eligible.length === 0) {
    console.error("Abort: zero symbols match filters — no activation changes.");
    process.exit(1);
  }

  if (eligible.length < target) {
    console.error(
      `Warning: only ${eligible.length} symbols match filters (target ${target}); activating all eligible.`
    );
  }

  let ordered = [...eligible];
  if (sortMode === "liquidity20d") {
    const scored = await Promise.all(
      eligible.map(async (s) => ({
        s,
        avgVol: await meanVolumeLast20(s.id),
      }))
    );
    scored.sort((a, b) => {
      if (b.avgVol !== a.avgVol) return b.avgVol - a.avgVol;
      return a.s.symbol.localeCompare(b.s.symbol);
    });
    ordered = scored.map((x) => x.s);
  } else {
    ordered.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  const selected = ordered.slice(0, Math.min(target, ordered.length));
  const selectedIds = new Set(selected.map((s) => s.id));

  const summary = {
    expectedLatestSessionDay: utcDayOnly(expected).toISOString(),
    totalSymbolsInDb: allSymbols.length,
    eligibleAfterFilters: eligible.length,
    activatedCount: selected.length,
    deactivatedCount: allSymbols.length - selected.length,
    sortMode,
    selectedSymbolsPreview: selected.slice(0, 40).map((s) => s.symbol),
  };

  console.log(JSON.stringify({ planSummary: summary }, null, 2));

  if (!apply) {
    console.error(
      "Dry-run only (no DB updates). Re-run with --apply to persist active flags and write active-symbol-keys.json."
    );
    return;
  }

  await prisma.$transaction([
    prisma.stockSymbol.updateMany({
      where: { id: { in: [...selectedIds] } },
      data: { active: true },
    }),
    prisma.stockSymbol.updateMany({
      where: { id: { notIn: [...selectedIds] } },
      data: { active: false },
    }),
  ]);

  const keys = selected.map((s) => s.symbol).sort((a, b) => a.localeCompare(b));
  writeFileSync(ACTIVE_KEYS_OUT, JSON.stringify({ symbols: keys }, null, 2), "utf-8");

  console.error(`Applied: ${selected.length} active, wrote ${ACTIVE_KEYS_OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
