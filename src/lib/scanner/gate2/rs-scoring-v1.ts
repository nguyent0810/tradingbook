import type {
  RsNearMissWatchlistEntryDto,
  RsNearMissWatchlistRow,
} from "./rs-near-miss-watchlist";
import type { RelativeStrengthDiagnostic } from "./relative-strength";

/** Production-off unless `RS_SCORING_V1_ENABLED` is `true` or `1`. */
export function isRsScoringV1Enabled(): boolean {
  const v = process.env.RS_SCORING_V1_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type RsScoringV1Input = {
  row: RsNearMissWatchlistRow;
  rsDiagnostic: RelativeStrengthDiagnostic | null;
  /**
   * Optional p90 spread from the near-miss watchlist batch being scored (NOT the
   * full scan universe — see `watchlistRsSpreadP90`). When missing, normalization
   * falls back to a fixed denominator.
   */
  watchlistRs20P90?: number | null;
  watchlistRs50P90?: number | null;
  /** Gate 1 level for readiness modifier */
  gate1Level?: "PASS" | "WARNING" | "FAIL" | null;
};

export type RsScoringV1Result = {
  rsStrengthScore: number;
  setupReadinessScore: number;
  rsConfidence: "high" | "medium" | "low";
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function normalizeSpread(spread: number, p90: number | null | undefined): number {
  const denom = p90 != null && p90 > 0 ? p90 : 15;
  return clamp01((spread / denom) * 100);
}

function consistencyBonus(rs20: number, rs50: number | null): number {
  if (rs50 == null || !Number.isFinite(rs50)) return 40;
  if (rs20 > 0 && rs50 > 0) return 100;
  if (rs20 > 0 && rs50 <= 0) return 25;
  if (rs20 < 0 && rs50 < 0) return 60;
  return 50;
}

function ma50Component(diag: RelativeStrengthDiagnostic | null): number {
  if (diag?.stockAboveMa50 === true) return 100;
  if (diag?.stockAboveMa50 === false) return 20;
  return 50;
}

function drawdownPenalty(rs20: number, rs50: number | null): number {
  if (rs20 > 5 && rs50 != null && rs50 < -10) return 30;
  if (rs20 > 0 && rs50 != null && rs50 < 0) return 15;
  return 0;
}

function liquidityComponent(lastVolume: number | null): number {
  if (lastVolume == null || lastVolume <= 0) return 40;
  if (lastVolume >= 5_000_000) return 100;
  if (lastVolume >= 1_000_000) return 80;
  if (lastVolume >= 100_000) return 60;
  return 35;
}

function stageRankComponent(stageRank: number): number {
  return clamp01((stageRank / 72) * 100);
}

function distanceComponent(dist: number | null): number {
  if (dist == null || !Number.isFinite(dist)) return 30;
  const pct = Math.abs(dist) * 100;
  if (pct <= 2) return 95;
  if (pct <= 5) return 75;
  if (pct <= 10) return 50;
  return 25;
}

function regimeModifier(gate1: RsScoringV1Input["gate1Level"]): number {
  if (gate1 === "PASS") return 100;
  if (gate1 === "WARNING") return 70;
  if (gate1 === "FAIL") return 40;
  return 80;
}

/**
 * RS Strength Score (0–100) — relative leadership only; no setup terminal weighting.
 */
export function computeRsStrengthScoreV1(input: RsScoringV1Input): number {
  const { row, rsDiagnostic, watchlistRs20P90, watchlistRs50P90 } = input;
  const rs20 = row.rs20SpreadPct;
  const rs50 = row.rs50SpreadPct;

  const rs20Norm = normalizeSpread(rs20, watchlistRs20P90);
  const rs50Norm =
    rs50 != null && Number.isFinite(rs50)
      ? normalizeSpread(rs50, watchlistRs50P90)
      : rs20Norm * 0.5;

  const consistency = consistencyBonus(rs20, rs50);
  const ma50 = ma50Component(rsDiagnostic);
  const liquidity = liquidityComponent(row.lastVolume);
  const penalty = drawdownPenalty(rs20, rs50);

  const raw =
    rs20Norm * 0.35 +
    rs50Norm * 0.25 +
    consistency * 0.15 +
    ma50 * 0.1 +
    liquidity * 0.1 +
    50 * 0.05 -
    penalty;

  return Math.round(clamp01(raw));
}

/**
 * Setup Readiness Score (0–100) — proximity to valid setup under existing Gate 2 rules.
 */
export function computeSetupReadinessScoreV1(input: RsScoringV1Input): number {
  const { row, rsDiagnostic, gate1Level } = input;
  const stage = stageRankComponent(row.stageRank);
  const distance = distanceComponent(row.distanceToPullbackZoneFrac);
  const ma50 = ma50Component(rsDiagnostic);
  const regime = regimeModifier(gate1Level ?? null);

  let terminalBoost = 50;
  const code = row.terminalCode;
  if (code === "pullback_zone_interaction") terminalBoost = 85;
  else if (code === "volume_ratio") terminalBoost = 65;
  else if (code === "breakout_recency") terminalBoost = 45;
  else if (code === "trend_below_ma50") terminalBoost = 20;

  const raw =
    stage * 0.25 +
    distance * 0.2 +
    ma50 * 0.15 +
    terminalBoost * 0.15 +
    regime * 0.1 +
    50 * 0.15;

  return Math.round(clamp01(raw));
}

export function computeRsScoringV1(input: RsScoringV1Input): RsScoringV1Result {
  const rs20 = input.row.rs20SpreadPct;
  const rs50 = input.row.rs50SpreadPct;
  let rsConfidence: RsScoringV1Result["rsConfidence"] = "high";
  if (rs50 != null && rs20 > 0 && rs50 < 0) rsConfidence = "low";
  else if (rs50 == null) rsConfidence = "medium";
  else if (rs20 > 0 && rs50 > 0) rsConfidence = "high";
  else rsConfidence = "medium";

  return {
    rsStrengthScore: computeRsStrengthScoreV1(input),
    setupReadinessScore: computeSetupReadinessScoreV1(input),
    rsConfidence,
  };
}

/** Score all watchlist entries for dashboard display (feature-flagged). */
export function buildRsScoringMapFromEntries(
  rows: readonly RsNearMissWatchlistEntryDto[],
  options?: {
    gate1Level?: RsScoringV1Input["gate1Level"];
    diagnosticsBySymbol?: ReadonlyMap<string, RelativeStrengthDiagnostic | null>;
  }
): Map<string, RsScoringV1Result> {
  const stubRows: RsNearMissWatchlistRow[] = rows.map((r) => ({
    symbol: r.symbol,
    sessionDate: r.sessionDate,
    rs20SpreadPct: r.rs20SpreadPct,
    rs50SpreadPct: r.rs50SpreadPct,
    terminalCode: (r.terminalCode as RsNearMissWatchlistRow["terminalCode"]) ?? null,
    terminalCategory: r.terminalCode ?? "",
    failedGate2Because: r.failedGate2Because,
    topRejectionReason: r.topRejectionReason,
    stageRank: r.stageRank,
    distanceToPullbackZoneFrac: r.distanceToPullbackZoneFrac,
    rankScore: 0,
    lastVolume: null,
    rsDiagnosticSummary: r.rsDiagnostic?.summary ?? "",
  }));

  const rs20P90 = watchlistRsSpreadP90(stubRows, "rs20SpreadPct");
  const rs50P90 = watchlistRsSpreadP90(stubRows, "rs50SpreadPct");

  const out = new Map<string, RsScoringV1Result>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const stub = stubRows[i]!;
    out.set(
      row.symbol,
      computeRsScoringV1({
        row: stub,
        rsDiagnostic: options?.diagnosticsBySymbol?.get(row.symbol) ?? null,
        watchlistRs20P90: rs20P90,
        watchlistRs50P90: rs50P90,
        gate1Level: options?.gate1Level ?? null,
      })
    );
  }
  return out;
}

/** Minimum sample size before a p90 over the watchlist batch is trusted. */
const MIN_SAMPLE_SIZE_FOR_P90 = 8;

/**
 * P90 spread over the near-miss watchlist batch passed in (`rows`), which is
 * capped at a small number of entries (see `computeRsNearMissWatchlistFromDb`'s
 * `limit`) — NOT a percentile over the full scan universe. Returns `null` below
 * `MIN_SAMPLE_SIZE_FOR_P90` so callers fall back to a fixed denominator instead
 * of trusting a percentile computed from too few rows.
 */
export function watchlistRsSpreadP90(
  rows: readonly RsNearMissWatchlistRow[],
  field: "rs20SpreadPct" | "rs50SpreadPct"
): number | null {
  const vals = rows
    .map((r) => r[field])
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (vals.length < MIN_SAMPLE_SIZE_FOR_P90) return null;
  vals.sort((a, b) => a - b);
  const idx = Math.min(vals.length - 1, Math.floor(vals.length * 0.9));
  return vals[idx] ?? null;
}
