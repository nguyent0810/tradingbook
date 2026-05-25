/** Known production smoke / verification markers — exclude from operator-facing scan surfaces. */

export const SMOKE_PRODUCTION_SYMBOLS = new Set(["P0DEXIT", "PODEXIT", "DEMOSETUP"]);

const SMOKE_REASON_MARKERS = ["P0D_EXIT_HEALTH_SMOKE", "DEMO_SEED"];

export function isSmokeDailyScanRunNotes(notes: unknown): boolean {
  if (notes == null || typeof notes !== "object" || Array.isArray(notes)) {
    return false;
  }
  const record = notes as Record<string, unknown>;
  if (record.p0dExitHealthSmoke === true) return true;
  if (record.demoSeed === true) return true;
  return false;
}

export function isSmokeProductionSymbol(symbol: string): boolean {
  return SMOKE_PRODUCTION_SYMBOLS.has(symbol.trim().toUpperCase());
}

export function isSmokeSetupCandidateReasons(reasons: unknown): boolean {
  if (!Array.isArray(reasons)) return false;
  return reasons.some(
    (r) =>
      typeof r === "string" &&
      SMOKE_REASON_MARKERS.some((m) => r.includes(m))
  );
}

export function isSmokeSetupCandidateRow(input: {
  symbol: string;
  reasons?: unknown;
}): boolean {
  if (isSmokeProductionSymbol(input.symbol)) return true;
  return isSmokeSetupCandidateReasons(input.reasons);
}
