import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import {
  computeRelativeReturnAtSession,
  RS_LOOKBACK_20,
} from "@/lib/scanner/gate2/relative-strength";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  barsThroughSession,
  computeAtr14,
  computeMaAtIndex,
  detectPocketPivot,
  detectPriorCompression,
  utcDayKey,
  volumeMa20AtIndex,
} from "./bar-metrics";
import {
  computeEarlyReversalScore,
  computeExtensionRiskScore,
  computeRiskRewardScore,
  PILOT_SCORE_THRESHOLD,
} from "./early-reversal-score";
import { detectEarlyEntryReasonCodes } from "./reason-codes";
import { computeEarlyEntryRiskReward } from "./risk-reward";
import {
  computeMa10Series,
  deriveEarlyEntryTradeState,
  detectAddZoneContext,
  detectStructureBroken,
  hadRecentPilotContextInLookback,
  resolveEntryType,
  resolveSizingNote,
  resolveSuggestedPilotSizePct,
  resolveWhyNotPilotYet,
} from "./state-machine";
import type {
  EarlyEntryDisplayMetadata,
  EarlyEntryEvaluationResult,
  EarlyEntryTradeState,
  ReasonDetectionInput,
} from "./types";

export type EvaluateEarlyEntryParams = {
  stockBars: readonly Gate2BarInput[];
  indexBars: readonly Gate2BarInput[];
  sessionDate: Date;
};

const PILOT_LOOKBACK = 15;

function scoreHistoryThroughIdx(
  barsThrough: readonly Gate2BarInput[],
  indexBars: readonly Gate2BarInput[],
  endIdx: number
): { score: number; state: EarlyEntryTradeState }[] {
  const history: { score: number; state: EarlyEntryTradeState }[] = [];
  for (let i = 50; i < endIdx; i++) {
    const session = barsThrough[i]!.date;
    const snap = evaluateEarlyEntrySession({
      stockBars: barsThrough,
      indexBars,
      sessionDate: session,
      skipLookback: true,
    });
    if (snap) {
      history.push({
        score: snap.earlyReversalScore,
        state: snap.proposedTradeState,
      });
    }
  }
  return history;
}

/**
 * Point-in-time early-entry evaluation — display only; does not mutate Gate 2.
 */
export function evaluateEarlyEntrySession(
  params: EvaluateEarlyEntryParams & { skipLookback?: boolean }
): EarlyEntryEvaluationResult | null {
  const sliced = barsThroughSession(params.stockBars, params.sessionDate);
  if (!sliced || sliced.idx < 50) return null;

  const { sorted: barsThrough, idx } = sliced;
  const bar = barsThrough[idx]!;
  const prevBar = idx > 0 ? barsThrough[idx - 1]! : null;
  const closes = barsThrough.map((b) => b.close);

  const { ma20, ma50, ma20Series } = computeMaAtIndex(barsThrough, idx);
  const ma10Series = computeMa10Series(closes);
  const volumeMa20 = volumeMa20AtIndex(barsThrough, idx);
  const volumeRatio =
    volumeMa20 != null && volumeMa20 > 0 ? bar.volume / volumeMa20 : null;

  const rsNow = computeRelativeReturnAtSession(
    barsThrough,
    params.indexBars,
    bar.date,
    RS_LOOKBACK_20
  );
  const rsPrev =
    idx >= 3
      ? computeRelativeReturnAtSession(
          barsThrough,
          params.indexBars,
          barsThrough[idx - 3]!.date,
          RS_LOOKBACK_20
        )
      : null;
  const rs20Delta3d =
    rsNow?.rsSpreadPct != null && rsPrev?.rsSpreadPct != null
      ? rsNow.rsSpreadPct - rsPrev.rsSpreadPct
      : null;

  const bodyPct = bar.open > 0 ? Math.abs(bar.close - bar.open) / bar.open : null;
  const atr14 = computeAtr14(barsThrough, idx);
  const closeNearHighPct =
    bar.high > bar.low ? (bar.close - bar.low) / (bar.high - bar.low) : null;
  const distFromMa20Pct =
    ma20 != null && ma20 > 0 ? ((bar.close - ma20) / ma20) * 100 : null;
  const distFromMa50Pct =
    ma50 != null && ma50 > 0 ? ((bar.close - ma50) / ma50) * 100 : null;

  const prevClose = prevBar?.close ?? bar.close;
  const reclaimMa20 = ma20 != null && bar.close >= ma20 && prevClose < ma20;
  const reclaimMa50 = ma50 != null && bar.close >= ma50 && prevClose < ma50;
  const priorCompression = detectPriorCompression(barsThrough, idx);
  const pocketPivot = detectPocketPivot(barsThrough, idx);

  const rr = computeEarlyEntryRiskReward(barsThrough, idx, ma20, ma50);
  const gate2 = evaluateBreakoutPullbackCandidate(barsThrough, bar.date);

  const detectionInput: ReasonDetectionInput = {
    bar,
    prevBar,
    bars: barsThrough,
    idx,
    ma20,
    ma50,
    ma20Series,
    volumeRatio,
    atr14,
    bodyPct,
    closeNearHighPct,
    distFromMa20Pct,
    distFromMa50Pct,
    priorCompression,
    pocketPivot,
    riskRewardRatio: rr.riskRewardRatio,
    rs20Delta3d,
    reclaimMa20,
    reclaimMa50,
  };

  const reasonCodes = detectEarlyEntryReasonCodes(detectionInput, rr.stopDistancePct);

  const metrics = {
    sessionDate: utcDayKey(bar.date),
    close: bar.close,
    ma20,
    ma50,
    volume: bar.volume,
    volumeMa20,
    volumeRatio,
    rs20SpreadPct: rsNow?.rsSpreadPct ?? null,
    rs20Delta3d,
    bodyPct,
    atr14,
    closeNearHighPct,
    distFromMa20Pct,
    distFromMa50Pct,
    stopLevel: rr.stopLevel,
    stopDistancePct: rr.stopDistancePct,
    rewardTarget: rr.rewardTarget,
    targetPrice: rr.targetPrice,
    targetReason: rr.targetReason,
    invalidLevelReason: rr.invalidLevelReason,
    riskRewardRatio: rr.riskRewardRatio,
    estimatedRewardPct: rr.estimatedRewardPct,
    priorCompression,
    reclaimMa20,
    reclaimMa50,
  };

  const earlyReversalScore = computeEarlyReversalScore({ reasonCodes, metrics });
  const extensionRiskScore = computeExtensionRiskScore(metrics);
  const riskRewardScore = computeRiskRewardScore(rr.riskRewardRatio);

  const pilotHistory = params.skipLookback
    ? []
    : scoreHistoryThroughIdx(barsThrough, params.indexBars, idx);
  const hadRecentPilotContext = hadRecentPilotContextInLookback(
    pilotHistory,
    PILOT_LOOKBACK
  );

  const structureBroken = detectStructureBroken(bar.close, rr.stopLevel);

  const addZone = detectAddZoneContext({
    bars: barsThrough,
    idx,
    ma20,
    ma50,
    ma20Series,
    ma10Series,
    volumeRatio,
    prevBar,
    hadRecentPilotContext,
    riskRewardRatio: rr.riskRewardRatio,
    invalidLevel: rr.stopLevel,
    close: bar.close,
  });

  const { state: proposedTradeState, transitionReasonCodes } = deriveEarlyEntryTradeState({
    reasonCodes,
    transitionReasonCodes: addZone.transitionCodes,
    earlyReversalScore,
    extensionRiskScore,
    gate2Quality: gate2.quality,
    metrics,
    hadRecentPilotContext,
    structureBroken,
  });

  const display = toEarlyEntryDisplayMetadata({
    earlyReversalScore,
    extensionRiskScore,
    riskRewardScore,
    reasonCodes,
    transitionReasonCodes,
    metrics,
    proposedTradeState,
    gate2Quality: gate2.quality,
    terminalCode: gate2.terminalCode ?? null,
    invalidLevel: rr.stopLevel,
    rrRejectionReason: rr.rrRejectionReason,
  });

  return {
    ...display,
    metrics,
    extensionRiskScore,
    riskRewardScore,
  };
}

export function toEarlyEntryDisplayMetadata(params: {
  earlyReversalScore: number;
  extensionRiskScore: number;
  riskRewardScore: number;
  reasonCodes: readonly import("./types").EarlyEntryReasonCode[];
  transitionReasonCodes: readonly import("./types").EarlyEntryTransitionReasonCode[];
  metrics: import("./types").EarlyEntryBarMetrics;
  proposedTradeState: import("./types").EarlyEntryTradeState;
  gate2Quality: string;
  terminalCode: string | null;
  invalidLevel: number | null;
  rrRejectionReason: string | null;
}): EarlyEntryDisplayMetadata {
  const entryType = resolveEntryType({
    reasonCodes: params.reasonCodes,
    proposedTradeState: params.proposedTradeState,
    gate2Quality: params.gate2Quality,
  });

  return {
    earlyReversalScore: params.earlyReversalScore,
    proposedTradeState: params.proposedTradeState,
    entryType,
    reasonCodes: [...params.reasonCodes],
    transitionReasonCodes: [...params.transitionReasonCodes],
    invalidLevel: params.invalidLevel,
    invalidLevelReason: params.metrics.invalidLevelReason,
    stopDistancePct: params.metrics.stopDistancePct,
    targetPrice: params.metrics.targetPrice,
    targetReason: params.metrics.targetReason,
    estimatedRewardPct: params.metrics.estimatedRewardPct,
    estimatedRiskReward: params.metrics.riskRewardRatio,
    suggestedPilotSizePct: resolveSuggestedPilotSizePct(params.proposedTradeState),
    sizingNote: resolveSizingNote(params.proposedTradeState),
    whyNotPilotYet: resolveWhyNotPilotYet({
      proposedTradeState: params.proposedTradeState,
      reasonCodes: params.reasonCodes,
      terminalCode: params.terminalCode,
      earlyReversalScore: params.earlyReversalScore,
      rrRejectionReason: params.rrRejectionReason,
    }),
    rrRejectionReason: params.rrRejectionReason,
  };
}

export function evaluateEarlyEntryForSymbol(params: {
  symbol: string;
  stockBars: readonly Gate2BarInput[];
  indexBars: readonly Gate2BarInput[];
  sessionDate: Date;
}): EarlyEntryDisplayMetadata | null {
  const result = evaluateEarlyEntrySession({
    stockBars: params.stockBars,
    indexBars: params.indexBars,
    sessionDate: params.sessionDate,
  });
  if (!result) return null;
  const { metrics: _m, extensionRiskScore: _e, riskRewardScore: _r, ...display } = result;
  return display;
}
