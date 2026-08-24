/**
 * Outcome computation — `outcomes@1.0.0`, frozen in the plan before any
 * prospective observation existed.
 *
 * The window is T+5 for MFE, MAE and stop-first, matching the primary endpoint.
 * The previous phase's review flagged a 20-session MFE/MAE window against a T+5
 * primary as a mismatch; it is corrected here rather than carried forward.
 *
 * This function is pure and takes ONLY bars dated after the decision session. It
 * has no database access and no way to reach a bar at or before T, so a
 * look-ahead here is not a discipline question.
 *
 * SHADOW ONLY. No production module imports this.
 */
import { OUTCOME_HORIZON_SESSIONS, OUTCOME_VERSION, type OutcomeCandidate } from "./registry-schema";

export type FutureBar = {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
};

export type OutcomeComputation =
  | { readonly ready: false; readonly reason: "NOT_ENOUGH_SETTLED_BARS"; readonly have: number; readonly need: number }
  | { readonly ready: false; readonly reason: "BAR_AT_OR_BEFORE_DECISION"; readonly have: number; readonly need: number }
  | { readonly ready: true; readonly entry: Omit<OutcomeCandidate, "outcomeRecordedAt"> };

/**
 * @param futureBars bars strictly after the decision session, ascending. The
 *   caller is responsible for the filter; `verifyRegistry` re-checks it against
 *   the recorded `barDatesUsed`, so a caller mistake is caught, not trusted.
 */
export function computeOutcome(params: {
  readonly setupId: string;
  /** The decision session. Any bar dated at or before it is refused, not skipped. */
  readonly session: string;
  readonly riskFrac: number | null;
  readonly futureBars: readonly FutureBar[];
}): OutcomeComputation {
  // A caller-side date filter is not enough on its own: `date > new Date("2026-09-01")`
  // in SQL compares against midnight UTC, so a same-session bar stored at 07:00Z
  // passes it. Refusing here turns that from something the verifier notices after
  // the write into something that never gets written.
  if (params.futureBars.some((b) => b.date <= params.session)) {
    return {
      ready: false,
      reason: "BAR_AT_OR_BEFORE_DECISION",
      have: params.futureBars.filter((b) => b.date <= params.session).length,
      need: 0,
    };
  }

  // T+1 IS the entry bar: entry is its open and `fwd1` is its close. An extra bar
  // here would silently shift every horizon by one session and make these numbers
  // incomparable with every prior phase, which used the same convention.
  const need = OUTCOME_HORIZON_SESSIONS;
  const bars = params.futureBars.slice(0, need);
  if (bars.length < need) {
    return { ready: false, reason: "NOT_ENOUGH_SETTLED_BARS", have: bars.length, need };
  }

  // Entry is the OPEN of the first settled session after the decision — the first
  // price actually obtainable by someone acting on the decision.
  const entry = bars[0]!.open;
  if (!(entry > 0)) {
    return {
      ready: true,
      entry: {
        setupId: params.setupId, outcomeVersion: OUTCOME_VERSION, entryOpenKVnd: entry,
        fwd1: null, fwd3: null, fwd5: null, win5: null, mfe5: null, mae5: null, stopFirst: null,
        barDatesUsed: bars.map((b) => b.date),
      },
    };
  }

  const fwd = (k: number) => (bars[k - 1] ? bars[k - 1]!.close / entry - 1 : null);
  const window = bars; // T+1 .. T+5 inclusive
  const mfe5 = Math.max(...window.map((b) => b.high)) / entry - 1;
  const mae5 = Math.min(...window.map((b) => b.low)) / entry - 1;

  let stopFirst: boolean | null = null;
  if (params.riskFrac != null && params.riskFrac > 0) {
    const stopPx = entry * (1 - params.riskFrac);
    const targetPx = entry * (1 + 2 * params.riskFrac);
    let hitStop = -1, hitTarget = -1;
    for (let k = 0; k < window.length; k++) {
      if (hitStop < 0 && window[k]!.low <= stopPx) hitStop = k;
      if (hitTarget < 0 && window[k]!.high >= targetPx) hitTarget = k;
    }
    // Same-bar ambiguity resolves against the trade, as in every prior phase.
    stopFirst = hitStop >= 0 && (hitTarget < 0 || hitStop <= hitTarget);
  }

  const fwd5 = fwd(5);
  return {
    ready: true,
    entry: {
      setupId: params.setupId,
      outcomeVersion: OUTCOME_VERSION,
      entryOpenKVnd: entry,
      fwd1: fwd(1), fwd3: fwd(3), fwd5,
      win5: fwd5 == null ? null : fwd5 > 0,
      mfe5, mae5, stopFirst,
      barDatesUsed: bars.map((b) => b.date),
    },
  };
}
