/**
 * The minimum trade model a replay needs, and nothing more.
 *
 * The scanner produces an entry reference and a stop. It does not define an exit,
 * so a replay cannot score anything without adding one. Every choice here is a
 * MEASUREMENT decision, not a strategy change, and each is stated so the baseline
 * can be argued with:
 *
 *   ENTRY — the next session's open, not the signal bar's close. The decision at
 *           T consumes T's close, so T's close is not purchasable; treating it as
 *           an entry would book a fill nobody could have got.
 *   STOP  — `stopLevel` exactly as the scanner emitted it. Not re-derived.
 *   EXIT  — stop first if any session trades through it, otherwise the close of
 *           the 20th session. 20 is the repo's own existing forward horizon
 *           (EXCURSION_HORIZON_SESSIONS), not a number invented here.
 *   R     — (exit - entry) / (entry - stop). Undefined when entry <= stop, which
 *           the scanner should never emit; such signals are excluded and counted.
 *
 * Deliberately absent: slippage, fees, position sizing, T+2 settlement, price
 * bands, partial fills. A baseline that flatters itself on execution is worse
 * than useless, so these omissions are reported alongside the result rather than
 * buried — the numbers are an UPPER BOUND on what live trading would return.
 */

export type TradeBar = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const REPLAY_EXIT_HORIZON_SESSIONS = 20;

export type SimulatedTrade = {
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: "STOP_HIT" | "TIME_EXIT";
  sessionsHeld: number;
  riskPerShare: number;
  rMultiple: number;
  returnPct: number;
  /** Best/worst excursion versus entry, over the held window. */
  mfePct: number;
  maePct: number;
  /** Sessions until the stop was first touched, when it was. */
  sessionsToStop: number | null;
};

export type TradeSimulationOutcome =
  | { ok: true; trade: SimulatedTrade }
  | { ok: false; reason: "no_entry_bar" | "insufficient_forward_bars" | "non_positive_risk" };

/**
 * Simulate one signal.
 *
 * `futureBars` must contain ONLY sessions strictly after the signal session, in
 * ascending order. Passing anything at or before the signal would let the trade
 * be scored on the bar that produced it.
 */
export function simulateTrade(params: {
  futureBars: readonly TradeBar[];
  stopPrice: number;
  horizonSessions?: number;
}): TradeSimulationOutcome {
  const horizon = params.horizonSessions ?? REPLAY_EXIT_HORIZON_SESSIONS;
  const bars = params.futureBars;

  if (bars.length === 0) return { ok: false, reason: "no_entry_bar" };
  // One bar to enter on plus `horizon` bars to hold through.
  if (bars.length < horizon + 1) return { ok: false, reason: "insufficient_forward_bars" };

  const entryBar = bars[0]!;
  const entryPrice = entryBar.open;
  const riskPerShare = entryPrice - params.stopPrice;
  if (!(riskPerShare > 0)) return { ok: false, reason: "non_positive_risk" };

  const held = bars.slice(1, horizon + 1);

  let exitPrice = held[held.length - 1]!.close;
  let exitDate = held[held.length - 1]!.date;
  let exitReason: SimulatedTrade["exitReason"] = "TIME_EXIT";
  let sessionsToStop: number | null = null;
  let sessionsHeld = held.length;

  let mfe = -Infinity;
  let mae = Infinity;

  for (let i = 0; i < held.length; i++) {
    const b = held[i]!;
    mfe = Math.max(mfe, ((b.high - entryPrice) / entryPrice) * 100);
    mae = Math.min(mae, ((b.low - entryPrice) / entryPrice) * 100);

    if (b.low <= params.stopPrice) {
      // Filled at the stop, not at the low. Assuming the low would flatter the
      // result; assuming the open would be worse on gaps. The stop is the
      // honest middle and matches how the scanner states its risk.
      exitPrice = Math.min(params.stopPrice, b.open);
      exitDate = b.date;
      exitReason = "STOP_HIT";
      sessionsToStop = i + 1;
      sessionsHeld = i + 1;
      break;
    }
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    ok: true,
    trade: {
      entryDate: iso(entryBar.date),
      entryPrice,
      stopPrice: params.stopPrice,
      exitDate: iso(exitDate),
      exitPrice,
      exitReason,
      sessionsHeld,
      riskPerShare,
      rMultiple: (exitPrice - entryPrice) / riskPerShare,
      returnPct: ((exitPrice - entryPrice) / entryPrice) * 100,
      mfePct: mfe === -Infinity ? 0 : mfe,
      maePct: mae === Infinity ? 0 : mae,
      sessionsToStop,
    },
  };
}
