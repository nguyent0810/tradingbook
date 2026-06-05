/**
 * Shared read-only helpers: which symbols need an equity fetch vs VNINDEX session.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "../../src/lib/scanner/expected-session";

export const FETCH_SECONDS_PER_SYMBOL_ESTIMATE = 3.55;

export function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return utcDayOnly(d).toISOString().slice(0, 10);
}

export type FetchTargetRow = {
  symbol: string;
  reason: "missing_bars" | "stale_session";
  latestBarDay: string | null;
  barCount: number;
};

export type FetchTargetSelection = {
  expectedLatestSession: Date;
  expectedLatestSessionDay: string;
  universeSize: number;
  activeSymbolCount: number;
  alignedCount: number;
  missingBarsCount: number;
  staleSessionCount: number;
  fetchTargetCount: number;
  fetchTargets: string[];
  rows: FetchTargetRow[];
  latestSessionCoveragePct: number | null;
};

export function sliceShard<T>(items: readonly T[], shardIndex: number, shardCount: number): T[] {
  if (shardCount < 1) throw new Error("shardCount must be >= 1");
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`shardIndex must be 0..${shardCount - 1}`);
  }
  return items.filter((_, i) => i % shardCount === shardIndex);
}

/** Deterministic round-robin partition of a frozen fetch-target list (no DB re-list). */
export function partitionFetchTargets(
  symbols: readonly string[],
  shardCount: number
): string[][] {
  if (shardCount < 1) throw new Error("shardCount must be >= 1");
  return Array.from({ length: shardCount }, (_, shardIndex) =>
    sliceShard(symbols, shardIndex, shardCount)
  );
}

/** Count symbols appearing in more than one shard (expected 0 for frozen split). */
export function computeShardOverlapCount(shards: readonly (readonly string[])[]): number {
  const seen = new Set<string>();
  let overlap = 0;
  for (const shard of shards) {
    for (const symbol of shard) {
      if (seen.has(symbol)) overlap += 1;
      else seen.add(symbol);
    }
  }
  return overlap;
}

export type FrozenShardSplitStats = {
  initialFetchTargetCount: number;
  shardTargetCounts: number[];
  uniqueTargetCount: number;
  overlapCount: number;
};

export function frozenShardSplitStats(shards: readonly (readonly string[])[]): FrozenShardSplitStats {
  const flat = shards.flat();
  const unique = new Set(flat);
  return {
    initialFetchTargetCount: flat.length,
    shardTargetCounts: shards.map((s) => s.length),
    uniqueTargetCount: unique.size,
    overlapCount: flat.length - unique.size,
  };
}

import { readFileSync } from "fs";

export function loadSymbolsFromFetchJson(path: string): string[] {
  const data = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (data === null || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.symbols)) return [];
  return o.symbols
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean);
}

export async function selectFetchTargets(
  prisma: PrismaClient,
  options: {
    activeOnly: boolean;
    includeRetrySymbols?: string[];
  }
): Promise<FetchTargetSelection> {
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) {
    throw new Error("No VNINDEX IndexDailyBar rows — cannot compute expected latest session.");
  }
  const expectedMs = utcDayOnly(expected).getTime();
  const expectedDay = isoDay(expected);

  const symbols = await prisma.stockSymbol.findMany({
    where: options.activeOnly ? { active: true } : undefined,
    select: { id: true, symbol: true, active: true },
    orderBy: { symbol: "asc" },
  });
  const ids = symbols.map((s) => s.id);
  const activeSymbolCount = symbols.filter((s) => s.active).length;

  const counts =
    ids.length === 0
      ? []
      : await prisma.stockDailyBar.groupBy({
          by: ["symbolId"],
          where: { symbolId: { in: ids } },
          _count: { _all: true },
        });
  const countById = new Map(counts.map((c) => [c.symbolId, c._count._all] as const));

  const latestRows =
    ids.length === 0
      ? []
      : await prisma.stockDailyBar.findMany({
          where: { symbolId: { in: ids } },
          distinct: ["symbolId"],
          orderBy: [{ symbolId: "asc" }, { date: "desc" }],
          select: { symbolId: true, date: true },
        });
  const latestById = new Map(latestRows.map((r) => [r.symbolId, r.date] as const));

  const rows: FetchTargetRow[] = [];
  let alignedCount = 0;

  for (const s of symbols) {
    const n = countById.get(s.id) ?? 0;
    const latest = latestById.get(s.id);
    if (n === 0) {
      rows.push({
        symbol: s.symbol,
        reason: "missing_bars",
        latestBarDay: null,
        barCount: 0,
      });
      continue;
    }
    if (latest == null || utcDayOnly(latest).getTime() !== expectedMs) {
      rows.push({
        symbol: s.symbol,
        reason: "stale_session",
        latestBarDay: latest ? isoDay(latest) : null,
        barCount: n,
      });
      continue;
    }
    alignedCount++;
  }

  const baseTargets = rows.map((r) => r.symbol);
  const retryExtra = (options.includeRetrySymbols ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const fetchTargets = [...new Set([...baseTargets, ...retryExtra])].sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    expectedLatestSession: expected,
    expectedLatestSessionDay: expectedDay,
    universeSize: symbols.length,
    activeSymbolCount,
    alignedCount,
    missingBarsCount: rows.filter((r) => r.reason === "missing_bars").length,
    staleSessionCount: rows.filter((r) => r.reason === "stale_session").length,
    fetchTargetCount: fetchTargets.length,
    fetchTargets,
    rows,
    latestSessionCoveragePct:
      symbols.length === 0
        ? null
        : Number(((100 * alignedCount) / symbols.length).toFixed(2)),
  };
}
