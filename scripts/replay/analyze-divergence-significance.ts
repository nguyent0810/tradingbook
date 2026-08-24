/**
 * Post-backfill diagnostic — are the §4/§5 differences distinguishable, or noise?
 *
 * Inference discipline inherited from phases 9-15: statistics on QUARTER
 * clusters, cluster bootstrap over quarters, symbol not a cluster level
 * (measured ICC 0.0000). Forward returns are outcome labels only.
 *
 *   npx tsx scripts/replay/analyze-divergence-significance.ts
 */
import { readFileSync } from "node:fs";

const DIR = "docs/trading/replay/postbackfill";
const B = 20_000;

type Setup = {
  session: string; symbol: string; legacyVisible: boolean; shadowVisible: boolean;
  fwd5: number | null; stopFirst: boolean | null; fwdBars: number;
};

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Cluster bootstrap over quarters of the difference in a statistic between two groups. */
function diffCI(
  a: Setup[], bGroup: Setup[], stat: (rows: Setup[]) => number, seed: number,
): { obs: number; lo: number; hi: number } {
  const all = [...a.map((r) => ({ r, g: 0 })), ...bGroup.map((r) => ({ r, g: 1 }))];
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
  return { obs: stat(a) - stat(bGroup), lo: q(0.025), hi: q(0.975) };
}

function main(): void {
  const setups = (readFileSync(`${DIR}/setups.ndjson`, "utf-8").trim().split(/\r?\n/).filter(Boolean)
    .map((l) => JSON.parse(l) as Setup)).filter((s) => s.fwdBars >= 5);

  const h2v = setups.filter((s) => !s.legacyVisible && s.shadowVisible);
  const v2h = setups.filter((s) => s.legacyVisible && !s.shadowVisible);
  const bothShown = setups.filter((s) => s.legacyVisible && s.shadowVisible);

  const meanFwd5 = (rows: Setup[]) => mean(rows.map((r) => r.fwd5).filter((x): x is number => x != null));
  const winRate = (rows: Setup[]) => {
    const f = rows.map((r) => r.fwd5).filter((x): x is number => x != null);
    return f.length ? f.filter((x) => x > 0).length / f.length : NaN;
  };
  const stopRate = (rows: Setup[]) => {
    const f = rows.map((r) => r.stopFirst).filter((x): x is boolean => x != null);
    return f.length ? f.filter(Boolean).length / f.length : NaN;
  };

  console.log("QUARTER-CLUSTERED BOOTSTRAP, 20,000 replicates");
  console.log(`  hidden->visible n=${h2v.length} · visible->hidden n=${v2h.length} · both-shown control n=${bothShown.length}`);
  console.log(`  quarters spanned: ${new Set(setups.map((s) => quarter(s.session))).size}\n`);

  const cases: Array<[string, Setup[], Setup[], (r: Setup[]) => number, number]> = [
    ["hidden->visible  minus control : mean T+5", h2v, bothShown, meanFwd5, 101],
    ["hidden->visible  minus control : win@T+5", h2v, bothShown, winRate, 102],
    ["hidden->visible  minus control : stopFirst", h2v, bothShown, stopRate, 103],
    ["visible->hidden  minus control : mean T+5", v2h, bothShown, meanFwd5, 201],
    ["visible->hidden  minus control : win@T+5", v2h, bothShown, winRate, 202],
    ["visible->hidden  minus control : stopFirst", v2h, bothShown, stopRate, 203],
  ];
  for (const [label, a, b, stat, seed] of cases) {
    const r = diffCI(a, b, stat, seed);
    const excludesZero = (r.lo > 0 && r.hi > 0) || (r.lo < 0 && r.hi < 0);
    console.log(
      `  ${label.padEnd(44)} ${pct(r.obs).padStart(8)}   95% CI [${pct(r.lo)}, ${pct(r.hi)}]   ${excludesZero ? "EXCLUDES ZERO" : "includes zero"}`,
    );
  }

  console.log("\nWHAT WOULD BE DETECTABLE");
  const n1 = h2v.filter((s) => s.fwd5 != null).length;
  const n2 = bothShown.filter((s) => s.fwd5 != null).length;
  console.log(`  hidden->visible has ${n1} outcomes against a ${n2}-outcome control`);
  console.log(`  the intervals above are the answer: anything they contain is not ruled out`);
}

main();
