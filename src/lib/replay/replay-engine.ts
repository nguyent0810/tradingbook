/**
 * Walk-forward replay of the production scanner.
 *
 * Every decision runs through the SAME functions production uses —
 * `evaluateMarketRegime`, `evaluateTradability`, `evaluateBreakoutPullbackCandidate`,
 * `filterCandidatesByGate1Level`. Nothing is reimplemented here, because a replay
 * that reimplements the strategy measures the reimplementation.
 *
 * The engine's only job is to hand those functions a correct point-in-time view:
 *
 *   - the universe as of T (bar evidence, not today's `active` flag)
 *   - bars bounded at T for every decision read, enforced by the guard
 *   - bars after T reachable only through the outcome channel, for scoring
 *
 * `evaluateTradability` in particular is not self-protecting: it takes the last
 * 20 bars of whatever it is handed. Slicing correctly is this module's
 * responsibility, and the guard is what makes a slip loud.
 */
import { evaluateMarketRegime } from "@/lib/playbook/gate1-market";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2";
import { deriveGate1SurfacingRule } from "@/lib/scanner/gate2/collect-candidates";
import { evaluateTradability } from "@/lib/scanner/tradability";
import { computeAtr, computeMinStopFrac } from "@/lib/scanner/stop-feasibility";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "@/lib/scanner/tradability-constants";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { createPointInTimeGuard, isoDay } from "./point-in-time-guard";
import {
  resolvePointInTimeUniverse,
  type SymbolActivityRow,
  type TacticalWindowRow,
} from "./point-in-time-universe";
import { simulateTrade, REPLAY_EXIT_HORIZON_SESSIONS, type TradeBar } from "./trade-model";
import type { ReplaySignal } from "./replay-metrics";

export type SymbolSeries = {
  symbolId: string;
  symbol: string;
  /** Ascending, de-duplicated by date. Sorted ONCE by the caller. */
  bars: TradeBar[];
};

export type ReplayProgress = (done: number, total: number, signals: number) => void;

/**
 * Per-session diagnostic record. Emitted for every evaluated session, whether or
 * not anything surfaced.
 *
 * Exists because the signals dump can only describe setups that SURVIVED Gate 1
 * and Gate 2. "Did setups stop forming, or stop being surfaced, or stop working?"
 * are three different questions, and the signals alone cannot tell them apart.
 */
export type SessionDiagnostic = {
  sessionDate: string;
  gate1Level: "PASS" | "WARNING" | "FAIL";
  trend: string | null;
  momentum: string | null;
  indexExtensionPct: number | null;
  indexUpStreak: number;
  indexAtrPct: number | null;
  universe: number;
  tradable: number;
  /** Counts of Gate 2 terminal rejection codes across the tradable universe. */
  rejections: Record<string, number>;
  /** Every VALID Gate 2 candidate, before Gate 1 surfacing filters any of them. */
  candidates: Array<{
    symbol: string;
    quality: "A" | "B";
    rankScore: number;
    close: number;
    breakoutLevel: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
    atr: number | null;
  }>;
};

export type ReplayOptions = {
  /** Skip sessions before this date (warm-up for MA50 etc.). */
  minSessionDate?: string;
  maxSessionDate?: string;
  /** Emit progress every N sessions. */
  progressEvery?: number;
  /**
   * Apply the executable stop floor (tick / fee / volatility) on top of Gate 2's
   * own `GATE2_MIN_RISK_TO_STOP_FRAC`.
   *
   * Off by default so the baseline stays reproducible. Enabling it does not
   * change any scanner constant or move any stop — it only drops candidates
   * whose entry-to-stop distance is too small to be executed as stated, which is
   * the v1-vs-v2 comparison. Rejections are counted rather than discarded, so
   * "how many setups does this remove" is answerable from the result.
   */
  applyExecutableStopFloor?: boolean;
  /**
   * Override the ATR multiple in the stop floor. For predeclared sensitivity
   * runs only — the shipped constant is 1.0 and is pinned by a test. Exposing it
   * here keeps a sensitivity sweep from being done by editing the constant,
   * which is how a "sensitivity check" quietly becomes a fit.
   */
  stopFloorAtrMultiple?: number;
};

export type ReplayRunResult = {
  signals: ReplaySignal[];
  sessionsEvaluated: number;
  universeSizeBySession: Array<{ sessionDate: string; universe: number; tradable: number }>;
  guardViolations: number;
  /**
   * Valid Gate 2 setups dropped because their stop was too tight to execute.
   * Always present; zero when the floor is off. Counting rather than silently
   * filtering is what makes "what did v2 cost" answerable.
   */
  stopFloorRejections: number;
  stopFloorRejectionsByBinding: { tick: number; fee: number; volatility: number };
};

function assertAscending(bars: readonly { date: Date }[], label: string): void {
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1]!.date.getTime() > bars[i]!.date.getTime()) {
      throw new Error(
        `${label} is not ascending at index ${i} (${bars[i - 1]!.date.toISOString()} > ` +
          `${bars[i]!.date.toISOString()}). The replay's point-in-time slicing depends on order.`
      );
    }
  }
}

/** Binary search for the last index with date <= target. -1 when none. */
function lastIndexAtOrBefore(bars: readonly { date: Date }[], targetMs: number): number {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.date.getTime() <= targetMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function toGate2Bars(bars: readonly TradeBar[]): Gate2BarInput[] {
  return bars as unknown as Gate2BarInput[];
}

export function runReplay(params: {
  series: readonly SymbolSeries[];
  /** VNINDEX bars, ascending. Drives both the session calendar and Gate 1. */
  indexBars: readonly TradeBar[];
  tactical: readonly TacticalWindowRow[];
  options?: ReplayOptions;
  onProgress?: ReplayProgress;
  /** Diagnostics sink. Never consulted by any decision. */
  onSession?: (d: SessionDiagnostic) => void;
}): ReplayRunResult {
  const opts = params.options ?? {};

  // The binary search below is silently wrong on unsorted input — it would
  // return an arbitrary index and the "bars through T" slice would contain
  // future bars without the guard necessarily catching every one. Checked once
  // here rather than trusted.
  assertAscending(params.indexBars, "indexBars");
  for (const s of params.series) assertAscending(s.bars, `series:${s.symbol}`);

  const signals: ReplaySignal[] = [];
  const universeSizeBySession: ReplayRunResult["universeSizeBySession"] = [];
  let guardViolations = 0;

  // Precompute per-symbol first/last bar dates once; recomputing them per session
  // would dominate the run.
  const seriesMeta = params.series.map((s) => ({
    ...s,
    firstBarDateEver: s.bars.length ? isoDay(s.bars[0]!.date) : null,
  }));

  const sessions = params.indexBars
    .map((b) => b.date)
    .filter((d) => {
      const k = isoDay(d);
      if (opts.minSessionDate && k < opts.minSessionDate) return false;
      if (opts.maxSessionDate && k > opts.maxSessionDate) return false;
      return true;
    });

  const progressEvery = opts.progressEvery ?? 100;
  const applyStopFloor = opts.applyExecutableStopFloor ?? false;
  let stopFloorRejections = 0;
  const stopFloorRejectionsByBinding = { tick: 0, fee: 0, volatility: 0 };

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si]!;
    const sessionKey = isoDay(session);
    const sessionMs = session.getTime();
    const guard = createPointInTimeGuard(sessionKey, { throwOnViolation: false });

    // ---- Gate 1: market regime from index bars through T only ----
    const idxEnd = lastIndexAtOrBefore(params.indexBars, sessionMs);
    if (idxEnd < 49) continue; // MA50 warm-up
    const regimeBars = guard.decisionRows("gate1IndexBars", params.indexBars.slice(0, idxEnd + 1));
    // Gate 1 takes epoch-ms bars; the guard works in Date, so convert only here.
    const regime = evaluateMarketRegime(
      regimeBars.map((b) => ({
        time: b.date.getTime(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }))
    );
    const gate1Level = regime.level as "PASS" | "WARNING" | "FAIL";

    // Gate 1 diagnostics. Derived from the SAME bars the gate saw, so they
    // describe the decision rather than a reconstruction of it.
    const idxCloses = regimeBars.map((b) => b.close);
    const lastIdxClose = idxCloses[idxCloses.length - 1]!;
    const ma50 =
      idxCloses.slice(-50).reduce((a, x) => a + x, 0) / Math.min(50, idxCloses.length);
    let indexUpStreak = 0;
    for (let k = idxCloses.length - 1; k > 0; k--) {
      if (idxCloses[k]! > idxCloses[k - 1]!) indexUpStreak++;
      else break;
    }
    // Outcome channel: the index's own forward move, over the trade horizon.
    const idxFuture = guard.outcomeRows(
      "forward:VNINDEX",
      params.indexBars.slice(idxEnd + 1)
    );
    const idxFwdBar = idxFuture[REPLAY_EXIT_HORIZON_SESSIONS - 1];
    const gate1Diagnostics = {
      trend: regime.trend ?? null,
      momentum: regime.momentum ?? null,
      indexExtensionPct: ma50 > 0 ? ((lastIdxClose - ma50) / ma50) * 100 : null,
      indexUpStreak,
      indexFwdPct: idxFwdBar ? ((idxFwdBar.close - lastIdxClose) / lastIdxClose) * 100 : null,
    };

    // ---- Universe as of T ----
    const lookbackFrom = sessionMs - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;
    const activity: SymbolActivityRow[] = [];
    const slices = new Map<string, TradeBar[]>();

    for (const s of seriesMeta) {
      const end = lastIndexAtOrBefore(s.bars, sessionMs);
      if (end < 0) {
        activity.push({
          symbolId: s.symbolId,
          symbol: s.symbol,
          barsInWindow: 0,
          lastBarDate: null,
          firstBarDateEver: s.firstBarDateEver,
        });
        continue;
      }
      const start = lastIndexAtOrBefore(s.bars, lookbackFrom) + 1;
      const window = s.bars.slice(start, end + 1);
      slices.set(s.symbol, window);
      activity.push({
        symbolId: s.symbolId,
        symbol: s.symbol,
        barsInWindow: window.length,
        lastBarDate: isoDay(s.bars[end]!.date),
        firstBarDateEver: s.firstBarDateEver,
      });
    }

    const universe = resolvePointInTimeUniverse({
      sessionDate: sessionKey,
      activity,
      tactical: params.tactical,
    });

    // ---- Tradability then Gate 2, both on the bounded window ----
    const candidates: Array<{
      symbol: string;
      quality: "A" | "B";
      rankScore: number;
      stopLevel: number;
      /** ATR as of T, so the floor can be recomputed against the entry price. */
      atrAtDecision: number | null;
    }> = [];
    let tradableCount = 0;
    const rejections: Record<string, number> = {};
    const candidateDiagnostics: SessionDiagnostic["candidates"] = [];

    for (const member of universe.members) {
      const window = slices.get(member.symbol);
      if (!window || window.length === 0) continue;
      const bounded = guard.decisionRows(`bars:${member.symbol}`, window);

      const trad = evaluateTradability(bounded, session);
      if (!trad.passed) continue;
      tradableCount++;

      const ev = evaluateBreakoutPullbackCandidate(toGate2Bars(bounded), session);
      if (ev.quality === "INVALID") {
        if (params.onSession) {
          const code = ev.terminalCode ?? "unspecified";
          rejections[code] = (rejections[code] ?? 0) + 1;
        }
        continue;
      }
      if (params.onSession) {
        candidateDiagnostics.push({
          symbol: member.symbol,
          quality: ev.quality,
          rankScore: ev.rankScore,
          close: ev.close,
          breakoutLevel: ev.breakoutLevel,
          pullbackZoneLow: ev.pullbackZoneLow,
          pullbackZoneHigh: ev.pullbackZoneHigh,
          stopLevel: ev.stopLevel,
          atr: computeAtr(bounded),
        });
      }

      let atrAtDecision: number | null = null;
      if (applyStopFloor) {
        // ATR from the SAME decision-channel window Gate 2 just used, so the
        // floor cannot see anything the setup could not.
        const entryRef = bounded[bounded.length - 1]!.close;
        const atr = computeAtr(bounded);
        const floor = computeMinStopFrac({
          entryPrice: entryRef,
          atr,
          atrMultiple: opts.stopFloorAtrMultiple,
        });
        const riskFrac = (entryRef - ev.stopLevel) / entryRef;
        if (riskFrac < floor.minStopFrac) {
          stopFloorRejections++;
          stopFloorRejectionsByBinding[floor.binding]++;
          continue;
        }
        atrAtDecision = atr;
      }

      candidates.push({
        symbol: member.symbol,
        quality: ev.quality,
        rankScore: ev.rankScore,
        stopLevel: ev.stopLevel,
        atrAtDecision,
      });
    }

    universeSizeBySession.push({
      sessionDate: sessionKey,
      universe: universe.members.length,
      tradable: tradableCount,
    });

    params.onSession?.({
      sessionDate: sessionKey,
      gate1Level,
      trend: gate1Diagnostics.trend,
      momentum: gate1Diagnostics.momentum,
      indexExtensionPct: gate1Diagnostics.indexExtensionPct,
      indexUpStreak: gate1Diagnostics.indexUpStreak,
      indexAtrPct: (() => {
        const a = computeAtr(regimeBars);
        return a != null && lastIdxClose > 0 ? (a / lastIdxClose) * 100 : null;
      })(),
      universe: universe.members.length,
      tradable: tradableCount,
      rejections,
      candidates: candidateDiagnostics,
    });

    // ---- Gate 1 surfacing rule, from production's single source of truth ----
    const rule = deriveGate1SurfacingRule(gate1Level);
    const kept =
      rule === "none" ? [] : rule === "tier-a-only" ? candidates.filter((c) => c.quality === "A") : candidates;

    if (kept.length === 0) {
      guardViolations += guard.violations.length;
      if ((si + 1) % progressEvery === 0) {
        params.onProgress?.(si + 1, sessions.length, signals.length);
      }
      continue;
    }

    // ---- Outcome channel: score each surfaced signal on bars AFTER T ----
    for (const c of kept) {
      const s = seriesMeta.find((x) => x.symbol === c.symbol)!;
      const end = lastIndexAtOrBefore(s.bars, sessionMs);
      const future = guard.outcomeRows(`forward:${c.symbol}`, s.bars.slice(end + 1));

      // Re-derive the floor against the price actually paid. ATR is fixed as of
      // T (tomorrow's range is unknowable), but the entry price is not the close
      // the floor was first measured against, and a gap moves every ratio that
      // depends on it.
      const entryOpen = future[0]?.open;
      const minRiskFrac =
        applyStopFloor && entryOpen != null && entryOpen > 0
          ? computeMinStopFrac({
              entryPrice: entryOpen,
              atr: c.atrAtDecision,
              atrMultiple: opts.stopFloorAtrMultiple,
            }).minStopFrac
          : undefined;

      const sim = simulateTrade({
        futureBars: future as readonly TradeBar[],
        stopPrice: c.stopLevel,
        horizonSessions: REPLAY_EXIT_HORIZON_SESSIONS,
        minRiskFrac,
      });

      signals.push({
        symbol: c.symbol,
        sessionDate: sessionKey,
        quality: c.quality,
        gate1Level,
        rankScore: c.rankScore,
        trade: sim.ok ? sim.trade : null,
        unscoredReason: sim.ok ? null : sim.reason,
        gate1: gate1Diagnostics,
      });
    }

    guardViolations += guard.violations.length;
    if ((si + 1) % progressEvery === 0) {
      params.onProgress?.(si + 1, sessions.length, signals.length);
    }
  }

  return {
    signals,
    sessionsEvaluated: universeSizeBySession.length,
    universeSizeBySession,
    guardViolations,
    stopFloorRejections,
    stopFloorRejectionsByBinding,
  };
}
