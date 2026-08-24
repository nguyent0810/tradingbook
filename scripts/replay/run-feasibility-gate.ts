/**
 * Executes FEASIBILITY-GATE-PREREGISTRATION.md, committed at `f280694` before any
 * outcome of this gate was computed.
 *
 * Forward outcomes are RECOMPUTED FROM RAW BARS here rather than read from the
 * cached artifact, and the recomputation is reconciled against the stored values
 * as an integrity check (§8).
 *
 *   npx tsx scripts/replay/run-feasibility-gate.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";

const B = 20_000;
const CI = 0.95;
const MIN_CELL = 30; // frozen: a regime cohort is "major" only at >=30 per arm

async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
const pct = (x: number) => (Number.isNaN(x) ? "   n/a" : `${(100 * x).toFixed(2)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qtl = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const year = (d: string) => d.slice(0, 4);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

type Row = {
  session: string; symbol: string; gate1: string; feasibility: string;
  riskFrac: number; entryPriceKVnd: number; stopKVnd: number;
  fwd1: number; fwd3: number; fwd5: number; mfe: number; mae: number; stopFirst: boolean;
  atrKVnd: number | null; tradedValueVnd: number | null;
  ma20Dist: number | null; ma50Dist: number | null;
};
type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };

/** Quarter-cluster bootstrap of a difference in means between two labelled arms. */
function clusterDiffCI(rows: Row[], isA: (r: Row) => boolean, val: (r: Row) => number, seed: number) {
  const byQ = new Map<string, Row[]>();
  for (const r of rows) {
    const k = quarter(r.session);
    const a = byQ.get(k) ?? [];
    a.push(r);
    byQ.set(k, a);
  }
  const groups = [...byQ.values()];
  const stat = (rs: Row[]) => {
    const a = rs.filter(isA).map(val);
    const b = rs.filter((r) => !isA(r)).map(val);
    return a.length && b.length ? mean(a) - mean(b) : NaN;
  };
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < B; i++) {
    const s: Row[] = [];
    for (let j = 0; j < groups.length; j++) s.push(...groups[Math.floor(rand() * groups.length)]!);
    const d = stat(s);
    if (Number.isFinite(d)) draws.push(d);
  }
  draws.sort((x, y) => x - y);
  const lo = (1 - CI) / 2;
  return {
    obs: stat(rows),
    lo: qtl(draws, lo),
    hi: qtl(draws, 1 - lo),
    quarters: groups.length,
  };
}

const isFeas = (r: Row) => r.feasibility === "FEASIBLE";
const fwd5 = (r: Row) => r.fwd5;

async function main(): Promise<void> {
  console.error(`feasibility gate → ${describeDatabaseUrl()} (read-only)`);

  type Stored = {
    session: string; symbol: string; gate1: string; feasibility: string;
    riskFrac: number | null; entryPriceKVnd: number; stopKVnd: number;
    fwd1: number | null; fwd3: number | null; fwd5: number | null;
    mfe20: number | null; mae20: number | null; stopFirst: boolean | null; fwdBars: number;
  };
  const stored: Stored[] = readFileSync("docs/trading/replay/postbackfill/setups.ndjson", "utf-8")
    .trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

  // ------------------------------------------------ §8 recompute from raw bars
  const symbols = [...new Set(stored.map((s) => s.symbol))];
  const symRows = await wr(() => prisma.stockSymbol.findMany({
    where: { symbol: { in: symbols } }, select: { id: true, symbol: true },
  }));
  const bars = new Map<string, Bar[]>();
  let loaded = 0;
  for (const s of symRows) {
    bars.set(s.symbol, (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[]);
    if (++loaded % 40 === 0) console.error(`  loaded ${loaded}/${symRows.length}`);
  }

  const rows: Row[] = [];
  let mismatch = 0;
  let excludedLiquidity = 0;
  let excludedShortWindow = 0;
  for (const st of stored) {
    if (st.feasibility === "NOT_FEASIBLE_LIQUIDITY") { excludedLiquidity++; continue; }
    if (st.feasibility !== "FEASIBLE" && st.feasibility !== "NOT_FEASIBLE_NOISE") continue;
    if (st.riskFrac == null) continue;

    const rs = bars.get(st.symbol);
    if (!rs) continue;
    const i = rs.findIndex((r) => isoDay(r.date) === st.session);
    if (i < 0) continue;
    const fut = rs.slice(i + 1);
    if (fut.length < 5) { excludedShortWindow++; continue; }
    const entry = fut[0]!.open;
    if (!(entry > 0)) continue;

    const f = (k: number) => fut[k - 1]!.close / entry - 1;
    const win = fut.slice(0, 20);
    const mfe = Math.max(...win.map((x) => x.high)) / entry - 1;
    const mae = Math.min(...win.map((x) => x.low)) / entry - 1;
    const sf = st.riskFrac;
    let hitStop = -1, hitUp = -1;
    for (let k = 0; k < win.length; k++) {
      if (hitStop < 0 && win[k]!.low <= entry * (1 - sf)) hitStop = k;
      if (hitUp < 0 && win[k]!.high >= entry * (1 + 2 * sf)) hitUp = k;
    }
    const stopFirst = hitStop >= 0 && (hitUp < 0 || hitStop <= hitUp);

    // integrity: does the recomputation reproduce the stored label?
    if (st.fwd5 != null && Math.abs(st.fwd5 - f(5)) > 1e-9) mismatch++;

    // stratification inputs, all from bars <= T
    const hist = rs.slice(0, i + 1);
    const ma20 = hist.length >= 20 ? mean(hist.slice(-20).map((x) => x.close)) : null;
    const ma50 = hist.length >= 50 ? mean(hist.slice(-50).map((x) => x.close)) : null;
    const c = hist[hist.length - 1]!.close;
    const tv = hist.length >= 20 ? mean(hist.slice(-20).map((x) => x.close * 1000 * x.volume)) : null;
    let atr: number | null = null;
    if (hist.length >= 15) {
      const trs: number[] = [];
      for (let k = hist.length - 14; k < hist.length; k++) {
        const b = hist[k]!, p = hist[k - 1]!;
        trs.push(Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)));
      }
      atr = mean(trs);
    }

    rows.push({
      session: st.session, symbol: st.symbol, gate1: st.gate1, feasibility: st.feasibility,
      riskFrac: st.riskFrac, entryPriceKVnd: st.entryPriceKVnd, stopKVnd: st.stopKVnd,
      fwd1: f(1), fwd3: f(3), fwd5: f(5), mfe, mae, stopFirst,
      atrKVnd: atr, tradedValueVnd: tv,
      ma20Dist: ma20 ? c / ma20 - 1 : null, ma50Dist: ma50 ? c / ma50 - 1 : null,
    });
  }

  const feas = rows.filter(isFeas);
  const noise = rows.filter((r) => !isFeas(r));

  console.log("\n================ §8 DATA INTEGRITY ================");
  console.log(`  eligible N                    ${rows.length}`);
  console.log(`  FEASIBLE                      ${feas.length}`);
  console.log(`  NOT_FEASIBLE_NOISE            ${noise.length}`);
  console.log(`  excluded, LIQUIDITY verdict   ${excludedLiquidity}   (preregistered exclusion)`);
  console.log(`  excluded, window < 5 sessions ${excludedShortWindow}`);
  console.log(`  recomputed fwd5 != stored     ${mismatch}   ${mismatch === 0 ? "(exact reproduction from raw)" : "*** DIVERGENCE ***"}`);
  console.log(`  quarters spanned              ${new Set(rows.map((r) => quarter(r.session))).size}`);

  console.log("\n================ PRIMARY ENDPOINT ================");
  const p = clusterDiffCI(rows, isFeas, fwd5, 90210);
  console.log(`  mean T+5, FEASIBLE ${pct(mean(feas.map(fwd5)))} - NOT_FEASIBLE_NOISE ${pct(mean(noise.map(fwd5)))}`);
  console.log(`  delta ${pct(p.obs)}   95% quarter-clustered CI [${pct(p.lo)}, ${pct(p.hi)}]   over ${p.quarters} quarters`);
  const c1 = p.obs > 0;
  const c2 = p.lo > 0;
  console.log(`  C1 point estimate positive     ${c1 ? "PASS" : "FAIL"}`);
  console.log(`  C2 CI entirely above zero      ${c2 ? "PASS" : "FAIL"}`);

  console.log("\n================ SECONDARY (cannot rescue the primary) ================");
  for (const [name, val] of [
    ["T+1 return", (r: Row) => r.fwd1],
    ["T+3 return", (r: Row) => r.fwd3],
    ["MFE (20s)", (r: Row) => r.mfe],
    ["MAE (20s)", (r: Row) => r.mae],
    ["stop-first rate", (r: Row) => (r.stopFirst ? 1 : 0)],
    ["T+5 win rate", (r: Row) => (r.fwd5 > 0 ? 1 : 0)],
  ] as const) {
    const d = clusterDiffCI(rows, isFeas, val, 500 + name.length);
    const ex = (d.lo > 0 && d.hi > 0) || (d.lo < 0 && d.hi < 0);
    console.log(`  ${name.padEnd(17)} F ${pct(mean(feas.map(val))).padStart(8)}  N ${pct(mean(noise.map(val))).padStart(8)}  delta ${pct(d.obs).padStart(8)}  CI [${pct(d.lo)}, ${pct(d.hi)}]  ${ex ? "excl. zero" : "incl. zero"}`);
  }

  console.log("\n================ C3 REGIME CONSISTENCY ================");
  const breadth = new Map<string, number>(
    readFileSync("docs/trading/replay/postbackfill/breadth.ndjson", "utf-8")
      .trim().split(/\r?\n/).filter(Boolean)
      .map((l) => { const b = JSON.parse(l) as { session: string; advShare: number }; return [b.session, b.advShare]; }),
  );
  const shares = [...breadth.values()];
  const p10 = qtl(shares, 0.1), p30 = qtl(shares, 0.3), p70 = qtl(shares, 0.7), p90 = qtl(shares, 0.9);
  const cohortOf = (d: string): string => {
    const a = breadth.get(d);
    if (a == null) return "unclassified";
    if (a >= p90) return "strong";
    if (a <= p10) return "weak";
    if (a > p30 && a < p70) return "ordinary";
    return "between";
  };
  const regimes: Array<[string, (r: Row) => boolean]> = [
    ["era old (<2022)", (r) => r.session < "2022-01-01"],
    ["era new (>=2022)", (r) => r.session >= "2022-01-01"],
    ["breadth strong", (r) => cohortOf(r.session) === "strong"],
    ["breadth ordinary", (r) => cohortOf(r.session) === "ordinary"],
    ["breadth weak", (r) => cohortOf(r.session) === "weak"],
  ];
  let c3 = true;
  const majors: string[] = [];
  for (const [name, sel] of regimes) {
    const sub = rows.filter(sel);
    const nF = sub.filter(isFeas).length, nN = sub.length - sub.filter(isFeas).length;
    const major = nF >= MIN_CELL && nN >= MIN_CELL;
    const d = major ? clusterDiffCI(sub, isFeas, fwd5, 700 + name.length) : null;
    if (major) {
      majors.push(name);
      if (!(d!.obs > 0)) c3 = false;
    }
    console.log(
      `  ${name.padEnd(18)} nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  ` +
        (major
          ? `delta ${pct(d!.obs).padStart(8)}  CI [${pct(d!.lo)}, ${pct(d!.hi)}]   MAJOR${d!.obs > 0 ? "" : "  <-- SIGN FAILS"}`
          : `delta ${pct(sub.length ? mean(sub.filter(isFeas).map(fwd5)) - mean(sub.filter((r) => !isFeas(r)).map(fwd5)) : NaN).padStart(8)}   below ${MIN_CELL}/arm, excluded from C3`),
    );
  }
  console.log(`  major cohorts: ${majors.join(", ") || "none"}`);
  console.log(`  C3 positive in every major regime   ${c3 ? "PASS" : "FAIL"}`);

  console.log("\n================ C4 CONCENTRATION / LEAVE-ONE-OUT ================");
  const base = p.obs;
  const loo = (key: (r: Row) => string, label: string) => {
    const keys = [...new Set(rows.map(key))];
    const impact = keys.map((k) => {
      const kept = rows.filter((r) => key(r) !== k);
      const nF = kept.filter(isFeas).length, nN = kept.length - nF;
      if (nF < 10 || nN < 10) return { k, delta: NaN, drop: NaN, n: rows.filter((r) => key(r) === k).length };
      const d = mean(kept.filter(isFeas).map(fwd5)) - mean(kept.filter((r) => !isFeas(r)).map(fwd5));
      return { k, delta: d, drop: (base - d) / Math.abs(base), n: rows.filter((r) => key(r) === k).length };
    }).filter((x) => Number.isFinite(x.drop));
    impact.sort((a, b) => b.drop - a.drop);
    const top = impact.slice(0, 3);
    console.log(`  by ${label}:`);
    for (const t of top) {
      console.log(`    remove ${String(t.k).padEnd(10)} (n=${String(t.n).padStart(3)})  delta -> ${pct(t.delta).padStart(8)}   explains ${(100 * t.drop).toFixed(1)}% of the effect${t.delta > 0 ? "" : "   <-- SIGN FLIPS"}`);
    }
    const worst = top[0];
    return worst ? { ok: worst.drop <= 0.5 && worst.delta > 0, worst } : { ok: true, worst: null };
  };
  const rY = loo((r) => year(r.session), "year");
  const rQ = loo((r) => quarter(r.session), "quarter");
  const rS = loo((r) => r.symbol, "symbol");
  console.log(`  sector: UNTESTABLE - the schema carries no sector field (declared in the preregistration)`);
  const c4 = rY.ok && rQ.ok && rS.ok;
  console.log(`  C4 no cluster explains >50% and sign survives removal   ${c4 ? "PASS" : "FAIL"}`);

  console.log("\n================ §2 STOP-DISTANCE MATCHED ================");
  const bands: Array<[string, number, number]> = [
    ["riskFrac <3%", 0, 0.03], ["3-5%", 0.03, 0.05], ["5-8%", 0.05, 0.08], [">8%", 0.08, Infinity],
  ];
  for (const [nm, lo, hi] of bands) {
    const sub = rows.filter((r) => r.riskFrac >= lo && r.riskFrac < hi);
    const f = sub.filter(isFeas), n = sub.filter((r) => !isFeas(r));
    if (f.length < 5 || n.length < 5) { console.log(`  ${nm.padEnd(14)} nF=${f.length} nN=${n.length}  too few`); continue; }
    console.log(
      `  ${nm.padEnd(14)} nF=${String(f.length).padStart(3)} nN=${String(n.length).padStart(3)}  ` +
        `T+5 delta ${pct(mean(f.map(fwd5)) - mean(n.map(fwd5))).padStart(8)}  ` +
        `stopFirst F ${pct(mean(f.map((r) => (r.stopFirst ? 1 : 0))))} N ${pct(mean(n.map((r) => (r.stopFirst ? 1 : 0))))}`,
    );
  }

  console.log("\n================ §3 CONFOUNDER STRATIFICATION ================");
  const strata: Array<[string, (r: Row) => number | null]> = [
    ["ATR / price", (r) => (r.atrKVnd != null && r.entryPriceKVnd > 0 ? r.atrKVnd / r.entryPriceKVnd : null)],
    ["price level", (r) => r.entryPriceKVnd],
    ["traded value", (r) => r.tradedValueVnd],
    ["dist from MA20", (r) => r.ma20Dist],
    ["dist from MA50", (r) => r.ma50Dist],
  ];
  for (const [nm, f] of strata) {
    const withV = rows.filter((r) => f(r) != null);
    if (withV.length < 60) { console.log(`  ${nm.padEnd(16)} too few`); continue; }
    const med = qtl(withV.map((r) => f(r)!), 0.5);
    for (const [half, sel] of [["low ", (r: Row) => f(r)! <= med], ["high", (r: Row) => f(r)! > med]] as const) {
      const sub = withV.filter(sel);
      const nF = sub.filter(isFeas).length, nN = sub.length - sub.filter(isFeas).length;
      if (nF < 10 || nN < 10) { console.log(`  ${nm.padEnd(16)} ${half}  nF=${nF} nN=${nN} too few`); continue; }
      const d = mean(sub.filter(isFeas).map(fwd5)) - mean(sub.filter((r) => !isFeas(r)).map(fwd5));
      console.log(`  ${nm.padEnd(16)} ${half}  nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  delta ${pct(d).padStart(8)}${d > 0 ? "" : "   <-- sign flips"}`);
    }
  }
  for (const g of ["PASS", "WARNING", "FAIL"]) {
    const sub = rows.filter((r) => r.gate1 === g);
    const nF = sub.filter(isFeas).length, nN = sub.length - sub.filter(isFeas).length;
    if (nF < 10 || nN < 10) { console.log(`  gate1 ${g.padEnd(10)} nF=${nF} nN=${nN} too few`); continue; }
    const d = mean(sub.filter(isFeas).map(fwd5)) - mean(sub.filter((r) => !isFeas(r)).map(fwd5));
    console.log(`  gate1 ${g.padEnd(10)}      nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  delta ${pct(d).padStart(8)}${d > 0 ? "" : "   <-- sign flips"}`);
  }

  console.log("\n================ §4 TEMPORAL ================");
  const sorted = [...rows].sort((a, b) => a.session.localeCompare(b.session));
  const mid = Math.floor(sorted.length / 2);
  for (const [nm, sub] of [["earlier half", sorted.slice(0, mid)], ["later half", sorted.slice(mid)]] as const) {
    const d = clusterDiffCI(sub, isFeas, fwd5, 800 + nm.length);
    console.log(`  ${nm.padEnd(14)} n=${String(sub.length).padStart(3)} (${sub[0]!.session}..${sub[sub.length - 1]!.session})  delta ${pct(d.obs).padStart(8)}  CI [${pct(d.lo)}, ${pct(d.hi)}]`);
  }
  console.log("  by year:");
  for (const y of [...new Set(rows.map((r) => year(r.session)))].sort()) {
    const sub = rows.filter((r) => year(r.session) === y);
    const nF = sub.filter(isFeas).length, nN = sub.length - sub.filter(isFeas).length;
    const d = nF && nN ? mean(sub.filter(isFeas).map(fwd5)) - mean(sub.filter((r) => !isFeas(r)).map(fwd5)) : NaN;
    console.log(`    ${y}  nF=${String(nF).padStart(3)} nN=${String(nN).padStart(2)}  delta ${pct(d).padStart(8)}`);
  }

  console.log("\n================ VERDICT ================");
  console.log(`  C1 ${c1 ? "PASS" : "FAIL"}   C2 ${c2 ? "PASS" : "FAIL"}   C3 ${c3 ? "PASS" : "FAIL"}   C4 ${c4 ? "PASS" : "FAIL"}`);
  console.log(`  ${c1 && c2 && c3 && c4 ? "FEASIBILITY GO" : "FEASIBILITY NO-GO"}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
