/**
 * READ-ONLY cross-sectional study: does early leadership exist while the index
 * is still weak, and would spotting it buy a better entry than waiting?
 *
 * Scans the ENTIRE point-in-time universe every session. No symbol is chosen in
 * advance — picking FPT/FRT and measuring them would be hindsight, so they are
 * only inspected afterwards, from whatever the universe-wide scan produced.
 *
 * Nothing here decides a trade. Features are instrumentation; cohort membership
 * uses within-session quantiles rather than fixed levels, so no threshold can be
 * fitted to an outcome. Outcomes are read exclusively through the outcome
 * channel, and every feature is computed from bars at or before T.
 *
 *   npx tsx scripts/replay/run-early-leadership-study.ts --out docs/trading/replay/leadership
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { createPointInTimeGuard, isoDay } from "../../src/lib/replay/point-in-time-guard";
import { resolvePointInTimeUniverse, type SymbolActivityRow, type TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { computeAtr } from "../../src/lib/scanner/stop-feasibility";
import { RS_LOOKBACK_20, RS_LOOKBACK_50 } from "../../src/lib/scanner/gate2/relative-strength";
import { FORWARD_RETURN_HORIZONS, EXCURSION_HORIZON_SESSIONS } from "../../src/lib/scanner/gate2/forward-returns";
import { GATE2_RANGE_DAYS, GATE2_STOP_BUFFER_FRAC } from "../../src/lib/scanner/gate2/constants";
import {
  computeAbsorptionProxy,
  computeRsInflection,
  computeStructureRecovery,
  detectUndercutReclaim,
  rollingMean,
  type Bars,
} from "../../src/lib/research/leadership-features";
import { classifyMarketState, computeBreadth, marketPhase, FRESH_RECLAIM_SESSIONS } from "../../src/lib/research/market-state";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lastIdxAtOrBefore(times: readonly number[], t: number): number {
  let lo = 0, hi = times.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function yearHigh(c: readonly number[], end: number): number {
  let m = -Infinity;
  for (let k = end - 249; k <= end; k++) m = Math.max(m, c[k]!);
  return m;
}
function yearLow(c: readonly number[], end: number): number {
  let m = Infinity;
  for (let k = end - 249; k <= end; k++) m = Math.min(m, c[k]!);
  return m;
}

function quantile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]!;
}

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/leadership";
  console.error(`run-early-leadership-study → ${describeDatabaseUrl()} (read-only)`);

  const [symbolRows, indexRows, tacticalRows] = await Promise.all([
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }),
    prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    }),
    prisma.tacticalSymbol.findMany({
      select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
    }),
  ]);

  type Sym = {
    symbolId: string; symbol: string; bars: Bars; times: number[]; closes: number[];
    ma10: (number | null)[]; ma20: (number | null)[]; ma50: (number | null)[];
    firstBarDateEver: string | null;
    /**
     * Index close on the SAME calendar date as each of this symbol's bars.
     * Date-to-date alignment does not depend on the evaluation session, so it is
     * built once at load. Rebuilding it per session was the difference between
     * this study running and not running.
     */
    alignedIndex: (number | null)[];
  };
  const syms: Sym[] = [];
  for (const s of symbolRows) {
    const raw = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    });
    const bars = raw as unknown as Bars;
    const closes = bars.map((b) => b.close);
    syms.push({
      symbolId: s.id, symbol: s.symbol, bars, times: bars.map((b) => b.date.getTime()), closes,
      ma10: rollingMean(closes, 10), ma20: rollingMean(closes, 20), ma50: rollingMean(closes, 50),
      firstBarDateEver: bars.length ? isoDay(bars[0]!.date) : null,
      alignedIndex: [],
    });
    if (syms.length % 300 === 0) console.error(`  loaded ${syms.length}/${symbolRows.length}`);
  }
  console.error(`loaded ${syms.reduce((a, s) => a + s.bars.length, 0)} bars`);

  const symByName = new Map(syms.map((s) => [s.symbol, s]));

  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol, addedAt: t.addedAt.toISOString(), expiresAt: t.expiresAt.toISOString(),
    status: String(t.status), activeForScanner: t.activeForScanner,
  }));

  // Index series, and where it stands versus its own averages.
  const idxTimes = indexRows.map((b) => b.date.getTime());
  const idxCloses = indexRows.map((b) => Number(b.close));
  const idxMa10 = rollingMean(idxCloses, 10);
  const idxMa20 = rollingMean(idxCloses, 20);
  const idxMa50 = rollingMean(idxCloses, 50);

  {
    const byDate = new Map<number, number>();
    for (let i = 0; i < idxTimes.length; i++) byDate.set(idxTimes[i]!, idxCloses[i]!);
    for (const s of syms) s.alignedIndex = s.times.map((t) => byDate.get(t) ?? null);
  }

  const observations: string[] = [];
  const sessionRows: string[] = [];
  let guardViolations = 0;
  let evaluated = 0;

  for (let si = 50; si < idxTimes.length; si++) {
    const sessionMs = idxTimes[si]!;
    const sessionKey = isoDay(new Date(sessionMs));
    const guard = createPointInTimeGuard(sessionKey, { throwOnViolation: false });

    // ---- Market state, from index bars through T only ----
    const idxDecision = guard.decisionRows("indexBars", indexRows.slice(0, si + 1));
    void idxDecision;
    const c = idxCloses[si]!;
    const ma50Here = idxMa50[si] ?? null;
    let sinceReclaim: number | null = null;
    if (ma50Here != null && c >= ma50Here) {
      for (let k = si; k > 0; k--) {
        const m = idxMa50[k - 1];
        if (m != null && idxCloses[k - 1]! < m) { sinceReclaim = si - k + 1; break; }
      }
    }
    let recentNewLow = false;
    for (let k = Math.max(0, si - FRESH_RECLAIM_SESSIONS + 1); k <= si; k++) {
      const w = idxCloses.slice(Math.max(0, k - GATE2_RANGE_DAYS), k + 1);
      if (w.length && idxCloses[k] === Math.min(...w)) { recentNewLow = true; break; }
    }
    const state = classifyMarketState({
      close: c, ma10: idxMa10[si] ?? null, ma20: idxMa20[si] ?? null, ma50: ma50Here,
      sessionsSinceMa50Reclaim: sinceReclaim,
      ma20Falling: idxMa20[si] != null && idxMa20[si - 5] != null && idxMa20[si]! < idxMa20[si - 5]!,
      madeRecentNewLow: recentNewLow,
    });
    if (!state) continue;

    // Gate 1's own verdict, for the confirmation-lag comparison. Unchanged.
    const regime = evaluateMarketRegime(
      indexRows.slice(0, si + 1).map((b) => ({
        time: b.date.getTime(), open: Number(b.open), high: Number(b.high),
        low: Number(b.low), close: Number(b.close), volume: Number(b.volume),
      }))
    );

    // ---- Point-in-time universe ----
    const lookbackFrom = sessionMs - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;
    const activity: SymbolActivityRow[] = [];
    const ends = new Map<string, number>();
    for (const s of syms) {
      const end = lastIdxAtOrBefore(s.times, sessionMs);
      if (end < 0) {
        activity.push({ symbolId: s.symbolId, symbol: s.symbol, barsInWindow: 0, lastBarDate: null, firstBarDateEver: s.firstBarDateEver });
        continue;
      }
      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      ends.set(s.symbol, end);
      activity.push({
        symbolId: s.symbolId, symbol: s.symbol, barsInWindow: end - start + 1,
        lastBarDate: isoDay(s.bars[end]!.date), firstBarDateEver: s.firstBarDateEver,
      });
    }
    const universe = resolvePointInTimeUniverse({ sessionDate: sessionKey, activity, tactical });

    // ---- Per-symbol features ----
    type Obs = Record<string, unknown> & { rs20Delta5: number | null };
    const obs: Obs[] = [];
    const breadthRows: Parameters<typeof computeBreadth>[0][number][] = [];

    for (const m of universe.members) {
      const s = symByName.get(m.symbol);
      if (!s) continue;
      const end = ends.get(m.symbol);
      if (end == null || end < 60) continue;

      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      const window = guard.decisionRows(`bars:${m.symbol}`, s.bars.slice(start, end + 1));
      const trad = evaluateTradability(window as never, new Date(sessionMs));

      const rs = computeRsInflection(s.closes, s.alignedIndex, end, RS_LOOKBACK_20, RS_LOOKBACK_50);
      const atr = computeAtr(s.bars.slice(Math.max(0, end - 40), end + 1));
      const struct = computeStructureRecovery(s.bars, end, s.ma10, s.ma20, s.ma50, GATE2_RANGE_DAYS, GATE2_STOP_BUFFER_FRAC, atr);
      const ur = detectUndercutReclaim(s.bars, end, GATE2_RANGE_DAYS, FRESH_RECLAIM_SESSIONS);
      const abs = computeAbsorptionProxy(s.bars, end, RS_LOOKBACK_20, ur.present ? end - (ur.sessionsHoldingReclaim ?? 0) : null);

      const yr = end >= 250;
      breadthRows.push({
        aboveMa10: struct.aboveMa10, aboveMa20: struct.aboveMa20, aboveMa50: struct.aboveMa50,
        up20d: end >= 20 && s.closes[end]! > s.closes[end - 20]!,
        newHigh52w: yr ? s.closes[end]! >= yearHigh(s.closes, end) : null,
        newLow52w: yr ? s.closes[end]! <= yearLow(s.closes, end) : null,
        structureImproving: struct.aboveMa10 && struct.ma10Rising,
        rsImproving: rs.rs20Delta5 != null && rs.rs20Delta5 > 0,
      });

      if (!trad.passed) continue;

      // ---- Outcomes, exclusively through the outcome channel ----
      const future = guard.outcomeRows(`forward:${m.symbol}`, s.bars.slice(end + 1));
      const fwd: Record<string, number | null> = {};
      for (const h of FORWARD_RETURN_HORIZONS) {
        const b = future[h - 1];
        fwd[`fwd${h}`] = b ? ((b.close - s.closes[end]!) / s.closes[end]!) * 100 : null;
      }
      let mfe: number | null = null, mae: number | null = null, stopped: boolean | null = null;
      if (future.length >= EXCURSION_HORIZON_SESSIONS) {
        const entry = s.closes[end]!;
        let hi = -Infinity, lo = Infinity, hit = false;
        for (let k = 0; k < EXCURSION_HORIZON_SESSIONS; k++) {
          const b = future[k]!;
          hi = Math.max(hi, ((b.high - entry) / entry) * 100);
          lo = Math.min(lo, ((b.low - entry) / entry) * 100);
          if (struct.structuralStop != null && b.low <= struct.structuralStop) { hit = true; break; }
        }
        mfe = hi; mae = lo; stopped = hit;
      }

      obs.push({
        sessionDate: sessionKey, symbol: m.symbol, marketState: state, phase: marketPhase(state),
        gate1Level: regime.level, close: s.closes[end]!, atrPct: atr ? (atr / s.closes[end]!) * 100 : null,
        rs20: rs.rs20, rs50: rs.rs50, rs20Delta5: rs.rs20Delta5,
        consecutiveOutperformDays: rs.consecutiveOutperformDays,
        earlyRsImproving: rs.earlyRsImproving, alreadyExtendedRs: rs.alreadyExtendedRs,
        urPresent: ur.present, undercutPct: ur.undercutPct, sessionsBelowSupport: ur.sessionsBelowSupport,
        reclaimPct: ur.reclaimPct, sessionsHoldingReclaim: ur.sessionsHoldingReclaim,
        higherLowAfterReclaim: ur.higherLowAfterReclaim,
        lowerWickRatio: abs.lowerWickRatio, closeLocationValue: abs.closeLocationValue,
        reclaimRelVolume: abs.reclaimRelVolume, baseVolumeContraction: abs.baseVolumeContraction,
        noFollowThroughSessions: abs.sessionsWithoutDownsideFollowThrough,
        aboveMa10: struct.aboveMa10, aboveMa20: struct.aboveMa20, ma10Rising: struct.ma10Rising,
        freshMa10Reclaim: struct.freshMa10Reclaim, higherLow: struct.higherLow, higherHigh: struct.higherHigh,
        distanceToStopPct: struct.distanceToStopPct, distanceToStopAtr: struct.distanceToStopAtr,
        ...fwd, mfe20: mfe, mae20: mae, stopped20: stopped,
      });
    }

    // Within-session RS-slope quantiles: cohort membership is relative to the
    // day's own cross-section, so no fixed level is ever fitted.
    const slopes = obs.map((o) => o.rs20Delta5).filter((x): x is number => x != null).sort((a, b) => a - b);
    const q80 = quantile(slopes, 0.8);
    for (const o of obs) {
      o.rsSlopeTopQuintile = o.rs20Delta5 != null && slopes.length >= 10 && o.rs20Delta5 >= q80;
      observations.push(JSON.stringify(o));
    }

    const breadth = computeBreadth(breadthRows);
    sessionRows.push(JSON.stringify({
      sessionDate: sessionKey, marketState: state, phase: marketPhase(state), gate1Level: regime.level,
      indexClose: c, indexMa50: ma50Here, universe: universe.members.length, observed: obs.length, breadth,
    }));

    guardViolations += guard.violations.length;
    evaluated++;
    if (evaluated % 200 === 0) console.error(`  session ${evaluated} (${sessionKey}) · obs ${observations.length}`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/observations.ndjson`, observations.join("\n") + "\n", "utf8");
  writeFileSync(`${outDir}/sessions.ndjson`, sessionRows.join("\n") + "\n", "utf8");
  console.error(`wrote ${observations.length} observations over ${evaluated} sessions`);
  console.error(`guardViolations=${guardViolations}`);
  if (guardViolations > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("run-early-leadership-study FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
