/**
 * Shared validation for Tier A-only additive activation (no deactivations).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PrismaClient } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "../../src/lib/scanner/expected-session";
import { loadEffectiveScanUniverse } from "../../src/lib/tactical-universe";
import { buildImportSymbolKeys } from "../../src/lib/effective-universe-export";
import { isSmokeProductionSymbol } from "../../src/lib/scanner/production-smoke-markers";
import { resolveTierSymbols, type ExpansionCohortDoc } from "./cohort-tier";

export type TierAActivationFile = {
  version: number;
  purpose: string;
  sourceCohortFile: string;
  baselineActiveCount: number;
  expectedActiveCountAfter: number;
  tierASymbols: string[];
};

export type TierAActivationValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  tierASymbols: string[];
  tierACount: number;
  expectedLatestSessionDay: string;
  beforeActiveCount: number;
  afterActiveCountIfApplied: number;
  baselineActiveCount: number;
  baselineAllStillActive: boolean;
  tierAAllInactive: boolean;
  tierAAllSessionAligned: boolean;
  noDuplicates: boolean;
  noBaselineOverlap: boolean;
  noTierBIncluded: boolean;
  perSymbol: Array<{
    symbol: string;
    active: boolean;
    latestBarDay: string | null;
    sessionAligned: boolean;
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

export function loadTierAActivationFile(path: string): TierAActivationFile {
  return JSON.parse(readFileSync(path, "utf-8")) as TierAActivationFile;
}

export function buildTierAActivationFileFromCohort(cohortPath: string): TierAActivationFile {
  const doc = JSON.parse(readFileSync(cohortPath, "utf-8")) as ExpansionCohortDoc & {
    policy?: { baselineActiveCount?: number };
  };
  const tierA = resolveTierSymbols(doc, "a");
  const baseline = doc.baselineActiveSymbols?.length ?? doc.policy?.baselineActiveCount ?? 206;
  return {
    version: 1,
    purpose: "tier_a_additive_only",
    sourceCohortFile: cohortPath,
    baselineActiveCount: baseline,
    expectedActiveCountAfter: baseline + tierA.length,
    tierASymbols: tierA,
  };
}

export async function validateTierAActivation(
  prisma: PrismaClient,
  activation: TierAActivationFile,
  cohortFile: string
): Promise<TierAActivationValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const doc = JSON.parse(readFileSync(cohortFile, "utf-8")) as ExpansionCohortDoc;
  const tierA = activation.tierASymbols.map((s) => s.trim().toUpperCase());
  const tierB = new Set(resolveTierSymbols(doc, "b"));
  const baseline = (doc.baselineActiveSymbols ?? []).map((s) => s.trim().toUpperCase());
  const baselineSet = new Set(baseline);

  const noDuplicates = tierA.length === new Set(tierA).size;
  if (!noDuplicates) errors.push("Duplicate symbols in Tier A activation list");

  const overlap = tierA.filter((s) => baselineSet.has(s));
  const noBaselineOverlap = overlap.length === 0;
  if (!noBaselineOverlap) {
    errors.push(`Tier A overlaps baseline actives: ${overlap.join(", ")}`);
  }

  const tierBIncluded = tierA.filter((s) => tierB.has(s));
  const noTierBIncluded = tierBIncluded.length === 0;
  if (!noTierBIncluded) {
    errors.push(`Tier B symbols in Tier A list: ${tierBIncluded.join(", ")}`);
  }

  if (tierA.length !== 23) {
    errors.push(`Expected 23 Tier A symbols, got ${tierA.length}`);
  }

  if (activation.expectedActiveCountAfter !== activation.baselineActiveCount + tierA.length) {
    errors.push("expectedActiveCountAfter inconsistent with baseline + tierA");
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

  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: tierA } },
    select: {
      symbol: true,
      active: true,
      bars: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      _count: { select: { bars: true } },
    },
  });
  const rowBy = new Map(rows.map((r) => [r.symbol.trim().toUpperCase(), r]));

  const perSymbol: TierAActivationValidation["perSymbol"] = [];
  let tierAAllInactive = true;
  let tierAAllSessionAligned = true;

  for (const sym of tierA) {
    const row = rowBy.get(sym);
    const meta = (doc as { symbolMetadata?: Record<string, { tier?: string }> }).symbolMetadata?.[sym];
    if (!row) {
      errors.push(`${sym}: not in DB`);
      tierAAllInactive = false;
      tierAAllSessionAligned = false;
      continue;
    }
    if (row.active) {
      tierAAllInactive = false;
      errors.push(`${sym}: already active (expected inactive before Tier A pilot)`);
    }
    const latest = row.bars[0]?.date ?? null;
    const aligned = latest != null && utcDayOnly(latest).getTime() === expectedMs;
    if (!aligned) {
      tierAAllSessionAligned = false;
      errors.push(
        `${sym}: latest ${latest?.toISOString().slice(0, 10) ?? "none"} != expected ${expectedDay}`
      );
    }
    perSymbol.push({
      symbol: sym,
      active: row.active,
      latestBarDay: latest?.toISOString().slice(0, 10) ?? null,
      sessionAligned: aligned,
      barCount: row._count.bars,
      tier: meta?.tier ?? "A",
    });
  }

  const toActivate = tierA.filter((sym) => {
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
    tierASymbols: tierA,
    tierACount: tierA.length,
    expectedLatestSessionDay: expectedDay,
    beforeActiveCount,
    afterActiveCountIfApplied,
    baselineActiveCount: activation.baselineActiveCount,
    baselineAllStillActive,
    tierAAllInactive,
    tierAAllSessionAligned,
    noDuplicates,
    noBaselineOverlap,
    noTierBIncluded,
    perSymbol,
    impact,
  };
}
