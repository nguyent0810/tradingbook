/**
 * The worst-case loss per share a Gợi ý lệnh is sized on (CONTEXT.md: R, Đệm
 * gap): the stop distance, plus brokerage on both legs and the sell tax, plus
 * one full price band of the exchange below the stop (a session that opens at
 * the floor through the stop).
 *
 * One function for the suggestion builder, the order-ticket modal's risk
 * readout and the server's ceiling when a trade is logged, so the three can
 * never measure risk on different bases. Pure; prices in kVND.
 */
import { ROUND_TRIP_FEE_FRAC } from "@/lib/scanner/stop-feasibility";
import { bandPct, type Exchange } from "@/lib/market/exchange-rules";

/** 0.1% transfer tax on every sale. */
export const SELL_TAX_FRAC = 0.001;
/**
 * Brokerage per side. `ROUND_TRIP_FEE_FRAC` is two sides of brokerage plus the
 * sell tax (see its doc), so one side is what remains halved: 0.15%.
 */
export const BROKERAGE_PER_SIDE_FRAC = (ROUND_TRIP_FEE_FRAC - SELL_TAX_FRAC) / 2;

/** kVND rounded to whole VND — sheds float noise from differences of quotes. */
export function roundToWholeVndInKvnd(kvnd: number): number {
  return Math.round(kvnd * 1000) / 1000;
}

export type WorstCaseRiskPerShare = {
  /** entry − stop, kVND per share (rounded to whole VND). */
  perShareGrossKvnd: number;
  /** Gross plus brokerage on the buy and brokerage + tax on the sell, kVND per share. */
  perShareNetKvnd: number;
  /** Đệm gap: one band of the exchange × the stop, kVND per share. */
  gapBufferKvnd: number;
  /** Net plus the gap buffer, kVND per share. */
  worstCasePerShareKvnd: number;
};

export function worstCaseRiskPerShare(params: {
  entryKvnd: number;
  stopKvnd: number;
  exchange: Exchange;
}): WorstCaseRiskPerShare {
  const { entryKvnd, stopKvnd, exchange } = params;
  const perShareGrossKvnd = roundToWholeVndInKvnd(entryKvnd - stopKvnd);
  // Costs are fractions of a VND per share; they are kept, not rounded, so
  // targets solved against the net figure are exact.
  const perShareNetKvnd =
    perShareGrossKvnd +
    entryKvnd * BROKERAGE_PER_SIDE_FRAC +
    stopKvnd * (BROKERAGE_PER_SIDE_FRAC + SELL_TAX_FRAC);
  const gapBufferKvnd = stopKvnd * (bandPct(exchange) / 100);
  return {
    perShareGrossKvnd,
    perShareNetKvnd,
    gapBufferKvnd,
    worstCasePerShareKvnd: perShareNetKvnd + gapBufferKvnd,
  };
}
