/**
 * Post-backfill diagnostic §1 — rebuild the setup population and the M1 shadow
 * reconciliation FROM RAW BARS. Nothing cached is read.
 *
 * The backfill rewrote 41,026 rows back to 2024-04-04, so every prior artifact
 * was computed on bars that no longer exist in that form. This re-scans with the
 * production Gate 1 and Gate 2 evaluators and re-derives every D0-D5 input.
 *
 * Forward returns are OUTCOME LABELS ONLY and are read exclusively from bars
 * after T. No decision input touches them.
 *
 *   npx tsx scripts/replay/run-post-backfill-rebuild.ts
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "../../src/lib/scanner/gate2/breakout-pullback";
import { computeAtr } from "../../src/lib/scanner/stop-feasibility";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { resolvePointInTimeUniverse, type SymbolActivityRow, type TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";
import { createPointInTimeGuard, isoDay } from "../../src/lib/replay/point-in-time-guard";
import { runShadowSafely, type ShadowCandidateInput } from "../../src/lib/decisions/run-shadow";
import { decideStance } from "../../src/lib/decisions/d5-stance";
import { legacyStance } from "../../src/lib/decisions/legacy-adapter";
import type { Gate2BarInput, Gate1Level } from "../../src/lib/scanner/gate2/types";

function arg(n: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (h) return h.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
/** Gate 2's own median convention (breakout-pullback.ts:39-44). */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };
type Sym = { id: string; symbol: string; exchange: string | null; bars: Bar[]; times: number[]; firstBarDateEver: string | null };

function lastIdxAtOrBefore(t: readonly number[], x: number): number {
  let lo = 0, hi = t.length - 1, a = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m]! <= x) { a = m; lo = m + 1; } else hi = m - 1; }
  return a;
}

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/postbackfill";
  const minSession = arg("min-session") ?? "2015-01-01";
  console.error(`rebuild → ${describeDatabaseUrl()} (read-only)`);

  const idxRows = (await wr(() => prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX" }, orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  }))) as Bar[];
  const idxTimes = idxRows.map((b) => b.date.getTime());

  const symRows = await wr(() => prisma.stockSymbol.findMany({ where: { bars: { some: {} } }, select: { id: true, symbol: true, exchange: true }, orderBy: { symbol: "asc" } }));
  const tacticalRows = await wr(() => prisma.tacticalSymbol.findMany({
    select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
  }));
  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol, addedAt: t.addedAt.toISOString(), expiresAt: t.expiresAt.toISOString(),
    status: String(t.status), activeForScanner: t.activeForScanner,
  }));

  const syms: Sym[] = [];
  let loaded = 0;
  for (const s of symRows) {
    const bars = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[];
    if (!bars.length) continue;
    syms.push({
      id: s.id, symbol: s.symbol, exchange: s.exchange, bars,
      times: bars.map((b) => b.date.getTime()),
      firstBarDateEver: isoDay(bars[0]!.date),
    });
    if (++loaded % 60 === 0) console.error(`  loaded ${loaded}/${symRows.length}`);
  }
  console.error(`symbols with bars: ${syms.length}`);

  const sessions = idxRows.map((b) => isoDay(b.date)).filter((d) => d >= minSession);
  console.error(`sessions to scan: ${sessions.length} (${sessions[0]} .. ${sessions[sessions.length - 1]})`);

  type Out = Record<string, unknown>;
  const setups: Out[] = [];
  const stanceRows: Out[] = [];
  let shadowErrors = 0;

  for (let si = 0; si < sessions.length; si++) {
    const sessionKey = sessions[si]!;
    const sessionMs = Date.parse(sessionKey);
    const guard = createPointInTimeGuard(sessionKey, { throwOnViolation: false });

    // ---- Gate 1, from index bars through T only ----
    const ie = lastIdxAtOrBefore(idxTimes, sessionMs);
    if (ie < 49) continue;
    const regimeBars = guard.decisionRows("gate1", idxRows.slice(0, ie + 1));
    const regime = evaluateMarketRegime(
      regimeBars.map((b) => ({ time: b.date.getTime(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })),
    );
    const gate1 = regime.level as Gate1Level;

    // ---- point-in-time universe ----
    const lookbackFrom = sessionMs - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;
    const activity: SymbolActivityRow[] = [];
    const windows = new Map<string, Bar[]>();
    for (const s of syms) {
      const end = lastIdxAtOrBefore(s.times, sessionMs);
      if (end < 0) {
        activity.push({ symbolId: s.id, symbol: s.symbol, barsInWindow: 0, lastBarDate: null, firstBarDateEver: s.firstBarDateEver });
        continue;
      }
      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      const w = s.bars.slice(start, end + 1);
      windows.set(s.symbol, w);
      activity.push({ symbolId: s.id, symbol: s.symbol, barsInWindow: w.length, lastBarDate: isoDay(s.bars[end]!.date), firstBarDateEver: s.firstBarDateEver });
    }
    const universe = resolvePointInTimeUniverse({ sessionDate: sessionKey, activity, tactical });

    let countA = 0, countB = 0;
    const sessionShadow: { shown: boolean; feasible: boolean }[] = [];

    for (const member of universe.members) {
      const s = syms.find((x) => x.symbol === member.symbol);
      const w = windows.get(member.symbol);
      if (!s || !w || w.length === 0) continue;
      const bounded = guard.decisionRows(`bars:${member.symbol}`, w);
      if (!evaluateTradability(bounded as never, new Date(sessionMs)).passed) continue;

      const ev = evaluateBreakoutPullbackCandidate(bounded as unknown as Gate2BarInput[], new Date(sessionMs));
      if (ev.quality === "INVALID") continue;
      if (ev.quality === "A") countA++; else countB++;

      // ---- shadow inputs, all from bars <= T ----
      const sorted = sortDedupeGate2Bars(bounded as unknown as Gate2BarInput[]);
      const L = sorted.length - 1;
      const prior = sorted.slice(Math.max(0, L - GATE2_RANGE_DAYS), L).map((x) => x.volume);
      const med = median(prior);
      const mu = mean(prior);
      const g2v = med > 0 ? sorted[L]!.volume / med : null;
      const ctxv = mu > 0 ? sorted[L]!.volume / mu : null;
      const vol20 = sorted.slice(Math.max(0, L - 19), L + 1);
      const medTradedValueVnd = median(vol20.map((x) => x.close * 1000 * x.volume));

      const input: ShadowCandidateInput = {
        symbol: member.symbol, session: sessionKey, gate1Level: gate1, quality: ev.quality,
        validity: "VALID", entryPriceKVnd: ev.close, structuralStopKVnd: ev.stopLevel,
        atrKVnd: computeAtr(sorted.slice(Math.max(0, L - 40))),
        board: (s.exchange as "HOSE" | "HNX" | "UPCOM" | null) ?? "HOSE",
        avgDailyValueVnd: Number.isFinite(medTradedValueVnd) ? medTradedValueVnd : null,
        rankComponents: ev.rankComponents ?? null,
        accountEquityVnd: null, portfolioOpenRiskVnd: null,
        volumePrimitives: {
          gate2VolRatioMedian: g2v, contextVolRatioMean: ctxv,
          sameSideOf1_5Cutoff: g2v == null || ctxv == null ? null : (g2v >= GATE2_VOL_RATIO_A) === (ctxv >= GATE2_VOL_RATIO_A),
        },
      };
      const res = runShadowSafely(input);
      if (!res.ok) { shadowErrors++; continue; }
      const rec = res.record;
      sessionShadow.push({ shown: rec.d1Visibility.decision === "SHOWN", feasible: rec.d2Feasibility.verdict === "FEASIBLE" });

      // ---- OUTCOME CHANNEL: bars strictly after T, labels only ----
      const end = lastIdxAtOrBefore(s.times, sessionMs);
      const future = guard.outcomeRows(`fwd:${member.symbol}`, s.bars.slice(end + 1));
      const entry = future[0]?.open ?? null;
      const fwd = (k: number) => (future[k - 1] && entry ? future[k - 1]!.close / entry - 1 : null);
      const win = future.slice(0, 20);
      const mfe = entry && win.length ? Math.max(...win.map((x) => x.high)) / entry - 1 : null;
      const mae = entry && win.length ? Math.min(...win.map((x) => x.low)) / entry - 1 : null;
      let stopFirst: boolean | null = null;
      if (entry) {
        const stopFrac = (ev.close - ev.stopLevel) / ev.close;
        let hitStop = -1, hitUp = -1;
        for (let k = 0; k < win.length; k++) {
          if (hitStop < 0 && win[k]!.low <= entry * (1 - stopFrac)) hitStop = k;
          if (hitUp < 0 && win[k]!.high >= entry * (1 + 2 * stopFrac)) hitUp = k;
        }
        stopFirst = hitStop >= 0 && (hitUp < 0 || hitStop <= hitUp);
      }

      setups.push({
        session: sessionKey, symbol: member.symbol, gate1, quality: ev.quality,
        legacyVisible: rec.legacy.visibility === "SHOWN",
        shadowVisible: rec.d1Visibility.decision === "SHOWN",
        feasibility: rec.d2Feasibility.verdict, bindingFloor: rec.d2Feasibility.bindingFloor,
        riskFrac: rec.d2Feasibility.riskFracOfEntry, rankScore: rec.d3Ranking.score,
        marketRiskClass: rec.d0MarketRisk.riskClass, sizingEligibility: rec.d4Sizing.eligibility,
        gate2VolRatioMedian: g2v, contextVolRatioMean: ctxv,
        sameSide: input.volumePrimitives.sameSideOf1_5Cutoff,
        entryPriceKVnd: ev.close, stopKVnd: ev.stopLevel,
        fwd1: fwd(1), fwd3: fwd(3), fwd5: fwd(5), mfe20: mfe, mae20: mae, stopFirst,
        fwdBars: future.length,
        divergences: rec.divergences.map((d) => d.code),
      });
    }

    if (sessionShadow.length > 0) {
      const shown = sessionShadow.filter((x) => x.shown).length;
      const feasible = sessionShadow.filter((x) => x.feasible).length;
      const shadowSt = decideStance({
        marketRiskClass: gate1 === "FAIL" ? "NONE" : gate1 === "WARNING" ? "REDUCED" : "NORMAL",
        counts: { shown, hidden: sessionShadow.length - shown, feasible },
        aggregateOpenRiskVnd: null,
      });
      const legacySt = legacyStance({ gate1Level: gate1, candidateCountA: countA, candidateCountB: countB });
      stanceRows.push({ session: sessionKey, gate1, countA, countB, shown, feasible, shadow: shadowSt.stance, legacy: legacySt });
    }

    if ((si + 1) % 200 === 0) console.error(`  session ${si + 1}/${sessions.length} · setups ${setups.length}`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/setups.ndjson`, setups.map((s) => JSON.stringify(s)).join("\n") + "\n");
  writeFileSync(`${outDir}/stance.ndjson`, stanceRows.map((s) => JSON.stringify(s)).join("\n") + "\n");
  console.log(`\nwrote ${outDir}/setups.ndjson (${setups.length}) and stance.ndjson (${stanceRows.length})`);
  console.log(`shadow errors: ${shadowErrors}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
