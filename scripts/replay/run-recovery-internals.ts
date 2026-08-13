/**
 * READ-ONLY per-session market internals, for separating true recoveries from
 * false dawns.
 *
 * The leadership study established that Gate 1 gives every below-MA50 session
 * the same WARNING label while breadth separates them cleanly. This run produces
 * the full internals series needed to ask the next question: once the market is
 * recovering, which internals distinguish a recovery that holds from one that
 * fails?
 *
 * Everything is computed from bars at or before T. Nothing here is a decision,
 * and no threshold is chosen against an outcome — the series are raw, and the
 * classification of episodes happens afterwards, in analysis.
 *
 *   npx tsx scripts/replay/run-recovery-internals.ts --out docs/trading/replay/recovery
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";
import { rollingMean } from "../../src/lib/research/leadership-features";
import { classifyMarketState, marketPhase, FRESH_RECLAIM_SESSIONS } from "../../src/lib/research/market-state";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";
import { RS_LOOKBACK_20 } from "../../src/lib/scanner/gate2/relative-strength";

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

function median(x: number[]): number {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/recovery";
  console.error(`run-recovery-internals → ${describeDatabaseUrl()} (read-only)`);

  const [symbolRows, indexRows] = await Promise.all([
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }),
    prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      select: { date: true, close: true },
      orderBy: { date: "asc" },
    }),
  ]);

  type S = {
    symbol: string; times: number[]; closes: number[]; vols: number[];
    ma10: (number | null)[]; ma20: (number | null)[]; ma50: (number | null)[];
    volMed20: (number | null)[];
  };
  const idxTimesEarly = indexRows.map((b) => b.date.getTime());
  const syms: S[] = [];
  for (const s of symbolRows) {
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      select: { date: true, close: true, volume: true },
      orderBy: { date: "asc" },
    });
    if (bars.length < 60) continue;
    const closes = bars.map((b) => Number(b.close));
    const vols = bars.map((b) => Number(b.volume));
    // Rolling median volume, causal. Median rather than mean because Vietnamese
    // volume has occasional 10x block-trade spikes that would drag a mean.
    const volMed20: (number | null)[] = new Array(vols.length).fill(null);
    for (let i = RS_LOOKBACK_20; i < vols.length; i++) {
      volMed20[i] = median(vols.slice(i - RS_LOOKBACK_20, i));
    }
    syms.push({
      symbol: s.symbol, times: bars.map((b) => b.date.getTime()), closes, vols,
      ma10: rollingMean(closes, 10), ma20: rollingMean(closes, 20), ma50: rollingMean(closes, 50),
      volMed20,
    });
    if (syms.length % 200 === 0) console.error(`  loaded ${syms.length}`);
  }
  console.error(`loaded ${syms.length} symbols with >=60 bars`);

  // Fixed cohort: symbols whose stored history spans the whole study window.
  // Equal-weight statistics over a growing universe confound composition drift
  // with market change; this cohort is constant by construction, so the two can
  // be told apart.
  const studyStart = Date.parse("2015-01-01");
  const studyEnd = idxTimesEarly[idxTimesEarly.length - 1]!;
  const cohort = new Set(
    syms.filter((s) => s.times[0]! <= studyStart && s.times[s.times.length - 1]! >= studyEnd - 30 * 86_400_000)
      .map((s) => s.symbol)
  );
  console.error(`fixed cohort (full-window history): ${cohort.size} symbols`);

  const idxTimes = idxTimesEarly;
  const idxCloses = indexRows.map((b) => Number(b.close));
  const idxMa10 = rollingMean(idxCloses, 10);
  const idxMa20 = rollingMean(idxCloses, 20);
  const idxMa50 = rollingMean(idxCloses, 50);

  const rows: string[] = [];
  for (let si = 50; si < idxTimes.length; si++) {
    const t = idxTimes[si]!;
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
      let lo = Infinity;
      for (let j = Math.max(0, k - GATE2_RANGE_DAYS); j <= k; j++) lo = Math.min(lo, idxCloses[j]!);
      if (idxCloses[k] === lo) { recentNewLow = true; break; }
    }
    const state = classifyMarketState({
      close: c, ma10: idxMa10[si] ?? null, ma20: idxMa20[si] ?? null, ma50: ma50Here,
      sessionsSinceMa50Reclaim: sinceReclaim,
      ma20Falling: idxMa20[si] != null && idxMa20[si - 5] != null && idxMa20[si]! < idxMa20[si - 5]!,
      madeRecentNewLow: recentNewLow,
    });
    if (!state) continue;

    let n = 0, a10 = 0, a20 = 0, a50 = 0, up20 = 0, adv = 0, dec = 0;
    const dayRets: number[] = [];
    const cohortRets: number[] = [];
    let nh = 0, nl = 0, nYear = 0, volExp = 0, nVol = 0;
    let upVol = 0, totVol = 0;
    const r20: number[] = [];

    for (const s of syms) {
      const e = lastIdxAtOrBefore(s.times, t);
      if (e < 50) continue;
      // The symbol must have actually TRADED this session. `lastIdxAtOrBefore`
      // otherwise carries a stale bar forward, which would count a suspended or
      // not-yet-listed name as "declining on flat volume" and pollute every
      // participation measure here.
      if (s.times[e] !== t) continue;
      n++;
      const px = s.closes[e]!;
      if (s.ma10[e] != null && px > s.ma10[e]!) a10++;
      if (s.ma20[e] != null && px > s.ma20[e]!) a20++;
      if (s.ma50[e] != null && px > s.ma50[e]!) a50++;
      if (e >= RS_LOOKBACK_20) {
        const prev = s.closes[e - RS_LOOKBACK_20]!;
        if (px > prev) up20++;
        r20.push(((px - prev) / prev) * 100);
      }
      if (e >= 1) {
        const prev = s.closes[e - 1]!;
        const d = px - prev;
        if (d > 0) { adv++; upVol += s.vols[e]!; } else if (d < 0) dec++;
        totVol += s.vols[e]!;
        // Equal-weight daily return: every eligible name counts once, however
        // large. This is the axis the cap-weighted index cannot express.
        if (prev > 0) {
          const r = ((px - prev) / prev) * 100;
          dayRets.push(r);
          if (cohort.has(s.symbol)) cohortRets.push(r);
        }
      }
      if (e >= 250) {
        nYear++;
        let hi = -Infinity, lo = Infinity;
        for (let k = e - 249; k <= e; k++) { hi = Math.max(hi, s.closes[k]!); lo = Math.min(lo, s.closes[k]!); }
        if (px >= hi) nh++;
        if (px <= lo) nl++;
      }
      const vm = s.volMed20[e];
      if (vm != null && vm > 0) { nVol++; if (s.vols[e]! > vm) volExp++; }
    }
    if (n === 0) continue;

    const pct = (k: number, d = n) => (d > 0 ? Number(((k / d) * 100).toFixed(2)) : null);
    const sorted = [...r20].sort((x, y) => x - y);
    const q = (p: number) => (sorted.length ? sorted[Math.floor(p * (sorted.length - 1))]! : null);

    rows.push(JSON.stringify({
      sessionDate: isoDay(new Date(t)), marketState: state, phase: marketPhase(state),
      indexClose: c, indexMa50: ma50Here, sessionsSinceMa50Reclaim: sinceReclaim,
      n,
      pctAboveMa10: pct(a10), pctAboveMa20: pct(a20), pctAboveMa50: pct(a50),
      pctUp20d: pct(up20),
      advancing: adv, declining: dec, advDeclRatio: dec > 0 ? Number((adv / dec).toFixed(3)) : null,
      newHighs: nh, newLows: nl, nWithYear: nYear,
      // Volume breadth: how many names traded above their own recent norm, and
      // what share of the day's volume went to advancing names.
      pctVolumeExpanding: pct(volExp, nVol),
      upVolumeShare: totVol > 0 ? Number(((upVol / totVol) * 100).toFixed(2)) : null,
      // Dispersion of 20-session returns: a broad advance and a narrow one look
      // identical in a median but not in a spread.
      // Equal-weight daily return, all eligible names and the fixed cohort.
      ewDailyMeanPct: dayRets.length ? Number((dayRets.reduce((a2, x) => a2 + x, 0) / dayRets.length).toFixed(4)) : null,
      ewDailyMedianPct: dayRets.length ? Number(median(dayRets).toFixed(4)) : null,
      ewCohortMeanPct: cohortRets.length ? Number((cohortRets.reduce((a2, x) => a2 + x, 0) / cohortRets.length).toFixed(4)) : null,
      cohortEligible: cohortRets.length,
      r20Median: sorted.length ? Number(median(r20).toFixed(3)) : null,
      r20P90: q(0.9) != null ? Number(q(0.9)!.toFixed(3)) : null,
      r20P10: q(0.1) != null ? Number(q(0.1)!.toFixed(3)) : null,
      r20Iqr: q(0.75) != null && q(0.25) != null ? Number((q(0.75)! - q(0.25)!).toFixed(3)) : null,
    }));

    if (rows.length % 500 === 0) console.error(`  ${rows.length} sessions`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/internals.ndjson`, rows.join("\n") + "\n", "utf8");
  console.error(`wrote ${rows.length} session rows`);
}

main()
  .catch((e) => {
    console.error("run-recovery-internals FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
