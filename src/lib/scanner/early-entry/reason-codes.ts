import type { EarlyEntryReasonCode, ReasonDetectionInput } from "./types";
import { isRiskRewardAcceptable, isRiskRewardBad } from "./risk-reward";
import { hadCloseBelowLevel } from "./bar-metrics";

export function detectReclaimMa20(input: ReasonDetectionInput): boolean {
  return input.reclaimMa20;
}

export function detectReclaimMa50(input: ReasonDetectionInput): boolean {
  return input.reclaimMa50;
}

export function detectVolumeExpansion(input: ReasonDetectionInput): boolean {
  return input.volumeRatio != null && input.volumeRatio >= 1.2;
}

export function detectWeakVolume(input: ReasonDetectionInput): boolean {
  return input.volumeRatio != null && input.volumeRatio < 1.0;
}

export function detectCloseNearHigh(input: ReasonDetectionInput): boolean {
  return (
    input.closeNearHighPct != null &&
    input.closeNearHighPct >= 0.75 &&
    input.bar.close >= input.bar.open
  );
}

export function detectPriorCompression(input: ReasonDetectionInput): boolean {
  return input.priorCompression;
}

export function detectCompressionBreakout(input: ReasonDetectionInput): boolean {
  const prevHigh = input.prevBar?.high ?? 0;
  return (
    input.priorCompression &&
    detectVolumeExpansion(input) &&
    input.bar.close > prevHigh
  );
}

export function detectPocketPivot(input: ReasonDetectionInput): boolean {
  return input.pocketPivot;
}

export function detectStopNearby(input: ReasonDetectionInput): boolean {
  if (input.riskRewardRatio == null) return false;
  const stop = input.bar.close * (1 - 0.05);
  return input.bar.low <= stop * 1.02;
}

export function detectStopNearbyFromDistance(stopDistancePct: number | null): boolean {
  return stopDistancePct != null && stopDistancePct <= 5;
}

export function detectRiskRewardAcceptable(ratio: number | null): boolean {
  return isRiskRewardAcceptable(ratio);
}

export function detectRiskRewardBad(ratio: number | null): boolean {
  return isRiskRewardBad(ratio);
}

export function detectRsImproving(input: ReasonDetectionInput): boolean {
  return input.rs20Delta3d != null && input.rs20Delta3d > 1;
}

export function detectExtendedFromMa20(input: ReasonDetectionInput): boolean {
  return input.distFromMa20Pct != null && input.distFromMa20Pct > 6;
}

export function detectNoConfirmationCandle(input: ReasonDetectionInput): boolean {
  if (
    input.reclaimMa20 ||
    input.reclaimMa50 ||
    detectCompressionBreakout(input)
  ) {
    return false;
  }
  if (input.bodyPct == null || input.atr14 == null) return false;
  return input.bodyPct * input.bar.close < input.atr14 * 0.5;
}

export function detectEarlyEntryReasonCodes(
  input: ReasonDetectionInput,
  stopDistancePct: number | null
): EarlyEntryReasonCode[] {
  const codes: EarlyEntryReasonCode[] = [];

  if (detectReclaimMa20(input)) codes.push("RECLAIM_MA20");
  if (detectReclaimMa50(input)) codes.push("RECLAIM_MA50");
  if (detectVolumeExpansion(input)) codes.push("VOLUME_EXPANSION");
  else if (detectWeakVolume(input)) codes.push("WEAK_VOLUME");
  if (detectCloseNearHigh(input)) codes.push("CLOSE_NEAR_HIGH");
  if (detectPriorCompression(input)) codes.push("PRIOR_COMPRESSION");
  if (detectPocketPivot(input)) codes.push("POCKET_PIVOT");
  if (detectStopNearbyFromDistance(stopDistancePct)) codes.push("STOP_NEARBY");
  if (detectRiskRewardAcceptable(input.riskRewardRatio)) codes.push("RR_ACCEPTABLE");
  else if (detectRiskRewardBad(input.riskRewardRatio)) codes.push("BAD_RR");
  if (detectRsImproving(input)) codes.push("RS_IMPROVING");
  if (detectExtendedFromMa20(input)) codes.push("EXTENDED_FROM_MA20");
  if (detectCompressionBreakout(input)) codes.push("COMPRESSION_BREAKOUT");
  if (detectNoConfirmationCandle(input)) codes.push("NO_CONFIRMATION_CANDLE");

  return codes;
}

export function reasonCodeLabel(code: EarlyEntryReasonCode): string {
  return code.replace(/_/g, " ");
}

/** For add-zone detection (Phase 4 prep) — not a pilot reason code. */
export function detectPullbackToMa(input: {
  ma20: number | null;
  close: number;
  closes: readonly number[];
  ma20Series: readonly (number | undefined)[];
  idx: number;
}): boolean {
  if (input.ma20 == null) return false;
  const hadBelow = hadCloseBelowLevel(input.closes, input.ma20Series, input.idx - 1, 5);
  return (
    hadBelow &&
    input.close >= input.ma20 * 0.98 &&
    input.close <= input.ma20 * 1.02
  );
}
