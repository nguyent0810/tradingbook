/**
 * Minimum executable stop distance.
 *
 * The existing floor (`GATE2_MIN_RISK_TO_STOP_FRAC` = 0.3% of entry) is a single
 * global percentage with no reference to how prices actually move or clear. At
 * the median VN entry price it permits a stop ~1.3 ticks away — inside the
 * bid-ask spread, where the stop is triggered by quote noise rather than by the
 * setup being wrong. See docs/trading/replay/GATE1-AND-STOP-AUDIT.md.
 *
 * This module replaces that with the binding maximum of three floors, each
 * answering a different question about whether a stop can exist:
 *
 *   TICK   — can the price even be quoted there, and is it outside the spread?
 *   FEE    — would a stop-out be dominated by round-trip cost?
 *   VOL    — is it outside the instrument's ordinary one-day movement?
 *
 * NONE of the coefficients here is fitted to the replay. They come from market
 * mechanics (tick tables, published fee ranges) and from the definition of ATR.
 * Fitting them on the same history the model is then judged against would make
 * any subsequent out-of-sample test meaningless, so the constants are chosen
 * first and measured afterwards.
 */

export type Board = "HOSE" | "HNX" | "UPCOM";

/**
 * HOSE tick table for shares and fund certificates, in VND.
 *
 * HNX and UPCOM quote a flat 100 VND for shares. HOSE is therefore the FINEST
 * board, and is used as the fallback when a symbol's board is unknown — which in
 * this database is almost always, `exchange` being NULL for 1,498 of 1,537
 * symbols. Falling back to the finest table yields the SMALLEST tick floor, so
 * an unknown board can never cause a setup to be rejected for a tick reason it
 * would not have faced on its real board.
 */
export function tickSizeVnd(priceVnd: number, board: Board = "HOSE"): number {
  if (board === "HNX" || board === "UPCOM") return 100;
  if (priceVnd < 10_000) return 10;
  if (priceVnd < 50_000) return 50;
  return 100;
}

/**
 * Round-trip brokerage as a fraction of notional.
 *
 * VN retail brokerage runs roughly 0.15%–0.35% per side; 0.15% per side is the
 * common discounted rate, so 0.30% round trip is a deliberately LOW estimate.
 * Selling also carries a 0.1% transfer tax, included here. Understating cost
 * keeps the floor permissive: the goal is to exclude stops that cannot work, not
 * to talk the strategy out of trading.
 */
export const ROUND_TRIP_FEE_FRAC = 0.004;

/**
 * How many ticks of clearance a stop needs.
 *
 * A quoted spread is at least one tick by construction. Price must cross the bid
 * to fill a stop on the way out, and the entry itself was lifted at the offer,
 * so two ticks is the minimum separation at which a stop-out reflects a price
 * move rather than the spread being crossed twice.
 */
export const MIN_STOP_TICKS = 2;

/**
 * Volatility floor, in ATR multiples.
 *
 * Chosen from the definition of the measure, not from the data: ATR is the
 * average distance an instrument travels in a single session (Wilder, 1978,
 * introduced it for exactly this purpose — sizing stops to volatility). A stop
 * closer than 1×ATR sits inside the range the instrument covers on an ordinary
 * day, so it will be hit by ordinary movement and carries no information about
 * whether the thesis failed.
 *
 * 1.0 is the weakest defensible multiple. Wilder's own volatility stop used
 * ~3×ATR, and 2×ATR is common practice; both would reject far more setups. 1.0
 * is used because this is a FEASIBILITY floor — the minimum at which a stop is a
 * stop — not a proposal about where stops should sit. A larger multiple would be
 * a strategy claim, and would need its own evidence.
 */
export const MIN_STOP_ATR_MULTIPLE = 1.0;

export type StopFloorInput = {
  /** Entry reference price, in the same unit as `atr` (this repo uses kVND). */
  entryPrice: number;
  /** ATR over `atrPeriod` sessions, same unit as `entryPrice`. Null when unavailable. */
  atr: number | null;
  board?: Board;
  /** Price unit relative to VND. kVND (the repo default) is 1000. */
  vndPerUnit?: number;
  feeFrac?: number;
  tickMultiple?: number;
  atrMultiple?: number;
};

export type StopFloor = {
  /** The binding floor, as a fraction of entry price. */
  minStopFrac: number;
  /** Which component bound it — the one worth reporting when a setup is rejected. */
  binding: "tick" | "fee" | "volatility";
  components: { tick: number; fee: number; volatility: number | null };
};

/**
 * The binding minimum stop distance for one candidate.
 *
 * Returns a fraction of entry price, directly comparable to the existing
 * `(close - stopLevel) / close`.
 */
export function computeMinStopFrac(input: StopFloorInput): StopFloor {
  const vndPerUnit = input.vndPerUnit ?? 1000;
  const feeFrac = input.feeFrac ?? ROUND_TRIP_FEE_FRAC;
  const tickMultiple = input.tickMultiple ?? MIN_STOP_TICKS;
  const atrMultiple = input.atrMultiple ?? MIN_STOP_ATR_MULTIPLE;

  if (!(input.entryPrice > 0)) {
    throw new Error(`computeMinStopFrac: entryPrice must be positive, got ${input.entryPrice}`);
  }

  const tickUnit = tickSizeVnd(input.entryPrice * vndPerUnit, input.board ?? "HOSE") / vndPerUnit;
  const tick = (tickMultiple * tickUnit) / input.entryPrice;

  // ATR is unavailable on short histories. Returning null rather than 0 keeps
  // "not measured" distinct from "measured as no constraint" — a zero here would
  // silently drop the floor that usually binds.
  const volatility =
    input.atr != null && Number.isFinite(input.atr) && input.atr > 0
      ? (atrMultiple * input.atr) / input.entryPrice
      : null;

  const components = { tick, fee: feeFrac, volatility };
  let binding: StopFloor["binding"] = "tick";
  let minStopFrac = tick;
  if (feeFrac > minStopFrac) {
    binding = "fee";
    minStopFrac = feeFrac;
  }
  if (volatility != null && volatility > minStopFrac) {
    binding = "volatility";
    minStopFrac = volatility;
  }

  return { minStopFrac, binding, components };
}

/**
 * Wilder's Average True Range over the last `period` sessions.
 *
 * True range includes the gap from the prior close, so it measures the distance
 * price actually covered rather than the intraday range alone. Uses a simple
 * mean of true ranges: Wilder's smoothing weights recent sessions more heavily,
 * which is preferable for a trading signal but adds a warm-up dependency that a
 * point-in-time floor does not need.
 *
 * `bars` must be ascending and contain only sessions the caller is allowed to
 * see. Returns null when there is not enough history.
 */
export function computeAtr(
  bars: readonly { high: number; low: number; close: number }[],
  period = 14
): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = bars.length - period; i < bars.length; i++) {
    const b = bars[i]!;
    const prevClose = bars[i - 1]!.close;
    trs.push(Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
  }
  const atr = trs.reduce((a, x) => a + x, 0) / trs.length;
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}
