/** Tier from surfaced Gate 2 candidate (presentation-only sizing). */
export type PositionSizingQuality = "A" | "B";

export type PositionSizingComputed = {
  entryVndPerShare: number;
  stopVndPerShare: number;
  perShareRiskVnd: number;
  remainingExposureVnd: number;
  riskBudgetVnd: number;
  qRaw: number;
  qFinalShares: number;
  notionalVnd: number;
  /** (notional / equity) × 100 */
  positionPctOfAccount: number;
  exposureAfterTradeVnd: number;
  remainingExposureAfterTradeVnd: number;
  stopDistancePctOfEntry: number;
  /** Planned loss at stop with qFinal shares */
  riskAtStopVnd: number;
  /** True when the liquidity-cap constraint (vs. remaining exposure / per-trade cap) was the binding one. */
  liquidityCapBinding: boolean;
};

export type PositionSizingErrorCode =
  | "INVALID_INPUT"
  | "ENTRY_NOT_ABOVE_STOP"
  | "ZERO_EQUITY"
  | "ZERO_ENTRY";

/**
 * Risk multiplier vs base risk % — Tier B uses half the budget (scanner tiers unchanged).
 */
export function qualityRiskMultiplier(quality: PositionSizingQuality): number {
  return quality === "A" ? 1 : 0.5;
}

/** Scanner/stored prices are k ₫ per share → VND per share. */
export function kVndToPerShareVnd(priceKVnd: number): number {
  return priceKVnd * 1000;
}

/**
 * Portfolio-aware, quality-scaled risk sizing. Gate / scanner outputs are inputs only.
 *
 * remainingExposure = equity × maxPortfolioExposure − currentPortfolioExposure
 *
 * Q_final = floor(min(Q_raw, remainingExposure/entry, (equity × maxPerTrade)/entry))
 */
export function computePositionSizing(params: {
  accountEquityVnd: number;
  /** Cap as decimal, e.g. 0.7 for 70% of equity */
  maxPortfolioExposurePct: number;
  currentPortfolioExposureVnd: number;
  /** Per-trade notional cap vs equity, e.g. 0.2 */
  maxPerTradeExposurePct: number;
  /** Base risk budget vs equity before quality scale, e.g. 0.01 */
  baseRiskPerTradePct: number;
  quality: PositionSizingQuality;
  /** Planned entry, k ₫ (same unit as scan rows). */
  entryKVnd: number;
  stopKVnd: number;
  /** Market-impact cap as decimal, e.g. 0.10 for 10% of the symbol's average daily traded value. */
  liquidityCapPct?: number | null;
  /** Symbol's average daily traded value (VND, e.g. 20-session ADV). */
  symbolAvgDailyValueVnd?: number | null;
}): { ok: true; value: PositionSizingComputed } | { ok: false; code: PositionSizingErrorCode } {
  const {
    accountEquityVnd: E,
    maxPortfolioExposurePct: mPort,
    currentPortfolioExposureVnd: curExp,
    maxPerTradeExposurePct: mTrade,
    baseRiskPerTradePct: rBase,
    quality,
    entryKVnd,
    stopKVnd,
    liquidityCapPct,
    symbolAvgDailyValueVnd,
  } = params;

  if (!Number.isFinite(E) || !Number.isFinite(mPort) || !Number.isFinite(curExp) || !Number.isFinite(mTrade)) {
    return { ok: false, code: "INVALID_INPUT" };
  }
  if (!Number.isFinite(rBase) || !Number.isFinite(entryKVnd) || !Number.isFinite(stopKVnd)) {
    return { ok: false, code: "INVALID_INPUT" };
  }
  if (E <= 0) return { ok: false, code: "ZERO_EQUITY" };

  const entryVnd = kVndToPerShareVnd(entryKVnd);
  const stopVnd = kVndToPerShareVnd(stopKVnd);
  if (entryVnd <= 0) return { ok: false, code: "ZERO_ENTRY" };
  const perShareRisk = entryVnd - stopVnd;
  if (perShareRisk <= 0) return { ok: false, code: "ENTRY_NOT_ABOVE_STOP" };

  const portfolioCeilingVnd = E * Math.max(0, Math.min(1, mPort));
  const remainingExposureVnd = Math.max(0, portfolioCeilingVnd - Math.max(0, curExp));

  const g = qualityRiskMultiplier(quality);
  const riskBudgetVnd = E * Math.max(0, rBase) * g;
  const qRaw = riskBudgetVnd / perShareRisk;

  const capFromRemaining = remainingExposureVnd / entryVnd;
  const capFromPerTrade = (E * Math.max(0, Math.min(1, mTrade))) / entryVnd;
  const capFromLiquidity =
    liquidityCapPct != null && symbolAvgDailyValueVnd != null && symbolAvgDailyValueVnd > 0
      ? (symbolAvgDailyValueVnd * Math.max(0, Math.min(1, liquidityCapPct))) / entryVnd
      : Infinity;

  const qFloored = Math.floor(Math.min(qRaw, capFromRemaining, capFromPerTrade, capFromLiquidity));
  const qFinalShares = Math.max(0, qFloored);
  const liquidityCapBinding =
    capFromLiquidity < Infinity && capFromLiquidity <= capFromRemaining && capFromLiquidity <= capFromPerTrade && capFromLiquidity < qRaw;

  const notionalVnd = qFinalShares * entryVnd;
  const positionPctOfAccount = E > 0 ? (notionalVnd / E) * 100 : 0;
  const exposureAfterTradeVnd = Math.max(0, curExp) + notionalVnd;
  const remainingExposureAfterTradeVnd = Math.max(0, portfolioCeilingVnd - exposureAfterTradeVnd);
  const stopDistancePctOfEntry = entryKVnd > 0 ? ((entryKVnd - stopKVnd) / entryKVnd) * 100 : 0;
  const riskAtStopVnd = qFinalShares * perShareRisk;

  return {
    ok: true,
    value: {
      entryVndPerShare: entryVnd,
      stopVndPerShare: stopVnd,
      perShareRiskVnd: perShareRisk,
      remainingExposureVnd,
      riskBudgetVnd,
      qRaw,
      qFinalShares,
      notionalVnd,
      positionPctOfAccount,
      exposureAfterTradeVnd,
      remainingExposureAfterTradeVnd,
      stopDistancePctOfEntry,
      riskAtStopVnd,
      liquidityCapBinding,
    },
  };
}
