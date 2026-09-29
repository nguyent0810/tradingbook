/**
 * Exchange rules for Vietnamese equities: which board a symbol trades on, the
 * tick it must be quoted in, the price band of the next session and the board
 * lot. Every price shown in a trade suggestion goes through here, so that each
 * one can be typed into a broker app as-is.
 *
 * Prices are in kVND, the app's unit (see src/lib/position-sizing.ts).
 * Arithmetic is done in whole VND so ticks never drift through floating-point
 * error.
 *
 * The tick table is deliberately the one in scanner/stop-feasibility, which is a
 * frozen classifier file (PROSPECTIVE-REGISTRY-PLAN.md §14): suggestions quote
 * the same ticks the classifier judged stops against. A tick-table fix there is
 * therefore a new classifier version, not an edit.
 */
import { roundDownToBoardLotShares } from "@/lib/paper-lab/engine/board-lot";
import { tickSizeVnd, type Board } from "@/lib/scanner/stop-feasibility";

export type Exchange = Board;

export type ResolvedExchange = {
  exchange: Exchange;
  /**
   * True when the symbol has no board on record and HOSE rules were assumed.
   * `exchange` is NULL for most symbols in this database, so callers should
   * surface this rather than present HOSE ticks and bands as certain.
   */
  assumed: boolean;
};

export function resolveExchange(raw: string | null): ResolvedExchange {
  const upper = (raw ?? "").trim().toUpperCase();
  if (upper === "HOSE" || upper === "HNX" || upper === "UPCOM") {
    return { exchange: upper, assumed: false };
  }
  return { exchange: "HOSE", assumed: true };
}

/** kVND -> whole VND, shedding float noise such as 23.4 + 0.05 = 23.450000000000003. */
function toVnd(priceKvnd: number): number {
  return Math.round(priceKvnd * 1000 * 1000) / 1000;
}

/** The exchange's tick at this price, in kVND. */
export function tickSize(priceKvnd: number, exchange: Exchange): number {
  return tickSizeVnd(toVnd(priceKvnd), exchange) / 1000;
}

export type SnapDirection = "nearest" | "down" | "up";

/**
 * Snap a price to the exchange's tick. Stops snap `down`, so rounding never
 * tightens them; the tick is the one of the price's own bracket. Brackets nest
 * (10đ divides 50đ divides 100đ, and 10.000đ / 50.000đ are multiples of all of
 * them), so a result that crosses a bracket edge is still a valid quote.
 */
export function snapToTick(priceKvnd: number, exchange: Exchange, direction: SnapDirection): number {
  const vnd = toVnd(priceKvnd);
  const tick = tickSizeVnd(vnd, exchange);
  const steps = vnd / tick;
  const snapped =
    direction === "down" ? Math.floor(steps) : direction === "up" ? Math.ceil(steps) : Math.round(steps);
  return (snapped * tick) / 1000;
}

const BAND_PCT: Record<Exchange, number> = { HOSE: 7, HNX: 10, UPCOM: 15 };

/** Daily price band of an exchange, in percent of the reference price. */
export function bandPct(exchange: Exchange): number {
  return BAND_PCT[exchange];
}

export type SessionBand = {
  bandPct: number;
  /** Lowest quotable price of the session: ref × (1 − band), rounded UP to the tick. */
  floor: number;
  /** Highest quotable price of the session: ref × (1 + band), rounded DOWN to the tick. */
  ceiling: number;
};

/** Price band of the session whose reference price is `refKvnd` (normally the previous close). */
export function sessionBand(refKvnd: number, exchange: Exchange): SessionBand {
  const pct = bandPct(exchange);
  return {
    bandPct: pct,
    floor: snapToTick(refKvnd * (1 - pct / 100), exchange, "up"),
    ceiling: snapToTick(refKvnd * (1 + pct / 100), exchange, "down"),
  };
}

/** Pull a price inside the session band; an out-of-band price becomes the band edge. */
export function clipToBand(priceKvnd: number, band: SessionBand): number {
  return Math.min(band.ceiling, Math.max(band.floor, priceKvnd));
}

/**
 * Round a share count down to the 100-share board lot. Anything below one lot,
 * or not a positive number, is 0: a suggestion must never round a size up.
 */
export function roundDownToLot(shares: number): number {
  const lot = roundDownToBoardLotShares(shares);
  return lot.ok ? lot.quantity : 0;
}
