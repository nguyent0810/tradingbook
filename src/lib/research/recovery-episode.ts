/**
 * Recovery episodes as a structural state machine.
 *
 * The previous study segmented episodes as "contiguous runs of RECOVERING
 * state", which produced a median episode of THREE sessions — the index poking
 * above its MA10 for a few days. That is a micro-regime, not a recovery attempt,
 * and it is why that phase came back UNDERPOWERED
 * (docs/trading/replay/FALSE-DAWN-VS-TRUE-RECOVERY.md).
 *
 * Here an episode may only begin after a real deterioration, and it must then
 * show structure turning up:
 *
 *     DOWNTREND         index below MA50, making new lows, MA20 falling
 *        ↓
 *     STABILIZING       lows stop being made, still below MA50
 *        ↓
 *     RECOVERY_ATTEMPT  reclaims MA10 with a higher low  ← this is T0
 *        ↓
 *     CONFIRMED_RECOVERY   holds MA50            |  FAILED_RECOVERY
 *                                                |  undercuts the episode low
 *
 * EVERY constant is an existing repo constant, chosen for that reason rather
 * than searched: `GATE2_RANGE_DAYS` (20) defines "new low", the stabilisation
 * and hold windows come from `FRESH_RECLAIM_SESSIONS` (5) and
 * `GATE2_BREAKOUT_RECENCY_BARS` (10). All transitions are ORDINAL — where the
 * close sits relative to its own averages and prior lows. There is no magnitude
 * threshold anywhere, so there is nothing to tune toward an outcome.
 *
 * POINT-IN-TIME: `segmentEpisodes` walks forward and every transition at index
 * `i` reads only `[0..i]`. The resolution of an episode necessarily reads
 * forward — that is the label, and labels are allowed to. Features never do.
 */

import { rollingMean } from "./leadership-features";

export type RecoveryState =
  | "NONE"
  | "DOWNTREND"
  | "STABILIZING"
  | "RECOVERY_ATTEMPT";

export type EpisodeOutcome = "CONFIRMED_RECOVERY" | "FAILED_RECOVERY" | "UNRESOLVED";

export type RecoveryEpisode = {
  /** Index of the session the recovery attempt began — T0. */
  t0: number;
  /** Index where DOWNTREND began, for context. */
  downtrendStart: number;
  /** Lowest close of the decline that preceded T0. Undercutting it is failure. */
  episodeLow: number;
  /** Index of that low. */
  episodeLowIdx: number;
  outcome: EpisodeOutcome;
  /** Sessions from T0 to resolution. Null when unresolved. */
  resolvedAt: number | null;
  /** How far below its 250-session high the index sat at T0, in percent. */
  drawdownAtT0: number;
};

export type SegmentParams = {
  /** Sessions defining a "new low". Default: GATE2_RANGE_DAYS. */
  newLowLookback: number;
  /** Consecutive sessions without a new low to count as stabilised. */
  stabilizationSessions: number;
  /** Consecutive sessions above MA50 that count as confirmed. */
  holdSessions: number;
  /** Sessions after T0 before an unresolved episode is abandoned. */
  horizonSessions: number;
};

/** True when `closes[i]` is the lowest close of the trailing window. */
function isNewLow(closes: readonly number[], i: number, lookback: number): boolean {
  const start = Math.max(0, i - lookback + 1);
  for (let k = start; k < i; k++) if (closes[k]! <= closes[i]!) return false;
  return true;
}

function minInRange(closes: readonly number[], a: number, b: number): { v: number; i: number } {
  let v = Infinity;
  let idx = a;
  for (let k = a; k <= b; k++) {
    if (closes[k]! < v) {
      v = closes[k]!;
      idx = k;
    }
  }
  return { v, i: idx };
}

/**
 * Walk the index close series and emit every recovery attempt with its outcome.
 *
 * Returns episodes in chronological order. An episode's features are the
 * caller's business; this only supplies T0, the structure that preceded it, and
 * how it resolved.
 */
export function segmentEpisodes(
  closes: readonly number[],
  params: SegmentParams
): RecoveryEpisode[] {
  const { newLowLookback, stabilizationSessions, holdSessions, horizonSessions } = params;
  const ma10 = rollingMean(closes, 10);
  const ma20 = rollingMean(closes, 20);
  const ma50 = rollingMean(closes, 50);

  const episodes: RecoveryEpisode[] = [];
  let state: RecoveryState = "NONE";
  let downtrendStart = -1;
  let sessionsSinceNewLow = 0;

  for (let i = 50; i < closes.length; i++) {
    const c = closes[i]!;
    const a10 = ma10[i];
    const a20 = ma20[i];
    const a50 = ma50[i];
    if (a10 == null || a20 == null || a50 == null) continue;

    const below50 = c < a50;
    const newLow = isNewLow(closes, i, newLowLookback);
    const ma20Falling = ma20[i - 5] != null && a20 < ma20[i - 5]!;

    if (newLow) sessionsSinceNewLow = 0;
    else sessionsSinceNewLow++;

    switch (state) {
      case "NONE":
        // A decline only counts once it is below MA50, printing fresh lows, with
        // the medium average rolling over. One of the three alone is noise.
        if (below50 && newLow && ma20Falling) {
          state = "DOWNTREND";
          downtrendStart = i;
        }
        break;

      case "DOWNTREND":
        if (!below50) {
          // Recovered without ever stabilising below MA50 — not the shape under
          // study, so the machine resets rather than inventing an episode.
          state = "NONE";
        } else if (sessionsSinceNewLow >= stabilizationSessions) {
          state = "STABILIZING";
        }
        break;

      case "STABILIZING": {
        if (newLow) {
          // Broke down again. Still the same decline, so keep the start.
          state = "DOWNTREND";
          break;
        }
        const low = minInRange(closes, downtrendStart, i);
        // The attempt begins when price reclaims its fast average AND the recent
        // low sits above the decline's low — structure turning, not just a bounce.
        const recentLow = minInRange(closes, Math.max(downtrendStart, i - stabilizationSessions + 1), i);
        if (c >= a10 && recentLow.v > low.v) {
          const dd = (() => {
            const start = Math.max(0, i - 249);
            let hi = -Infinity;
            for (let k = start; k <= i; k++) hi = Math.max(hi, closes[k]!);
            return hi > 0 ? ((c - hi) / hi) * 100 : 0;
          })();

          // ---- resolve, reading forward: this is the LABEL, not a feature ----
          let outcome: EpisodeOutcome = "UNRESOLVED";
          let resolvedAt: number | null = null;
          let run = 0;
          const end = Math.min(closes.length - 1, i + horizonSessions);
          for (let k = i + 1; k <= end; k++) {
            if (closes[k]! < low.v) {
              outcome = "FAILED_RECOVERY";
              resolvedAt = k - i;
              break;
            }
            const m50 = ma50[k];
            if (m50 != null && closes[k]! >= m50) {
              run++;
              if (run >= holdSessions) {
                outcome = "CONFIRMED_RECOVERY";
                resolvedAt = k - i;
                break;
              }
            } else {
              run = 0;
            }
          }

          episodes.push({
            t0: i,
            downtrendStart,
            episodeLow: low.v,
            episodeLowIdx: low.i,
            outcome,
            resolvedAt,
            drawdownAtT0: Number(dd.toFixed(2)),
          });
          state = "RECOVERY_ATTEMPT";
        }
        break;
      }

      case "RECOVERY_ATTEMPT": {
        // The episode is recorded; wait for the market to leave this regime
        // before another attempt can be registered, so one decline cannot emit
        // a dozen overlapping episodes.
        const ep = episodes[episodes.length - 1]!;
        if (closes[i]! < ep.episodeLow) {
          state = "DOWNTREND";
          downtrendStart = i;
        } else if (!below50) {
          state = "NONE";
        }
        break;
      }
    }
  }

  return episodes;
}
