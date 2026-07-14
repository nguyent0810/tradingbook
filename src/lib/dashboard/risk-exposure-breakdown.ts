/**
 * Distinct, non-duplicated exposure/risk quantities for OPEN trades, beyond
 * the existing cost-basis `openExposureVnd` (see `decision-cockpit-dto.ts`
 * `RiskBudgetHeadroomDto`, which already carries cost basis + book ceiling +
 * remaining book headroom — those are referenced, not recomputed, here).
 */

export type DecisionCockpitOpenTradeSnapshot = {
  symbol: string;
  entryPrice: number;
  quantity: number;
  /** `Trade.stopLoss` — null means "risk unknown", never treated as zero risk. */
  stopLoss: number | null;
};

export type RiskToStopBreakdownDto = {
  /** Sum of (entryPrice − stopLoss) × quantity for OPEN trades where stopLoss is set. */
  knownRiskVnd: number;
  /** Count of OPEN trades with a known (non-null) stopLoss, included in `knownRiskVnd`. */
  knownStopCount: number;
  /** Count of OPEN trades with `stopLoss: null` — excluded from the sum, surfaced as a gap. */
  unknownStopCount: number;
};

export type MarkToMarketExposureDto = {
  /** False when no open-trade symbol had a resolvable latest close. */
  available: boolean;
  /** Sum of latestClose × quantity across open trades with a resolvable close; null when unavailable. */
  exposureVnd: number | null;
  /** Count of open trades whose symbol had no resolvable latest close. */
  missingCloseCount: number;
  /** Honest reason surfaced to the UI when partial/unavailable — never silently hidden. */
  unavailableReason: string | null;
};

/**
 * Fail-closed: a trade with `stopLoss: null` is excluded from the risk sum
 * and counted separately as "unknown" — it is never assumed to carry zero
 * risk (that would understate real book risk).
 */
export function buildRiskToStopBreakdown(
  openTrades: readonly DecisionCockpitOpenTradeSnapshot[]
): RiskToStopBreakdownDto {
  let knownRiskVnd = 0;
  let knownStopCount = 0;
  let unknownStopCount = 0;

  for (const t of openTrades) {
    if (t.stopLoss == null || !Number.isFinite(t.stopLoss)) {
      unknownStopCount += 1;
      continue;
    }
    knownStopCount += 1;
    const perShareRisk = Math.max(0, t.entryPrice - t.stopLoss);
    knownRiskVnd += perShareRisk * t.quantity;
  }

  return { knownRiskVnd, knownStopCount, unknownStopCount };
}

/**
 * Mark-to-market exposure for OPEN trades using an already-loaded latest
 * close per symbol (uppercase ticker keys — see
 * `fetchLatestCloseByTradeSymbols` in `src/lib/trades/unrealized-from-close.ts`,
 * the same helper already used for unrealized P&L on the Trades ledger). No
 * new price-fetch mechanism is introduced here; symbols with no resolvable
 * close are excluded from the sum and counted, not assumed to equal cost basis.
 */
export function buildMarkToMarketExposure(
  openTrades: readonly Pick<DecisionCockpitOpenTradeSnapshot, "symbol" | "quantity">[],
  latestCloseBySymbol: ReadonlyMap<string, number>
): MarkToMarketExposureDto {
  if (openTrades.length === 0) {
    return { available: true, exposureVnd: 0, missingCloseCount: 0, unavailableReason: null };
  }

  let exposureVnd = 0;
  let missingCloseCount = 0;

  for (const t of openTrades) {
    const key = t.symbol.trim().toUpperCase();
    const close = latestCloseBySymbol.get(key);
    if (close == null || !Number.isFinite(close)) {
      missingCloseCount += 1;
      continue;
    }
    exposureVnd += close * t.quantity;
  }

  if (missingCloseCount === openTrades.length) {
    return {
      available: false,
      exposureVnd: null,
      missingCloseCount,
      unavailableReason:
        "No latest close available for any open position — mark-to-market exposure unavailable.",
    };
  }

  return {
    available: true,
    exposureVnd,
    missingCloseCount,
    unavailableReason:
      missingCloseCount > 0
        ? `${missingCloseCount} of ${openTrades.length} open position(s) missing a latest close — mark-to-market is partial.`
        : null,
  };
}
