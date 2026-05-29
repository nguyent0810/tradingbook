import {
  GATE2_RANK_DEPTH_CAP,
  GATE2_RANK_EXT_CAP,
  GATE2_RANK_MA_CAP,
  GATE2_RANK_VOL_CAP,
} from "./constants";

/** Decomposed Gate 2 rank score (explainability only — formula unchanged). */
export type Gate2RankComponents = {
  volumeTerm: number;
  extensionTerm: number;
  maDistanceTerm: number;
  depthPenalty: number;
  rankScore: number;
  inputs: {
    volRatio: number;
    extensionPct: number;
    maDistancePct: number;
    depthFrac: number;
  };
};

export type Gate2RankScoreParams = {
  volRatio: number;
  close: number;
  breakoutLevel: number;
  ma50: number;
  minLowSinceBreakout: number;
};

/**
 * Same math as legacy `computeGate2RankScore` — returns terms and final score.
 */
export function computeGate2RankBreakdown(params: Gate2RankScoreParams): Gate2RankComponents {
  const { volRatio, close, breakoutLevel, ma50, minLowSinceBreakout } = params;
  const extRaw =
    breakoutLevel > 0 ? ((close - breakoutLevel) / breakoutLevel) * 100 : 0;
  const maRaw = ma50 > 0 ? ((close - ma50) / ma50) * 100 : 0;
  const depthRaw =
    breakoutLevel > 0
      ? Math.max(0, (breakoutLevel - minLowSinceBreakout) / breakoutLevel)
      : 0;

  const volumeTerm = 1000 * Math.min(volRatio, GATE2_RANK_VOL_CAP);
  const extensionTerm = 100 * Math.min(Math.max(0, extRaw), GATE2_RANK_EXT_CAP);
  const maDistanceTerm = 50 * Math.min(Math.max(0, maRaw), GATE2_RANK_MA_CAP);
  const depthPenalty = 200 * Math.min(depthRaw, GATE2_RANK_DEPTH_CAP);
  const rankScore = volumeTerm + extensionTerm + maDistanceTerm - depthPenalty;

  return {
    volumeTerm,
    extensionTerm,
    maDistanceTerm,
    depthPenalty,
    rankScore,
    inputs: {
      volRatio,
      extensionPct: extRaw,
      maDistancePct: maRaw,
      depthFrac: depthRaw,
    },
  };
}

/** Human-readable lines for Setups / debug panels. */
export function formatGate2RankBreakdownLines(c: Gate2RankComponents): string[] {
  return [
    `Rank score ${c.rankScore.toFixed(2)} = volume ${c.volumeTerm.toFixed(2)} + extension ${c.extensionTerm.toFixed(2)} + MA distance ${c.maDistanceTerm.toFixed(2)} − depth penalty ${c.depthPenalty.toFixed(2)}`,
    `Inputs: vol ${c.inputs.volRatio.toFixed(2)}× median, extension ${c.inputs.extensionPct.toFixed(2)}% above breakout, ${c.inputs.maDistancePct.toFixed(2)}% above MA50, depth ${(c.inputs.depthFrac * 100).toFixed(2)}% under breakout`,
  ];
}

/** One-line summary for dashboard chips. */
export function formatGate2RankSummary(c: Gate2RankComponents): string {
  return `Rank ${c.rankScore.toFixed(0)} (vol +${c.volumeTerm.toFixed(0)}, ext +${c.extensionTerm.toFixed(0)}, MA +${c.maDistanceTerm.toFixed(0)}, depth −${c.depthPenalty.toFixed(0)})`;
}
