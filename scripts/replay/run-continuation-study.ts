/**
 * READ-ONLY: per-setup stock-level features at T, and the excursion race that
 * follows.
 *
 * The design is frozen in docs/trading/replay/CONTINUATION-STUDY-PREREGISTRATION.md,
 * committed before this ran. This script implements that document and nothing
 * else: it does not choose thresholds, does not score, and does not decide.
 *
 * Every feature reads bars at or before T through the point-in-time guard. The
 * excursion race reads bars after T through the outcome channel only.
 *
 *   npx tsx scripts/replay/run-continuation-study.ts --out docs/trading/replay/continuation
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { createPointInTimeGuard, isoDay } from "../../src/lib/replay/point-in-time-guard";
import { resolvePointInTimeUniverse, type SymbolActivityRow, type TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { computeAtr, computeMinStopFrac } from "../../src/lib/scanner/stop-feasibility";
import { RS_LOOKBACK_20, RS_LOOKBACK_50 } from "../../src/lib/scanner/gate2/relative-strength";
import { EXCURSION_HORIZON_SESSIONS } from "../../src/lib/scanner/gate2/forward-returns";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";
import { computeRsInflection, detectUndercutReclaim, rollingMean, type Bars } from "../../src/lib/research/leadership-features";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function lastIdxAtOrBefore(t: readonly number[], x: number): number {
  let lo = 0, hi = t.length - 1, a = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m]! <= x) { a = m; lo = m + 1; } else hi = m - 1; }
  return a;
}
const med = (x: number[]) => (x.length ? [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]! : NaN);

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/continuation";
  console.error(`run-continuation-study → ${describeDatabaseUrl()} (read-only)`);

  const [symbolRows, indexRows, tacticalRows] = await Promise.all([
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }),
    prisma.indexDailyBar.findMany({ where: { symbol: "VNINDEX" }, select: { date: true, open: true, high: true, low: true, close: true, volume: true }, orderBy: { date: "asc" } }),
    prisma.tacticalSymbol.findMany({ select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true } }),
  ]);

  type S = { symbolId: string; symbol: string; bars: Bars; times: number[]; closes: number[]; firstBarDateEver: string | null; alignedIndex: (number | null)[] };
  const syms: S[] = [];
  for (const s of symbolRows) {
    const raw = await prisma.stockDailyBar.findMany({ where: { symbolId: s.id }, select: { date: true, open: true, high: true, low: true, close: true, volume: true }, orderBy: { date: "asc" } });
    const bars = raw as unknown as Bars;
    syms.push({ symbolId: s.id, symbol: s.symbol, bars, times: bars.map((b) => b.date.getTime()), closes: bars.map((b) => b.close), firstBarDateEver: bars.length ? isoDay(bars[0]!.date) : null, alignedIndex: [] });
    if (syms.length % 300 === 0) console.error(`  loaded ${syms.length}/${symbolRows.length}`);
  }
  const idxTimes = indexRows.map((b) => b.date.getTime());
  const idxCloses = indexRows.map((b) => Number(b.close));
  const idxMa50 = rollingMean(idxCloses, 50);
  {
    const byDate = new Map<number, number>();
    idxTimes.forEach((t, i) => byDate.set(t, idxCloses[i]!));
    for (const s of syms) s.alignedIndex = s.times.map((t) => byDate.get(t) ?? null);
  }
  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({ symbol: t.symbol, addedAt: t.addedAt.toISOString(), expiresAt: t.expiresAt.toISOString(), status: String(t.status), activeForScanner: t.activeForScanner }));

  const rows: Record<string, unknown>[] = [];
  let guardViolations = 0;
  let rawCandidates = 0;

  for (let si = 50; si < idxTimes.length; si++) {
    const sessionMs = idxTimes[si]!;
    const sessionKey = isoDay(new Date(sessionMs));
    const guard = createPointInTimeGuard(sessionKey, { throwOnViolation: false });

    const regime = evaluateMarketRegime(
      guard.decisionRows("idx", indexRows.slice(0, si + 1)).map((b) => ({ time: b.date.getTime(), open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close), volume: Number(b.volume) }))
    );
    const indexAboveMa50 = idxMa50[si] != null ? idxCloses[si]! >= idxMa50[si]! : null;

    const lookbackFrom = sessionMs - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;
    const activity: SymbolActivityRow[] = [];
    const ends = new Map<string, number>();
    for (const s of syms) {
      const end = lastIdxAtOrBefore(s.times, sessionMs);
      if (end < 0) { activity.push({ symbolId: s.symbolId, symbol: s.symbol, barsInWindow: 0, lastBarDate: null, firstBarDateEver: s.firstBarDateEver }); continue; }
      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      ends.set(s.symbol, end);
      activity.push({ symbolId: s.symbolId, symbol: s.symbol, barsInWindow: end - start + 1, lastBarDate: isoDay(s.bars[end]!.date), firstBarDateEver: s.firstBarDateEver });
    }
    const universe = resolvePointInTimeUniverse({ sessionDate: sessionKey, activity, tactical });
    const byName = new Map(syms.map((s) => [s.symbol, s]));

    for (const m of universe.members) {
      const s = byName.get(m.symbol);
      const end = ends.get(m.symbol);
      if (!s || end == null || end < 60) continue;
      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      const win = guard.decisionRows(`bars:${m.symbol}`, s.bars.slice(start, end + 1));
      if (!evaluateTradability(win as never, new Date(sessionMs)).passed) continue;

      const ev = evaluateBreakoutPullbackCandidate(win as unknown as Gate2BarInput[], new Date(sessionMs));
      if (ev.quality === "INVALID") continue;
      rawCandidates++;

      const close = s.closes[end]!;
      const atr = computeAtr(s.bars.slice(Math.max(0, end - 40), end + 1));
      const rs = computeRsInflection(s.closes, s.alignedIndex, end, RS_LOOKBACK_20, RS_LOOKBACK_50);
      const ur = detectUndercutReclaim(s.bars, end, GATE2_RANGE_DAYS, 5);

      // ---- family B: pullback geometry, measured from the breakout level ----
      let lowSince = Infinity, breakoutIdx = -1;
      for (let k = end; k > Math.max(0, end - GATE2_RANGE_DAYS * 2); k--) {
        if (s.bars[k]!.high >= ev.breakoutLevel && breakoutIdx < 0) breakoutIdx = k;
      }
      for (let k = breakoutIdx >= 0 ? breakoutIdx : Math.max(0, end - GATE2_RANGE_DAYS); k <= end; k++) lowSince = Math.min(lowSince, s.bars[k]!.low);
      const pullbackDepthPct = Number.isFinite(lowSince) ? ((ev.breakoutLevel - lowSince) / ev.breakoutLevel) * 100 : null;
      const pullbackDepthAtr = pullbackDepthPct != null && atr ? (pullbackDepthPct / 100) * ev.breakoutLevel / atr : null;
      const sessionsSinceBreakout = breakoutIdx >= 0 ? end - breakoutIdx : null;

      // ---- family C: volume during pullback vs prior advance ----
      let pullbackVolumeContraction: number | null = null;
      if (breakoutIdx > 10) {
        const pull = s.bars.slice(breakoutIdx, end + 1).map((b) => b.volume);
        const adv = s.bars.slice(Math.max(0, breakoutIdx - 10), breakoutIdx).map((b) => b.volume);
        const a = med(adv);
        if (pull.length && adv.length && a > 0) pullbackVolumeContraction = med(pull) / a;
      }
      const vol20 = s.bars.slice(Math.max(0, end - 19), end + 1);
      const medTradedValue = med(vol20.map((b) => b.close * b.volume));
      const relVolume = med(s.bars.slice(Math.max(0, end - 20), end).map((b) => b.volume)) > 0
        ? s.bars[end]!.volume / med(s.bars.slice(Math.max(0, end - 20), end).map((b) => b.volume)) : null;

      // ---- family D: entry geometry ----
      const bar = s.bars[end]!;
      const range = bar.high - bar.low;
      const floor = computeMinStopFrac({ entryPrice: close, atr });
      const riskFrac = (close - ev.stopLevel) / close;

      // ---- family E ----
      const rets: number[] = [];
      for (let k = Math.max(1, end - 19); k <= end; k++) rets.push((s.closes[k]! - s.closes[k - 1]!) / s.closes[k - 1]!);
      const mean = rets.reduce((a2, x) => a2 + x, 0) / Math.max(1, rets.length);
      const realizedVol = Math.sqrt(rets.reduce((a2, x) => a2 + (x - mean) ** 2, 0) / Math.max(1, rets.length - 1)) * 100;

      // ---- OUTCOME: the excursion race, outcome channel only ----
      const fut = guard.outcomeRows(`fwd:${m.symbol}`, s.bars.slice(end + 1));
      let outcome: string | null = null, resolveSession: number | null = null;
      let mfePct: number | null = null, maePct: number | null = null, fwd20: number | null = null, entryPrice: number | null = null;
      // Running trajectories, so the lifecycle can be examined session by session
      // rather than only at its endpoint. Each element k is the running extreme
      // THROUGH session k — no future information at any k.
      const mfeAtrPath: number[] = [], maeAtrPath: number[] = [], closePath: number[] = [];
      // First-passage sessions for each cause, independent of which came first.
      let firstUpSession: number | null = null, firstDownSession: number | null = null;
      let firstOwnStopSession: number | null = null;
      if (fut.length >= EXCURSION_HORIZON_SESSIONS + 1 && atr) {
        const entry = fut[0]!.open;
        entryPrice = entry;
        const up = entry + 2.0 * atr, dn = entry - 1.0 * atr;
        const ownStop = ev.stopLevel;
        let hi = -Infinity, lo = Infinity;
        for (let k = 1; k <= EXCURSION_HORIZON_SESSIONS; k++) {
          const b = fut[k]!;
          hi = Math.max(hi, ((b.high - entry) / entry) * 100);
          lo = Math.min(lo, ((b.low - entry) / entry) * 100);
          mfeAtrPath.push(Number((((hi / 100) * entry) / atr).toFixed(4)));
          maeAtrPath.push(Number((((lo / 100) * entry) / atr).toFixed(4)));
          closePath.push(Number((((b.close - entry) / entry) * 100).toFixed(4)));
          if (firstUpSession == null && b.high >= up) firstUpSession = k;
          if (firstDownSession == null && b.low <= dn) firstDownSession = k;
          if (firstOwnStopSession == null && b.low <= ownStop) firstOwnStopSession = k;
          if (outcome == null) {
            const hitUp = b.high >= up, hitDn = b.low <= dn;
            // Both in one bar: the conservative reading is failure, since intrabar
            // order is unknowable from daily data.
            if (hitDn) { outcome = "FAILURE"; resolveSession = k; }
            else if (hitUp) { outcome = "CONTINUATION"; resolveSession = k; }
          }
        }
        if (outcome == null) outcome = "AMBIGUOUS";
        mfePct = hi; maePct = lo;
        fwd20 = ((fut[EXCURSION_HORIZON_SESSIONS]!.close - entry) / entry) * 100;
      }

      rows.push({
        sessionDate: sessionKey, symbol: m.symbol, quality: ev.quality, rankScore: ev.rankScore,
        gate1: regime.level, indexAboveMa50,
        close, entryPrice, atr, atrPct: atr ? (atr / close) * 100 : null,
        breakoutLevel: ev.breakoutLevel, stopLevel: ev.stopLevel,
        // A
        rs20: rs.rs20, rs50: rs.rs50, rs20Delta5: rs.rs20Delta5, consecutiveOutperformDays: rs.consecutiveOutperformDays,
        // B
        pullbackDepthPct, pullbackDepthAtr, sessionsSinceBreakout,
        urPresent: ur.present, higherLowAfterReclaim: ur.higherLowAfterReclaim,
        distFromRecentHighPct: (() => { let h = -Infinity; for (let k = Math.max(0, end - GATE2_RANGE_DAYS + 1); k <= end; k++) h = Math.max(h, s.bars[k]!.high); return ((close - h) / h) * 100; })(),
        // C
        pullbackVolumeContraction, relVolume,
        // D
        extensionPct: ((close - ev.breakoutLevel) / ev.breakoutLevel) * 100,
        distanceToStopPct: riskFrac * 100,
        distanceToStopAtr: atr ? (close - ev.stopLevel) / atr : null,
        closeLocationValue: range > 0 ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : null,
        gapFromPrevClosePct: end > 0 ? ((bar.open - s.closes[end - 1]!) / s.closes[end - 1]!) * 100 : null,
        stopFeasible: riskFrac >= floor.minStopFrac, minStopFrac: floor.minStopFrac, stopFloorBinding: floor.binding,
        // E
        medTradedValue, realizedVol,
        // outcome
        outcome, resolveSession, mfePct, maePct, fwd20,
        mfeAtrPath, maeAtrPath, closePath,
        firstUpSession, firstDownSession, firstOwnStopSession,
        mfeAtr: mfePct != null && atr ? (mfePct / 100) * (entryPrice ?? close) / atr : null,
        maeAtr: maePct != null && atr ? (maePct / 100) * (entryPrice ?? close) / atr : null,
      });
    }
    guardViolations += guard.violations.length;
    if (si % 400 === 0) console.error(`  session ${sessionKey} · raw candidates ${rawCandidates}`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/setups.ndjson`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  console.error(`raw candidate rows: ${rawCandidates}`);
  console.error(`guardViolations=${guardViolations}`);
  if (guardViolations > 0) process.exitCode = 1;
}

main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
