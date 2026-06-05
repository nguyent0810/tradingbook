/**
 * Resolve expansion cohort tiers (a | b | all) from expansion-300-cohort.json.
 */

export type CohortTierId = "a" | "b" | "all";

export type ExpansionCohortDoc = {
  baselineActiveSymbols?: string[];
  additiveSymbols?: string[];
  additiveByTier?: { tierA?: string[]; tierB?: string[] };
};

const TIER_ALIASES: Record<string, CohortTierId> = {
  a: "a",
  b: "b",
  all: "all",
  full: "all",
  full_additive: "all",
  additive: "all",
};

export function normalizeCohortTier(tier: string): CohortTierId {
  const key = tier.trim().toLowerCase();
  const resolved = TIER_ALIASES[key];
  if (!resolved) {
    throw new Error(`Unknown tier "${tier}"; use a, b, or all`);
  }
  return resolved;
}

export function normalizeSymbolList(symbols: readonly string[]): string[] {
  return symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export function resolveTierSymbols(doc: ExpansionCohortDoc, tier: string): string[] {
  const t = normalizeCohortTier(tier);
  if (t === "a") {
    return normalizeSymbolList(doc.additiveByTier?.tierA ?? []);
  }
  if (t === "b") {
    return normalizeSymbolList(doc.additiveByTier?.tierB ?? []);
  }
  return normalizeSymbolList(doc.additiveSymbols ?? []);
}

export type CohortTierOfflineValidation = {
  tier: CohortTierId;
  symbols: string[];
  duplicateSymbols: string[];
  baselineOverlap: string[];
};

/** Offline checks on cohort JSON (no DB). */
export function validateTierSymbolsOffline(
  doc: ExpansionCohortDoc,
  tier: string
): CohortTierOfflineValidation {
  const resolvedTier = normalizeCohortTier(tier);
  const symbols = resolveTierSymbols(doc, resolvedTier);
  const seen = new Set<string>();
  const duplicateSymbols: string[] = [];
  for (const sym of symbols) {
    if (seen.has(sym)) duplicateSymbols.push(sym);
    else seen.add(sym);
  }

  const baseline = new Set(normalizeSymbolList(doc.baselineActiveSymbols ?? []));
  const baselineOverlap = symbols.filter((s) => baseline.has(s));

  return {
    tier: resolvedTier,
    symbols,
    duplicateSymbols,
    baselineOverlap,
  };
}
