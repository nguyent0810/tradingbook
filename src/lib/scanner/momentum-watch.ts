/**
 * Server-side Momentum Watch (Fresh Breakout Audit) rows for read-only UI.
 * Does not persist SetupCandidate or mutate scanner state.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  classifyFreshBreakout,
  compareFreshBreakoutRows,
  computeFreshBreakoutMetrics,
  determineFreshBreakoutGroup,
  shouldIncludeFreshBreakoutRow,
  type FreshBreakoutAuditGroup,
} from "@/lib/scanner/fresh-breakout-audit";
import { evaluateTradability } from "@/lib/scanner/tradability";
import { tradabilityLookbackFromDate } from "@/lib/scanner/tradability-constants";
import {
  computeEffectiveScanUniverse,
  listActiveTacticalSymbols,
  type UniverseSource,
} from "@/lib/tactical-universe";

export const MOMENTUM_WATCH_UI_DISCLAIMER =
  "Chỉ theo dõi — chưa phải thiết lập đã được xác thực";

export type MomentumWatchUiRow = {
  symbol: string;
  universeSource: UniverseSource;
  group: FreshBreakoutAuditGroup;
  labels: string[];
  riskAnnotations: string[];
  latestClose: number;
  volumeRatio20: number | null;
  breakoutExtensionPct: number | null;
  latestBarDate: string;
  whyNotCoreSetup: string;
};

const CORE_SETUP_EXPLANATION =
  "Core scanner only surfaces Tier A/B breakout-pullback setups after Gate2; this row is momentum diagnostics only and is not a validated setup.";

function buildWhyNotCoreSetup(notes: readonly string[]): string {
  const joined = notes.filter(Boolean).join(" ");
  return joined ? `${CORE_SETUP_EXPLANATION} ${joined}` : CORE_SETUP_EXPLANATION;
}

export type GetMomentumWatchRowsOptions = {
  /** Max rows returned after ranking (default 20). */
  limit?: number;
  /** Include EXTENDED_WATCH_ONLY group (default true). */
  includeExtendedWatchOnly?: boolean;
  /** Passed to audit row filter (default false — hide failed-risk-only noise). */
  includeFailedRisk?: boolean;
};

/**
 * Loads merged universe, evaluates Fresh Breakout Audit logic once per symbol,
 * returns ranked rows for ACTIONABLE_WATCH (and optionally EXTENDED_WATCH_ONLY).
 */
export async function getMomentumWatchRowsForPhase1(
  prisma: PrismaClient,
  options?: GetMomentumWatchRowsOptions
): Promise<MomentumWatchUiRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const includeExtended = options?.includeExtendedWatchOnly ?? true;
  const includeFailedRisk = options?.includeFailedRisk ?? false;

  const expectedLatestSession =
    await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) return [];

  const now = new Date();
  const coreSymbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  const tacticalSymbols = await listActiveTacticalSymbols(prisma, now);
  const tacticalKeys = [
    ...new Set(tacticalSymbols.map((t) => t.symbol.trim().toUpperCase())),
  ];
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
  const tacticalMatches = tacticalSymbols.map((t) => ({
    tacticalId: t.id,
    tacticalSymbol: t.symbol,
    stockSymbolId: stockIdBySymbol.get(t.symbol.trim().toUpperCase()) ?? null,
  }));

  const effectiveUniverse = computeEffectiveScanUniverse({
    coreRows: coreSymbols,
    tacticalRows: tacticalMatches,
  });

  const symbolIds = effectiveUniverse.symbols.map((s) => s.symbolId);
  if (symbolIds.length === 0) return [];

  // Bounded lookback: the deepest window any consumer needs is `evaluateTradability`
  // (TRADABILITY_MIN_BARS = 120 trading days); fresh-breakout metrics only reach back 50
  // (MA50). 300 calendar days clears both with the same margin the batched tradability
  // loader uses. Upper bound is deliberately left open so `staleSession` still compares
  // against the true latest bar, exactly as before.
  const barsFromDate = tradabilityLookbackFromDate(expectedLatestSession);

  const allBars = await prisma.stockDailyBar.findMany({
    where: { symbolId: { in: symbolIds }, date: { gte: barsFromDate } },
    orderBy: [{ symbolId: "asc" }, { date: "asc" }],
    select: { symbolId: true, date: true, close: true, volume: true },
  });

  const barsBySymbolId = new Map<
    string,
    Array<{ date: Date; close: number; volume: number }>
  >();
  for (const bar of allBars) {
    const list = barsBySymbolId.get(bar.symbolId) ?? [];
    list.push({ date: bar.date, close: bar.close, volume: bar.volume });
    barsBySymbolId.set(bar.symbolId, list);
  }

  type RankInput = {
    symbol: string;
    universeSource: UniverseSource;
    tradabilityPassed: boolean;
    staleSession: boolean;
    labels: string[];
    riskAnnotations: string[];
    volumeRatio20: number | null;
    breakoutExtensionPct: number | null;
    group: FreshBreakoutAuditGroup;
    latestClose: number;
    latestBarDate: string;
    whyNotCoreSetup: string;
  };

  const candidates: RankInput[] = [];

  for (const u of effectiveUniverse.symbols) {
    const bars = barsBySymbolId.get(u.symbolId) ?? [];
    const metrics = computeFreshBreakoutMetrics({
      bars,
      expectedLatestSession,
    });
    if (!metrics) continue;

    const tradability = evaluateTradability(bars, expectedLatestSession);
    const classification = classifyFreshBreakout({
      metrics,
      tradability,
      recentBars: bars,
    });

    const rowLike = {
      labels: classification.labels,
      tradabilityPassed: tradability.passed,
      staleSession: metrics.staleSession,
    };

    if (
      !shouldIncludeFreshBreakoutRow(rowLike, {
        includeFailedRisk,
        tradableOnly: true,
      })
    ) {
      continue;
    }

    const group = determineFreshBreakoutGroup({
      tradabilityPassed: tradability.passed,
      staleSession: metrics.staleSession,
      labels: classification.labels,
    });

    if (group === "AVOID_RISK" || group === "COVERAGE_TRADABILITY_BLOCKED") {
      continue;
    }
    if (group === "EXTENDED_WATCH_ONLY" && !includeExtended) {
      continue;
    }

    candidates.push({
      symbol: u.symbol,
      universeSource: u.universeSource,
      tradabilityPassed: tradability.passed,
      staleSession: metrics.staleSession,
      labels: classification.labels,
      riskAnnotations: classification.riskAnnotations,
      volumeRatio20: metrics.volumeRatio20,
      breakoutExtensionPct: metrics.breakoutExtensionPct,
      group,
      latestClose: metrics.close,
      latestBarDate: metrics.latestBarDate.toISOString().slice(0, 10),
      whyNotCoreSetup: buildWhyNotCoreSetup(classification.notes),
    });
  }

  candidates.sort((a, b) =>
    compareFreshBreakoutRows(
      {
        symbol: a.symbol,
        tradabilityPassed: a.tradabilityPassed,
        staleSession: a.staleSession,
        labels: a.labels,
        riskAnnotations: a.riskAnnotations,
        volumeRatio20: a.volumeRatio20,
        breakoutExtensionPct: a.breakoutExtensionPct,
      },
      {
        symbol: b.symbol,
        tradabilityPassed: b.tradabilityPassed,
        staleSession: b.staleSession,
        labels: b.labels,
        riskAnnotations: b.riskAnnotations,
        volumeRatio20: b.volumeRatio20,
        breakoutExtensionPct: b.breakoutExtensionPct,
      }
    )
  );

  return candidates.slice(0, limit).map((c) => ({
    symbol: c.symbol,
    universeSource: c.universeSource,
    group: c.group,
    labels: c.labels,
    riskAnnotations: c.riskAnnotations,
    latestClose: c.latestClose,
    volumeRatio20: c.volumeRatio20,
    breakoutExtensionPct: c.breakoutExtensionPct,
    latestBarDate: c.latestBarDate,
    whyNotCoreSetup: c.whyNotCoreSetup,
  }));
}

/**
 * Cached full-universe evaluation, keyed by session so it invalidates naturally on a
 * new trading day in addition to the `daily-scan` tag.
 *
 * `sessionDate` is resolved by the caller **outside** this cache scope on purpose:
 * under `cacheComponents`, a throw inside a `"use cache"` boundary fails the prerender
 * even when the caller catches it, so the DB-unavailable path must never reach here.
 */
async function getMomentumWatchRowsForSessionCached(
  sessionDate: Date,
  options: GetMomentumWatchRowsOptions
): Promise<MomentumWatchUiRow[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  const { prisma } = await import("@/lib/prisma");
  return getMomentumWatchRowsForPhase1(prisma, options);
}

/**
 * Cached wrapper around {@link getMomentumWatchRowsForPhase1} using the shared prisma
 * singleton. Rows derive purely from bars written by the daily import + scan, so they
 * only change when `daily-scan` is revalidated — previously this full-universe
 * evaluation re-ran on every `/setups` render.
 *
 * The session probe is a single indexed one-row read; everything expensive sits behind
 * the cache. Errors propagate to the caller (and are never cached).
 */
export async function getCachedMomentumWatchRows(
  options: GetMomentumWatchRowsOptions = {}
): Promise<MomentumWatchUiRow[]> {
  const { prisma } = await import("@/lib/prisma");
  const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!sessionDate) return [];
  return getMomentumWatchRowsForSessionCached(sessionDate, options);
}
