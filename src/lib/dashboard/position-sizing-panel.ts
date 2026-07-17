import {
  computePositionSizing,
  kVndToPerShareVnd,
  type PositionSizingQuality,
} from "@/lib/position-sizing";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import type { ConfidenceBand, SetupLadderStage } from "./decision-cockpit-dto";

/**
 * VN equities trade in board lots of 100 shares — any recommended size must be
 * rounded DOWN to a multiple of this, on top of (not instead of)
 * `computePositionSizing`'s own risk/exposure floor.
 */
export const VN_BOARD_LOT_SHARES = 100;

/**
 * Cap a recommended position at this fraction of one day's average dollar
 * volume (ADV). Rationale: a position larger than this would take multiple
 * sessions to exit without excess market impact/slippage — 10% of one day's
 * ADV is a conservative, commonly used liquidity ceiling, not a backtested
 * figure specific to this product.
 */
export const LIQUIDITY_CAP_PCT_OF_ADV = 0.1;

/**
 * VN stocks can gap through a stop on the open (no continuous overnight
 * trading). We assume the stop could execute this much further away than the
 * scanner's stated stop, due to slippage / overnight gap risk, and size
 * accordingly — this only ever makes the recommended size smaller/equal to a
 * naive stop-distance calculation, never larger. Expressed as a fraction of
 * entry price. Not empirically calibrated to VN gap statistics — a
 * conservative round-number default.
 */
export const SLIPPAGE_GAP_BUFFER_PCT = 0.005;

/**
 * Base risk-per-trade budget vs equity, before quality (Tier A/B) scaling.
 * 1% of equity risked per trade is a standard conservative convention in
 * discretionary/swing risk management — not backtested for this product's
 * edge, just a widely used fail-closed starting point. Matches the example
 * already documented on `computePositionSizing` itself.
 */
export const DEFAULT_BASE_RISK_PER_TRADE_PCT = 0.01;

/**
 * Ceiling on a single trade's notional vs equity, independent of the risk
 * budget above (protects against a very tight stop implying a huge share
 * count). 20% of equity is a standard conservative convention — again not
 * empirically backtested, a documented product decision made fail-closed.
 * Matches the example already documented on `computePositionSizing` itself.
 */
export const DEFAULT_MAX_PER_TRADE_EXPOSURE_PCT = 0.2;

export type PositionSizingCandidateInput = {
  symbolKey: string;
  quality: PositionSizingQuality;
  ladderStage: SetupLadderStage;
  /** Scanner close, k ₫ per share (same convention as `computePositionSizing`'s `entryKVnd`). */
  closeKVnd: number;
  /** Scanner stop level, k ₫ per share — widened by `SLIPPAGE_GAP_BUFFER_PCT` before sizing. */
  stopKVnd: number;
};

export type PositionSizingPanelDto = {
  symbol: string;
  quality: PositionSizingQuality;
  ladderStage: SetupLadderStage;
  entryVndPerShare: number;
  /** Raw scanner stop, VND per share — before the slippage/gap buffer widened it. */
  rawStopVndPerShare: number;
  /** Stop actually used for sizing math (raw stop pushed further away by the buffer). */
  effectiveStopVndPerShare: number;
  perShareRiskVnd: number;
  /** Final recommended quantity — after risk sizing, liquidity cap, and board-lot rounding. */
  qtyShares: number;
  /** Quantity from `computePositionSizing` alone, before liquidity cap / board-lot rounding (diagnostic). */
  qtyBeforeAdjustmentsShares: number;
  notionalVnd: number;
  riskAtStopVnd: number;
  positionPctOfAccount: number;
  baseRiskPerTradePct: number;
  maxPerTradeExposurePct: number;
  /** True only when ADV data was available AND it reduced the recommended quantity. */
  liquidityCapApplied: boolean;
  /** False when `volMa20` was unavailable for this symbol — no cap could be computed. */
  liquidityDataAvailable: boolean;
  advVnd: number | null;
  boardLotShares: number;
  /** Honest, surfaced gaps — never silently hidden (e.g. missing liquidity data). */
  gaps: string[];
};

export type BuildRecommendedPositionSizingParams = {
  /** Surfaced candidates in existing rank order (best first) — same source as the opportunity board. */
  candidates: readonly PositionSizingCandidateInput[];
  confidenceBand: ConfidenceBand;
  accountEquityVnd: number | null;
  /** Existing book-level cost-basis exposure (`openExposureVnd`) — reused, not recomputed. */
  currentPortfolioExposureVnd: number;
  /** Upper bound of verdict max-book allocation, decimal (reuses `riskBudgetHeadroom.maxBookPercent`). */
  maxPortfolioExposurePct: number | null;
  marketContext?: MarketContextUiDto | null;
  baseRiskPerTradePct?: number;
  maxPerTradeExposurePct?: number;
  liquidityCapPctOfAdv?: number;
};

/** Scanner/stored `volMa20` (shares) × entry close → ADV in VND, or null when volume data is unavailable. */
export function computeAdvVnd(
  volMa20: number | null | undefined,
  closeKVnd: number
): number | null {
  if (volMa20 == null || !Number.isFinite(volMa20) || volMa20 <= 0) return null;
  if (!Number.isFinite(closeKVnd) || closeKVnd <= 0) return null;
  return volMa20 * kVndToPerShareVnd(closeKVnd);
}

/**
 * Widens the assumed stop distance by `SLIPPAGE_GAP_BUFFER_PCT` of entry price
 * (moves the effective stop further from entry) — always more conservative
 * than the raw scanner stop, never less. Call-site adjustment only;
 * `computePositionSizing` itself is untouched.
 */
export function applySlippageGapBuffer(entryKVnd: number, stopKVnd: number): number {
  return stopKVnd - entryKVnd * SLIPPAGE_GAP_BUFFER_PCT;
}

/** Floor to the nearest VN board lot (100 shares) — never rounds up. */
export function floorToBoardLot(qtyShares: number): number {
  if (!Number.isFinite(qtyShares) || qtyShares <= 0) return 0;
  return Math.floor(qtyShares / VN_BOARD_LOT_SHARES) * VN_BOARD_LOT_SHARES;
}

/**
 * Caps quantity at `LIQUIDITY_CAP_PCT_OF_ADV` of one day's average dollar
 * volume. When `advVnd` is null (no volume data), no cap is applied — there
 * is nothing to cap against — and the caller must surface that gap
 * separately (`liquidityDataAvailable`).
 */
export function applyLiquidityCap(params: {
  qtyShares: number;
  entryVndPerShare: number;
  advVnd: number | null;
  /** Fraction of one day's ADV — defaults to `LIQUIDITY_CAP_PCT_OF_ADV`. */
  liquidityCapPctOfAdv?: number;
}): { qtyShares: number; capApplied: boolean } {
  const {
    qtyShares,
    entryVndPerShare,
    advVnd,
    liquidityCapPctOfAdv = LIQUIDITY_CAP_PCT_OF_ADV,
  } = params;
  if (advVnd == null || !(entryVndPerShare > 0)) {
    return { qtyShares, capApplied: false };
  }
  const capNotionalVnd = advVnd * liquidityCapPctOfAdv;
  const capQtyShares = Math.floor(capNotionalVnd / entryVndPerShare);
  if (capQtyShares < qtyShares) {
    return { qtyShares: Math.max(0, capQtyShares), capApplied: true };
  }
  return { qtyShares, capApplied: false };
}

/**
 * Dashboard-only wrapper around `computePositionSizing` for the single best
 * actionable opportunity. Fail-closed gates (return `null`, not a muted/zero
 * recommendation):
 *   - confidence band is "low" (never recommend a fresh position on a low-confidence day)
 *   - equity is not configured
 *   - the book cap (`maxPortfolioExposurePct`) could not be resolved
 *   - no eligible Tier A/B candidate is surfaced
 *   - `computePositionSizing` itself rejects the inputs (defensive)
 */
export function buildRecommendedPositionSizing(
  params: BuildRecommendedPositionSizingParams
): PositionSizingPanelDto | null {
  const {
    candidates,
    confidenceBand,
    accountEquityVnd,
    currentPortfolioExposureVnd,
    maxPortfolioExposurePct,
    marketContext,
    baseRiskPerTradePct = DEFAULT_BASE_RISK_PER_TRADE_PCT,
    maxPerTradeExposurePct = DEFAULT_MAX_PER_TRADE_EXPOSURE_PCT,
    liquidityCapPctOfAdv = LIQUIDITY_CAP_PCT_OF_ADV,
  } = params;

  if (confidenceBand === "low") return null;
  if (accountEquityVnd == null || accountEquityVnd <= 0) return null;
  if (maxPortfolioExposurePct == null) return null;

  const eligible =
    candidates.find((c) => c.ladderStage === "tier_a") ??
    candidates.find((c) => c.ladderStage === "tier_b");
  if (!eligible) return null;

  const effectiveStopKVnd = applySlippageGapBuffer(eligible.closeKVnd, eligible.stopKVnd);

  const sizing = computePositionSizing({
    accountEquityVnd,
    maxPortfolioExposurePct,
    currentPortfolioExposureVnd,
    maxPerTradeExposurePct,
    baseRiskPerTradePct,
    quality: eligible.quality,
    entryKVnd: eligible.closeKVnd,
    stopKVnd: effectiveStopKVnd,
  });
  if (!sizing.ok) return null;

  const advVnd = computeAdvVnd(
    marketContext?.bySymbol?.[eligible.symbolKey.toUpperCase()]?.volMa20 ?? null,
    eligible.closeKVnd
  );
  const liquidityDataAvailable = advVnd != null;
  const { qtyShares: qtyAfterLiquidity, capApplied: liquidityCapApplied } = applyLiquidityCap({
    qtyShares: sizing.value.qFinalShares,
    entryVndPerShare: sizing.value.entryVndPerShare,
    advVnd,
    liquidityCapPctOfAdv,
  });

  const finalQtyShares = floorToBoardLot(qtyAfterLiquidity);
  const notionalVnd = finalQtyShares * sizing.value.entryVndPerShare;
  const riskAtStopVnd = finalQtyShares * sizing.value.perShareRiskVnd;
  const positionPctOfAccount =
    accountEquityVnd > 0 ? (notionalVnd / accountEquityVnd) * 100 : 0;

  const gaps: string[] = [];
  if (!liquidityDataAvailable) {
    gaps.push(
      "20-day average volume unavailable for this symbol — no liquidity cap applied; size is risk-based only."
    );
  }
  if (finalQtyShares === 0) {
    gaps.push(
      "Risk-based size rounds down to less than one board lot (100 shares) — no position recommended today."
    );
  }

  return {
    symbol: eligible.symbolKey,
    quality: eligible.quality,
    ladderStage: eligible.ladderStage,
    entryVndPerShare: sizing.value.entryVndPerShare,
    rawStopVndPerShare: kVndToPerShareVnd(eligible.stopKVnd),
    effectiveStopVndPerShare: sizing.value.stopVndPerShare,
    perShareRiskVnd: sizing.value.perShareRiskVnd,
    qtyShares: finalQtyShares,
    qtyBeforeAdjustmentsShares: sizing.value.qFinalShares,
    notionalVnd,
    riskAtStopVnd,
    positionPctOfAccount,
    baseRiskPerTradePct,
    maxPerTradeExposurePct,
    liquidityCapApplied,
    liquidityDataAvailable,
    advVnd,
    boardLotShares: VN_BOARD_LOT_SHARES,
    gaps,
  };
}
