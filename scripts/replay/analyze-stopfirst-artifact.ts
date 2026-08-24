/**
 * Is the one significant result an artifact?
 *
 * `stopFirst` asks whether price reached entry x (1 - stopFrac) before
 * entry x (1 + 2 x stopFrac). `NOT_FEASIBLE_NOISE` fires when the stop is CLOSE.
 * A closer stop is mechanically easier to hit, so the +16.45pp stopFirst gap may
 * be arithmetic rather than information.
 *
 * This tests it two ways that do not depend on stop distance at all:
 *   1. raw forward return and win rate, which know nothing about the stop
 *   2. stopFirst within matched stop-distance bands
 *
 *   npx tsx scripts/replay/analyze-stopfirst-artifact.ts
 */
import { readFileSync } from "node:fs";

const DIR = "docs/trading/replay/postbackfill";
const B = 20_000;

type Setup = {
  session: string; feasibility: string; riskFrac: number | null;
  legacyVisible: boolean; shadowVisible: boolean;
  fwd5: number | null; mfe20: number | null; mae20: number | null;
  stopFirst: boolean | null; fwdBars: number;
};

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : `${(100 * x).toFixed(2)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function diffCI(a: Setup[], b: Setup[], stat: (r: Setup[]) => number, seed: number) {
  const all = [...a.map((r) => ({ r, g: 0 })), ...b.map((r) => ({ r, g: 1 }))];
  const byQ = new Map<string, { r: Setup; g: number }[]>();
  for (const x of all) {
    const k = quarter(x.r.session);
    const arr = byQ.get(k) ?? [];
    arr.push(x);
    byQ.set(k, arr);
  }
  const groups = [...byQ.values()];
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < B; i++) {
    const ga: Setup[] = [], gb: Setup[] = [];
    for (let j = 0; j < groups.length; j++) {
      for (const x of groups[Math.floor(rand() * groups.length)]!) (x.g === 0 ? ga : gb).push(x.r);
    }
    if (ga.length > 2 && gb.length > 2) draws.push(stat(ga) - stat(gb));
  }
  draws.sort((x, y) => x - y);
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))]!;
  return { obs: stat(a) - stat(b), lo: q(0.025), hi: q(0.975) };
}

const winRate = (rows: Setup[]) => {
  const f = rows.map((r) => r.fwd5).filter((x): x is number => x != null);
  return f.length ? f.filter((x) => x > 0).length / f.length : NaN;
};
const meanFwd5 = (rows: Setup[]) => mean(rows.map((r) => r.fwd5).filter((x): x is number => x != null));
const stopRate = (rows: Setup[]) => {
  const f = rows.map((r) => r.stopFirst).filter((x): x is boolean => x != null);
  return f.length ? f.filter(Boolean).length / f.length : NaN;
};

function main(): void {
  const all = (readFileSync(`${DIR}/setups.ndjson`, "utf-8").trim().split(/\r?\n/).filter(Boolean)
    .map((l) => JSON.parse(l) as Setup)).filter((s) => s.fwdBars >= 5 && s.riskFrac != null);

  const feas = all.filter((s) => s.feasibility === "FEASIBLE");
  const noise = all.filter((s) => s.feasibility === "NOT_FEASIBLE_NOISE");

  console.log("== 1. STOP-DISTANCE-INDEPENDENT MEASURES ==");
  console.log("   forward return and win rate know nothing about the stop, so they cannot be a stop artifact\n");
  for (const [label, stat, seed] of [
    ["FEASIBLE minus NOT_FEASIBLE_NOISE : win@T+5", winRate, 301],
    ["FEASIBLE minus NOT_FEASIBLE_NOISE : mean T+5", meanFwd5, 302],
    ["FEASIBLE minus NOT_FEASIBLE_NOISE : stopFirst", stopRate, 303],
  ] as const) {
    const r = diffCI(feas, noise, stat, seed);
    const ex = (r.lo > 0 && r.hi > 0) || (r.lo < 0 && r.hi < 0);
    console.log(`  ${label.padEnd(46)} ${pct(r.obs).padStart(8)}   95% CI [${pct(r.lo)}, ${pct(r.hi)}]   ${ex ? "EXCLUDES ZERO" : "includes zero"}`);
  }

  console.log("\n== 2. STOP DISTANCE BY GROUP (the mechanism under suspicion) ==");
  for (const [label, rows] of [["FEASIBLE", feas], ["NOT_FEASIBLE_NOISE", noise]] as const) {
    const rf = rows.map((r) => r.riskFrac!).filter(Number.isFinite);
    console.log(`  ${label.padEnd(20)} n=${String(rows.length).padStart(3)}  riskFrac p25 ${pct(qt(rf, 0.25))}  median ${pct(qt(rf, 0.5))}  p75 ${pct(qt(rf, 0.75))}`);
  }

  console.log("\n== 3. STOPFIRST WITHIN MATCHED STOP-DISTANCE BANDS ==");
  console.log("   if the gap is purely mechanical it should vanish once distance is held fixed\n");
  const bands: Array<[string, number, number]> = [
    ["riskFrac < 3%", 0, 0.03],
    ["3% - 5%", 0.03, 0.05],
    ["5% - 8%", 0.05, 0.08],
    ["> 8%", 0.08, Infinity],
  ];
  for (const [name, lo, hi] of bands) {
    const f = feas.filter((s) => s.riskFrac! >= lo && s.riskFrac! < hi);
    const n = noise.filter((s) => s.riskFrac! >= lo && s.riskFrac! < hi);
    if (f.length < 5 || n.length < 5) {
      console.log(`  ${name.padEnd(14)} FEASIBLE n=${f.length} · NOISE n=${n.length}  -- too few to compare`);
      continue;
    }
    console.log(
      `  ${name.padEnd(14)} FEASIBLE n=${String(f.length).padStart(3)} stopFirst ${pct(stopRate(f))} win ${pct(winRate(f))}` +
        `  |  NOISE n=${String(n.length).padStart(3)} stopFirst ${pct(stopRate(n))} win ${pct(winRate(n))}`,
    );
  }

  console.log("\n== 4. NORMALISED EXCURSION, which divides out the stop entirely ==");
  for (const [label, rows] of [["FEASIBLE", feas], ["NOT_FEASIBLE_NOISE", noise]] as const) {
    const mfe = rows.map((r) => (r.mfe20 != null && r.riskFrac ? r.mfe20 / r.riskFrac : null)).filter((x): x is number => x != null);
    const mae = rows.map((r) => (r.mae20 != null && r.riskFrac ? r.mae20 / r.riskFrac : null)).filter((x): x is number => x != null);
    console.log(`  ${label.padEnd(20)} MFE/risk median ${qt(mfe, 0.5).toFixed(2)}R   MAE/risk median ${qt(mae, 0.5).toFixed(2)}R`);
  }
}

main();
