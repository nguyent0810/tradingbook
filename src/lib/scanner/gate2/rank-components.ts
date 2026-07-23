import {
  GATE2_RANK_DEPTH_CAP,
  GATE2_RANK_EXT_CAP,
  GATE2_RANK_MA_CAP,
  GATE2_RANK_VOL_CAP,
} from "./constants";
import { CHASE_PCT, EXTENDED_PCT } from "@/lib/setup-health/evaluate-watch-health";

/**
 * Extension reward curve — shares its distance definition with setup-health's
 * own extension penalty (`EXTENDED_PCT`/`CHASE_PCT`, same % above breakout)
 * instead of a second, independently-tuned number. Reward rises with a fresh
 * breakout up to `EXTENDED_PCT` (still "healthy" by the same measure the
 * health scorer uses), then decays linearly to 0 by `CHASE_PCT` — a name
 * ranked higher for being MORE extended past the healthy point no longer
 * happens; rank and health point the same direction on the same setup.
 * (Reconciles docs/audits/trading-algorithm-audit.md finding F05.)
 *
 * PARTIAL reconciliation only, by design: this always uses the FLAT
 * `EXTENDED_PCT`/`CHASE_PCT` constants, never the ATR-normalized, per-stock
 * thresholds that `resolveExtensionThresholds` in evaluate-watch-health.ts
 * computes from `EXTENDED_ATR_MULT`/`TOO_EXTENDED_ATR_MULT`/`CHASE_ATR_MULT`
 * once 15+ bars are available. Concrete failure mode (see the "ATR vs flat
 * threshold divergence" describe block in rank-components.test.ts for
 * worked numbers): for a LOW-volatility stock, health's tighter ATR-based
 * thresholds can flag CHASE/DEAD at a raw % move where this flat curve is
 * still handing out ~86% of the max extension reward — rank under-penalizes
 * what health considers dangerously extended. For a HIGH-volatility stock,
 * health's wider ATR-based thresholds can call the same raw % move perfectly
 * HEALTHY (no extension flag at all) while this flat curve has already
 * decayed past its healthy ceiling to that same ~86% — rank over-penalizes
 * what health considers still fine for that stock's normal volatility. This
 * is a known, intentionally scoped gap, not a bug: closing it means
 * threading bars/ATR data into `Gate2RankScoreParams` (and from there into
 * `breakout-pullback.ts` / `run-daily-scan-job.ts`), a larger pipeline change
 * deliberately left out of scope when this reward curve was reconciled.
 */
function extensionRewardPct(extRawPct: number): number {
  const ext = Math.max(0, extRawPct);
  const healthyCeilingPct = EXTENDED_PCT * 100;
  const chaseFloorPct = CHASE_PCT * 100;
  if (ext <= healthyCeilingPct) return ext;
  if (ext >= chaseFloorPct) return 0;
  const decayFrac = (ext - healthyCeilingPct) / (chaseFloorPct - healthyCeilingPct);
  return healthyCeilingPct * (1 - decayFrac);
}

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
  const extensionTerm = 100 * Math.min(extensionRewardPct(extRaw), GATE2_RANK_EXT_CAP);
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
    `Điểm xếp hạng ${c.rankScore.toFixed(2)} = khối lượng ${c.volumeTerm.toFixed(2)} + độ mở rộng ${c.extensionTerm.toFixed(2)} + khoảng cách MA ${c.maDistanceTerm.toFixed(2)} − phạt độ sâu ${c.depthPenalty.toFixed(2)}`,
    `Đầu vào: KL ${c.inputs.volRatio.toFixed(2)}× trung vị, mở rộng ${c.inputs.extensionPct.toFixed(2)}% trên breakout, ${c.inputs.maDistancePct.toFixed(2)}% trên MA50, độ sâu ${(c.inputs.depthFrac * 100).toFixed(2)}% dưới breakout`,
  ];
}

/** One-line summary for dashboard chips. */
export function formatGate2RankSummary(c: Gate2RankComponents): string {
  return `Hạng ${c.rankScore.toFixed(0)} (KL +${c.volumeTerm.toFixed(0)}, mở rộng +${c.extensionTerm.toFixed(0)}, MA +${c.maDistanceTerm.toFixed(0)}, độ sâu −${c.depthPenalty.toFixed(0)})`;
}
