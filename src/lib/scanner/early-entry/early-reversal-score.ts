import type { EarlyEntryBarMetrics, EarlyEntryReasonCode } from "./types";

export function computeEarlyReversalScore(params: {
  reasonCodes: readonly EarlyEntryReasonCode[];
  metrics: Pick<EarlyEntryBarMetrics, "rs20SpreadPct">;
}): number {
  const { reasonCodes, metrics } = params;
  let score = 0;
  if (reasonCodes.includes("RECLAIM_MA20")) score += 18;
  if (reasonCodes.includes("RECLAIM_MA50")) score += 22;
  if (reasonCodes.includes("PRIOR_COMPRESSION")) score += 12;
  if (reasonCodes.includes("COMPRESSION_BREAKOUT")) score += 15;
  if (reasonCodes.includes("VOLUME_EXPANSION")) score += 12;
  if (reasonCodes.includes("CLOSE_NEAR_HIGH")) score += 10;
  if (reasonCodes.includes("POCKET_PIVOT")) score += 10;
  if (reasonCodes.includes("RS_IMPROVING")) score += 10;
  if (reasonCodes.includes("STOP_NEARBY")) score += 8;
  if (reasonCodes.includes("RR_ACCEPTABLE")) score += 12;
  if (reasonCodes.includes("WEAK_VOLUME")) score -= 15;
  if (reasonCodes.includes("BAD_RR")) score -= 20;
  if (reasonCodes.includes("EXTENDED_FROM_MA20")) score -= 15;
  if (reasonCodes.includes("NO_CONFIRMATION_CANDLE")) score -= 8;
  if (metrics.rs20SpreadPct != null && metrics.rs20SpreadPct > 0) score += 5;
  return Math.max(0, Math.min(100, score));
}

export function computeExtensionRiskScore(
  metrics: Pick<EarlyEntryBarMetrics, "distFromMa20Pct" | "distFromMa50Pct">
): number {
  let risk = 0;
  const d20 = metrics.distFromMa20Pct ?? 0;
  const d50 = metrics.distFromMa50Pct ?? 0;
  if (d20 > 8) risk += 40;
  else if (d20 > 6) risk += 25;
  else if (d20 > 4) risk += 10;
  if (d50 > 12) risk += 35;
  else if (d50 > 8) risk += 20;
  return Math.max(0, Math.min(100, risk));
}

export function computeRiskRewardScore(ratio: number | null): number {
  if (ratio == null || !Number.isFinite(ratio)) return 0;
  if (ratio >= 2.5) return 100;
  if (ratio >= 2) return 80;
  if (ratio >= 1.5) return 50;
  return 20;
}

export const PILOT_SCORE_THRESHOLD = 55;
export const WATCH_SCORE_THRESHOLD = 35;
export const EXTENSION_RISK_BLOCK = 50;
export const EXTENSION_RISK_PILOT_MAX = 35;
