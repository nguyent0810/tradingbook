import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { computeAtr14, detectPriorCompression, mean } from "./bar-metrics";

export type TargetReason =
  | "resistance_cluster"
  | "prior_60d_high"
  | "prior_20d_high"
  | "pivot_high"
  | "congestion_ceiling"
  | "atr_floor"
  | "pct_floor";

export type InvalidLevelReason =
  | "swing_low"
  | "compression_low"
  | "reclaim_candle_low"
  | "ma20_failure"
  | "ma50_failure"
  | "atr_stop_floor";

export type EarlyEntryRiskRewardResult = {
  stopLevel: number | null;
  invalidLevelReason: InvalidLevelReason | null;
  rewardTarget: number | null;
  targetPrice: number | null;
  targetReason: TargetReason | null;
  riskRewardRatio: number | null;
  stopDistancePct: number | null;
  estimatedRewardPct: number | null;
  /** @deprecated use targetReason */
  rewardSource: TargetReason | null;
  /** Human-readable R:R rejection when below pilot threshold */
  rrRejectionReason: string | null;
};

const SWING_STOP_LOOKBACK = 10;
const STRUCTURAL_LOOKBACK = 60;
const STRUCTURAL_EXCLUDE_RECENT = 5;
const RANGE_LOOKBACK = 20;
const STOP_BUFFER = 0.99;
const MIN_REWARD_PCT = 0.04;
const ATR_REWARD_MULT = 2;
const ATR_STOP_MULT = 2;
const PIVOT_CLUSTER_TOLERANCE = 0.015;
export const RR_ACCEPTABLE = 2.0;
export const RR_BAD = 1.5;

type ResistanceCandidate = { level: number; reason: TargetReason };

type StopCandidate = { level: number; reason: InvalidLevelReason };

function findPivotHighs(
  bars: readonly Gate2BarInput[],
  from: number,
  to: number
): number[] {
  const pivots: number[] = [];
  for (let i = Math.max(from + 1, 1); i <= Math.min(to, bars.length - 2); i++) {
    const h = bars[i]!.high;
    if (h > bars[i - 1]!.high && h > bars[i + 1]!.high) {
      pivots.push(h);
    }
  }
  return pivots;
}

function clusterResistanceLevels(levels: readonly number[]): number[] {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[] = [];
  let cluster: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cluster[cluster.length - 1]!;
    if ((sorted[i]! - prev) / prev <= PIVOT_CLUSTER_TOLERANCE) {
      cluster.push(sorted[i]!);
    } else {
      clusters.push(Math.max(...cluster));
      cluster = [sorted[i]!];
    }
  }
  clusters.push(Math.max(...cluster));
  return clusters;
}

function detectCongestionCeiling(
  bars: readonly Gate2BarInput[],
  idx: number,
  lookback = 20
): number | null {
  const start = Math.max(0, idx - lookback);
  const end = Math.max(start, idx - STRUCTURAL_EXCLUDE_RECENT);
  const slice = bars.slice(start, end);
  if (slice.length < 5) return null;

  const ranges = slice.map((b) => (b.high - b.low) / b.close);
  const avgRange = mean(ranges);
  if (avgRange == null) return null;

  const tight = slice.filter((b) => (b.high - b.low) / b.close <= avgRange * 0.85);
  if (tight.length < 3) return null;
  return Math.max(...tight.map((b) => b.high));
}

export function collectResistanceCandidates(
  bars: readonly Gate2BarInput[],
  idx: number,
  close: number
): ResistanceCandidate[] {
  const out: ResistanceCandidate[] = [];
  const minTarget = close * 1.005;

  const structStart = Math.max(0, idx - STRUCTURAL_LOOKBACK);
  const structEnd = Math.max(structStart, idx - STRUCTURAL_EXCLUDE_RECENT);
  let structuralHigh = 0;
  for (let i = structStart; i <= structEnd; i++) {
    structuralHigh = Math.max(structuralHigh, bars[i]!.high);
  }
  if (structuralHigh >= minTarget) {
    out.push({ level: structuralHigh, reason: "prior_60d_high" });
  }

  const rangeStart = Math.max(0, idx - RANGE_LOOKBACK);
  let range20High = 0;
  for (let i = rangeStart; i < idx; i++) {
    range20High = Math.max(range20High, bars[i]!.high);
  }
  if (range20High >= minTarget) {
    out.push({ level: range20High, reason: "prior_20d_high" });
  }

  const pivots = findPivotHighs(bars, structStart, structEnd);
  const clusters = clusterResistanceLevels(pivots);
  for (const c of clusters) {
    if (c >= minTarget) {
      out.push({ level: c, reason: clusters.length > 1 ? "resistance_cluster" : "pivot_high" });
    }
  }

  const congestion = detectCongestionCeiling(bars, idx);
  if (congestion != null && congestion >= minTarget) {
    out.push({ level: congestion, reason: "congestion_ceiling" });
  }

  return out;
}

function findCompressionLow(bars: readonly Gate2BarInput[], idx: number): number | null {
  if (!detectPriorCompression(bars, idx)) return null;
  const start = Math.max(0, idx - 8);
  let m = bars[idx]!.low;
  for (let i = start; i < idx; i++) {
    m = Math.min(m, bars[i]!.low);
  }
  return m;
}

function findReclaimCandleLow(
  bars: readonly Gate2BarInput[],
  idx: number,
  ma20: number | null,
  ma50: number | null
): number | null {
  for (let i = Math.max(1, idx - 5); i <= idx; i++) {
    const prev = bars[i - 1]!.close;
    const cur = bars[i]!;
    const reclaimedMa20 = ma20 != null && cur.close >= ma20 && prev < ma20;
    const reclaimedMa50 = ma50 != null && cur.close >= ma50 && prev < ma50;
    if (reclaimedMa20 || reclaimedMa50) return cur.low;
  }
  return null;
}

export function collectStopCandidates(params: {
  bars: readonly Gate2BarInput[];
  idx: number;
  close: number;
  ma20: number | null;
  ma50: number | null;
  atr14: number | null;
}): StopCandidate[] {
  const { bars, idx, close, ma20, ma50, atr14 } = params;
  const out: StopCandidate[] = [];

  let swingLow = bars[idx]!.low;
  for (let i = Math.max(0, idx - SWING_STOP_LOOKBACK); i <= idx; i++) {
    swingLow = Math.min(swingLow, bars[i]!.low);
  }
  out.push({ level: swingLow * STOP_BUFFER, reason: "swing_low" });

  const compLow = findCompressionLow(bars, idx);
  if (compLow != null) {
    out.push({ level: compLow * STOP_BUFFER, reason: "compression_low" });
  }

  const reclaimLow = findReclaimCandleLow(bars, idx, ma20, ma50);
  if (reclaimLow != null) {
    out.push({ level: reclaimLow * STOP_BUFFER, reason: "reclaim_candle_low" });
  }

  if (ma20 != null && ma20 < close) {
    out.push({ level: ma20 * 0.98, reason: "ma20_failure" });
  }
  if (ma50 != null && ma50 < close) {
    out.push({ level: ma50 * 0.98, reason: "ma50_failure" });
  }

  if (atr14 != null) {
    out.push({ level: close - ATR_STOP_MULT * atr14, reason: "atr_stop_floor" });
  }

  return out.filter((c) => c.level > 0 && c.level < close);
}

export function selectStopLevel(candidates: readonly StopCandidate[]): StopCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.level < best.level ? c : best));
}

export function selectRewardTarget(
  structural: readonly ResistanceCandidate[],
  close: number,
  atr14: number | null,
  stopLevel: number | null = null
): { targetPrice: number; targetReason: TargetReason } {
  const minRewardAbs = close * MIN_REWARD_PCT;
  const reasonRank: Record<TargetReason, number> = {
    prior_60d_high: 0,
    prior_20d_high: 1,
    resistance_cluster: 2,
    pivot_high: 3,
    congestion_ceiling: 4,
    atr_floor: 5,
    pct_floor: 6,
  };

  const meaningful = structural.filter((c) => c.level - close >= minRewardAbs);
  const primary = meaningful.filter((c) => c.reason !== "congestion_ceiling");
  const pool = primary.length > 0 ? primary : meaningful;

  if (pool.length > 0 && stopLevel != null && stopLevel < close) {
    const risk = close - stopLevel;
    const rrAcceptable = pool
      .filter((c) => (c.level - close) / risk >= RR_ACCEPTABLE)
      .sort((a, b) => {
        const levelDiff = a.level - b.level;
        if (Math.abs(levelDiff) / close > 0.005) return levelDiff;
        return (reasonRank[a.reason] ?? 99) - (reasonRank[b.reason] ?? 99);
      });
    if (rrAcceptable.length > 0) {
      const pick = rrAcceptable[0]!;
      return { targetPrice: pick.level, targetReason: pick.reason };
    }
  }

  if (pool.length > 0) {
    pool.sort((a, b) => {
      const levelDiff = a.level - b.level;
      if (Math.abs(levelDiff) / close > 0.005) return levelDiff;
      return (reasonRank[a.reason] ?? 99) - (reasonRank[b.reason] ?? 99);
    });
    const pick = pool[0]!;
    return { targetPrice: pick.level, targetReason: pick.reason };
  }

  const atrFloor = atr14 != null ? close + ATR_REWARD_MULT * atr14 : close * (1 + MIN_REWARD_PCT);
  const pctFloor = close * (1 + MIN_REWARD_PCT);
  if (atrFloor >= pctFloor) {
    return { targetPrice: atrFloor, targetReason: "atr_floor" };
  }
  return { targetPrice: pctFloor, targetReason: "pct_floor" };
}

export function computeEarlyEntryRiskReward(
  bars: readonly Gate2BarInput[],
  idx: number,
  ma20: number | null = null,
  ma50: number | null = null
): EarlyEntryRiskRewardResult {
  const bar = bars[idx]!;
  const close = bar.close;
  if (!(close > 0)) {
    return emptyRiskReward();
  }

  const atr14 = computeAtr14(bars, idx);
  const stopCandidates = collectStopCandidates({ bars, idx, close, ma20, ma50, atr14 });
  const selectedStop = selectStopLevel(stopCandidates);
  if (!selectedStop) {
    return emptyRiskReward();
  }

  const structural = collectResistanceCandidates(bars, idx, close);
  const { targetPrice, targetReason } = selectRewardTarget(
    structural,
    close,
    atr14,
    selectedStop.level
  );

  const risk = close - selectedStop.level;
  const reward = targetPrice - close;
  const riskRewardRatio = risk > 0 ? reward / risk : null;
  const stopDistancePct = (risk / close) * 100;
  const estimatedRewardPct = (reward / close) * 100;

  let rrRejectionReason: string | null = null;
  if (riskRewardRatio != null && riskRewardRatio < RR_ACCEPTABLE) {
    if (targetReason === "atr_floor" || targetReason === "pct_floor") {
      rrRejectionReason = "No structural resistance above entry — reward uses minimum floor only";
    } else {
      rrRejectionReason = `Nearest resistance (${targetReason}) too close — R:R ${riskRewardRatio.toFixed(2)} < ${RR_ACCEPTABLE}`;
    }
  }

  return {
    stopLevel: selectedStop.level,
    invalidLevelReason: selectedStop.reason,
    rewardTarget: targetPrice,
    targetPrice,
    targetReason,
    rewardSource: targetReason,
    riskRewardRatio,
    stopDistancePct,
    estimatedRewardPct,
    rrRejectionReason,
  };
}

function emptyRiskReward(): EarlyEntryRiskRewardResult {
  return {
    stopLevel: null,
    invalidLevelReason: null,
    rewardTarget: null,
    targetPrice: null,
    targetReason: null,
    rewardSource: null,
    riskRewardRatio: null,
    stopDistancePct: null,
    estimatedRewardPct: null,
    rrRejectionReason: null,
  };
}

export function isRiskRewardAcceptable(ratio: number | null): boolean {
  return ratio != null && Number.isFinite(ratio) && ratio >= RR_ACCEPTABLE;
}

export function isRiskRewardBad(ratio: number | null): boolean {
  return ratio != null && Number.isFinite(ratio) && ratio < RR_BAD;
}
