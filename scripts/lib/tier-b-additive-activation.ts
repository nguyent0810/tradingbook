/**
 * Shared validation for Tier B additive activation (no deactivations).
 * Mirrors tier-a-additive-activation.ts; run only after Tier A is already active.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PrismaClient } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "../../src/lib/scanner/expected-session";
import { loadEffectiveScanUniverse } from "../../src/lib/tactical-universe";
import { buildImportSymbolKeys } from "../../src/lib/effective-universe-export";
import { isSmokeProductionSymbol } from "../../src/lib/scanner/production-smoke-markers";
import { resolveTierSymbols, type ExpansionCohortDoc } from "./cohort-tier";

export type TierBActivationFile = {
  version: number;
  purpose: string;
  sourceCohortFile: string;
  baselineActiveCount: number;
  expectedActiveCountAfter: number;
  tierBSymbols: string[];
};

export type TierBActivationValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  tierBSymbols: string[];
  tierBCount: number;
  expectedLatestSessionDay: string;
  beforeActiveCount: number;
  afterActiveCountIfApplied: number;
  baselineActiveCount: number;
  baselineAllStillActive: boolean;
  tierAAllStillActive: boolean;
  tierBAllInactive: boolean;
  tierBAllSessionAligned: boolean;
  noDuplicates: boolean;
  noBaselineOverlap: boolean;
  noTierAIncluded: boolean;
  perSymbol: Array<{
    symbol: string;
    active: boolean;
    latestBarDay: string | null;
    sessionAligned: boolean;
    weekdaySessionsStale: number | null;
    barCount: number;
    tier: string;
  }>;
  impact: {
    before: {
      activeCoreCount: number;
      effectiveUniverseCount: number;
      estimatedImportSymbolCount: number;
    };
    afterProposedActivation: {
      activeCoreCount: number;
      effectiveUniverseCount: number;
      estimatedImportSymbolCount: number;
      newlyActivatedSymbols: number;
    };
  };
};

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  return utcDayOnly(d).toISOString().slice(0, 10);
}

/** Same definition as prepare-expansion-300-cohort.ts's countWeekdaysInclusive. */
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

/** Weekday sessions between latest bar and expected session (0 = same-day aligned). */
function weekdaySessionsStaleFor(latest: Date | null, expected: Date | null): number | null {
  if (latest == null || expected == null) return null;
  return countWeekdaysInclusive(latest, expected) - 1;
}

export function loadTierBActivationFile(path: string): TierBActivationFile {
  return JSON.parse(readFileSync(path, "utf-8")) as TierBActivationFile;
}

export function buildTierBActivationFileFromCohort(cohortPath: string): TierBActivationFile {
  const doc = JSON.parse(readFileSync(cohortPath, "utf-8")) as ExpansionCohortDoc & {
    policy?: { baselineActiveCount?: number };
  };
  const tierA = resolveTierSymbols(doc, "a");
  const tierB = resolveTierSymbols(doc, "b");
  const baseline = (doc.baselineActiveSymbols?.length ?? doc.policy?.baselineActiveCount ?? 206) + tierA.length;
  return {
    version: 1,
    purpose: "tier_b_additive_only",
    sourceCohortFile: cohortPath,
    baselineActiveCount: baseline,
    expectedActiveCountAfter: baseline + tierB.length,
    tierBSymbols: tierB,
  };
}

export async function validateTierBActivation(
  prisma: PrismaClient,
  activation: TierBActivationFile,
  cohortFile: string,
  options?: { maxWeekdaySessionsStale?: number }
): Promise<TierBActivationValidation> {
  const maxWeekdaySessionsStale = options?.maxWeekdaySessionsStale ?? 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as ExpansionCohortDoc;
  const tierB = activation.tierBSymbols.map((s) => s.trim().toUpperCase());
  const tierA = new Set(resolveTierSymbols(doc, "a"));
  const baseline = (doc.baselineActiveSymbols ?? []).map((s) => s.trim().toUpperCase());
  const baselineSet = new Set(baseline);

  const noDuplicates = tierB.length === new Set(tierB).size;
  if (!noDuplicates) errors.push("Duplicate symbols in Tier B activation list");

  const overlap = tierB.filter((s) => baselineSet.has(s));
  const noBaselineOverlap = overlap.length === 0;
  if (!noBaselineOverlap) {
    errors.push(`Tier B overlaps baseline actives: ${overlap.join(", ")}`);
  }

  const tierAIncluded = tierB.filter((s) => tierA.has(s));
  const noTierAIncluded = tierAIncluded.length === 0;
  if (!noTierAIncluded) {
    errors.push(`Tier A symbols in Tier B list: ${tierAIncluded.join(", ")}`);
  }

  if (tierB.length !== 71) {
    errors.push(`Expected 71 Tier B symbols, got ${tierB.length}`);
  }

  if (activation.expectedActiveCountAfter !== activation.baselineActiveCount + tierB.length) {
    errors.push("expectedActiveCountAfter inconsistent with baseline + tierB");
  }

  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expected) errors.push("No VNINDEX expected session");
  const expectedDay = expected ? isoDay(expected) : "";
  const expectedMs = expected ? utcDayOnly(expected).getTime() : 0;

  const beforeActiveCount = await prisma.stockSymbol.count({ where: { active: true } });
  if (beforeActiveCount !== activation.baselineActiveCount) {
    warnings.push(
      `DB active count ${beforeActiveCount} != cohort baseline ${activation.baselineActiveCount}`
    );
  }

  const baselineRows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: baseline } },
    select: { symbol: true, active: true },
  });
  const baselineInactive = baselineRows.filter((r) => !r.active).map((r) => r.symbol);
  const baselineAllStillActive = baselineInactive.length === 0;
  if (!baselineAllStillActive) {
    errors.push(
      `Baseline symbols not active (${baselineInactive.length}): ${baselineInactive.slice(0, 10).join(", ")}${baselineInactive.length > 10 ? "…" : ""}`
    );
  }

  const tierARows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: [...tierA] } },
    select: { symbol: true, active: true },
  });
  const tierAInactive = tierARows.filter((r) => !r.active).map((r) => r.symbol);
  const tierAAllStillActive = tierAInactive.length === 0;
  if (!tierAAllStillActive) {
    errors.push(
      `Tier A symbols not active (${tierAInactive.length}): ${tierAInactive.slice(0, 10).join(", ")}${tierAInactive.length > 10 ? "…" : ""}`
    );
  }

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

  const perSymbol: TierBActivationValidation["perSymbol"] = [];
  let tierBAllInactive = true;
  let tierBAllSessionAligned = true;

  for (const sym of tierB) {
    const row = rowBy.get(sym);
    const meta = (doc as { symbolMetadata?: Record<string, { tier?: string }> }).symbolMetadata?.[sym];
    if (!row) {
      errors.push(`${sym}: not in DB`);
      tierBAllInactive = false;
      tierBAllSessionAligned = false;
      continue;
    }
    if (row.active) {
      tierBAllInactive = false;
      errors.push(`${sym}: already active (expected inactive before Tier B activation)`);
    }
    const latest = row.bars[0]?.date ?? null;
    const exact = latest != null && utcDayOnly(latest).getTime() === expectedMs;
    const staleness = weekdaySessionsStaleFor(latest, expected ?? null);
    const aligned = exact || (staleness != null && staleness <= maxWeekdaySessionsStale);
    if (!aligned) {
      tierBAllSessionAligned = false;
      // Informational only — does NOT block `ok`. Tier B activates per-symbol
      // (skips stale stragglers) rather than all-or-nothing like Tier A.
      warnings.push(
        `${sym}: latest ${latest?.toISOString().slice(0, 10) ?? "none"} != expected ${expectedDay} (stale ${staleness ?? "n/a"} weekday sessions, max allowed ${maxWeekdaySessionsStale}) — will be skipped, not activated`
      );
    }
    perSymbol.push({
      symbol: sym,
      active: row.active,
      latestBarDay: latest?.toISOString().slice(0, 10) ?? null,
      sessionAligned: aligned,
      weekdaySessionsStale: staleness,
      barCount: row._count.bars,
      tier: meta?.tier ?? "B",
    });
  }

  const toActivate = tierB.filter((sym) => {
    const row = rowBy.get(sym);
    return row && !row.active;
  });
  const afterActiveCountIfApplied = beforeActiveCount + toActivate.length;

  const effectiveBefore = await loadEffectiveScanUniverse(prisma);
  const importBefore = buildImportSymbolKeys(effectiveBefore.symbols, {
    exclude: (s) => isSmokeProductionSymbol(s),
  });

  const simulatedIds = new Set(
    effectiveBefore.symbols.map((s) => s.symbol.trim().toUpperCase())
  );
  for (const sym of toActivate) simulatedIds.add(sym);

  const impact = {
    before: {
      activeCoreCount: beforeActiveCount,
      effectiveUniverseCount: effectiveBefore.stats.effectiveCount,
      estimatedImportSymbolCount: importBefore.length,
    },
    afterProposedActivation: {
      activeCoreCount: afterActiveCountIfApplied,
      effectiveUniverseCount: simulatedIds.size,
      estimatedImportSymbolCount: buildImportSymbolKeys(
        [...simulatedIds].map((symbol) => ({
          symbolId: rowBy.get(symbol)?.symbol ?? symbol,
          symbol,
          universeSource: "CORE" as const,
        })),
        { exclude: (s) => isSmokeProductionSymbol(s) }
      ).length,
      newlyActivatedSymbols: toActivate.length,
    },
  };

  if (afterActiveCountIfApplied !== activation.expectedActiveCountAfter) {
    warnings.push(
      `Projected active ${afterActiveCountIfApplied} != expected ${activation.expectedActiveCountAfter}`
    );
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    warnings,
    tierBSymbols: tierB,
    tierBCount: tierB.length,
    expectedLatestSessionDay: expectedDay,
    beforeActiveCount,
    afterActiveCountIfApplied,
    baselineActiveCount: activation.baselineActiveCount,
    baselineAllStillActive,
    tierAAllStillActive,
    tierBAllInactive,
    tierBAllSessionAligned,
    noDuplicates,
    noBaselineOverlap,
    noTierAIncluded,
    perSymbol,
    impact,
  };
}
