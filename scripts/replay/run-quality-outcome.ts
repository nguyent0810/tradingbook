/**
 * Phase 14.5 — executes QUALITY-LABEL-PREREGISTRATION.md, committed at `2c97ca6`.
 *
 * Quarter-clustered throughout, with negative controls run before any result is
 * interpreted, and a moving-block robustness pass because 34.8% of forward
 * windows cross a quarter boundary.
 *
 *   npx tsx scripts/replay/run-quality-outcome.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";

const REFERENCE = 1 / 3;
const B = 20_000;
const CAL_RUNS = 2_000;
const BLOCK_SESSIONS = 30;
const ALPHA = 0.0167; // Bonferroni over three primary comparisons

type Row = {
  sessionDate: string;
  symbol: string;
  gate1: "PASS" | "WARNING" | "FAIL";
  quality: "A" | "B";
  outcome: string | null;
  relVolume: number | null;
  mfeAtr: number | null;
  maeAtr: number | null;
  fwd20: number | null;
  resolveSession: number | null;
};

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const era = (d: string) => (d < "2022-01-01" ? "old" : "new");
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const rate = (rs: Row[]) =>
  rs.length === 0 ? NaN : rs.filter((r) => r.outcome === "CONTINUATION").length / rs.length;

function byQuarter(rs: Row[]): Row[][] {
  const m = new Map<string, Row[]>();
  for (const r of rs) {
    const k = quarter(r.sessionDate);
    const a = m.get(k) ?? [];
    a.push(r);
    m.set(k, a);
  }
  return [...m.values()];
}

function clusterCI(rs: Row[], seed: number, b = B) {
  const groups = byQuarter(rs);
  const k = groups.length;
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < b; i++) {
    let c = 0, n = 0;
    for (let j = 0; j < k; j++) {
      for (const r of groups[Math.floor(rand() * k)]!) {
        n++;
        if (r.outcome === "CONTINUATION") c++;
      }
    }
    if (n > 0) draws.push(c / n);
  }
  draws.sort((a, z) => a - z);
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))]!;
  return { lo: q(0.025), hi: q(0.975), loB: q(ALPHA / 2), hiB: q(1 - ALPHA / 2) };
}

/** Cluster bootstrap of the A-minus-B difference, resampling whole quarters. */
function diffCI(rs: Row[], seed: number, b = B) {
  const groups = byQuarter(rs);
  const k = groups.length;
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < b; i++) {
    let ac = 0, an = 0, bc = 0, bn = 0;
    for (let j = 0; j < k; j++) {
      for (const r of groups[Math.floor(rand() * k)]!) {
        const c = r.outcome === "CONTINUATION" ? 1 : 0;
        if (r.quality === "A") { an++; ac += c; } else { bn++; bc += c; }
      }
    }
    if (an > 0 && bn > 0) draws.push(ac / an - bc / bn);
  }
  draws.sort((a, z) => a - z);
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))]!;
  return { lo: q(0.025), hi: q(0.975), loB: q(ALPHA / 2), hiB: q(1 - ALPHA / 2) };
}

function permP(rs: Row[], seed: number, b = B): { diff: number; p: number } {
  const observed = rate(rs.filter((r) => r.quality === "A")) - rate(rs.filter((r) => r.quality === "B"));
  const groups = byQuarter(rs);
  const rand = rng(seed);
  let ge = 0;
  for (let i = 0; i < b; i++) {
    let ac = 0, an = 0, bc = 0, bn = 0;
    for (const g of groups) {
      const lab = g.map((r) => r.quality);
      for (let j = lab.length - 1; j > 0; j--) {
        const t = Math.floor(rand() * (j + 1));
        [lab[j], lab[t]] = [lab[t]!, lab[j]!];
      }
      for (let j = 0; j < g.length; j++) {
        const c = g[j]!.outcome === "CONTINUATION" ? 1 : 0;
        if (lab[j] === "A") { an++; ac += c; } else { bn++; bc += c; }
      }
    }
    if (an > 0 && bn > 0 && Math.abs(ac / an - bc / bn) >= Math.abs(observed)) ge++;
  }
  return { diff: observed, p: (ge + 1) / (b + 1) };
}

function syntheticClustered(sizes: number[], p: number, icc: number, rand: () => number): Row[] {
  const conc = Math.max(0.01, 1 / icc - 1);
  const gamma = (shape: number): number => {
    if (shape < 1) return gamma(shape + 1) * Math.pow(Math.max(1e-12, rand()), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = 0, v = 0;
      do {
        const u1 = Math.max(1e-12, rand()), u2 = Math.max(1e-12, rand());
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.max(1e-12, rand());
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const out: Row[] = [];
  sizes.forEach((n, qi) => {
    const g1 = gamma(p * conc), g2 = gamma((1 - p) * conc);
    const pq = g1 / (g1 + g2);
    for (let i = 0; i < n; i++) {
      out.push({
        sessionDate: `20${String(15 + Math.floor(qi / 4)).padStart(2, "0")}-${String(1 + 3 * (qi % 4)).padStart(2, "0")}-01`,
        symbol: `S${i}`, gate1: "PASS", quality: "A",
        outcome: rand() < pq ? "CONTINUATION" : "FAILURE",
        relVolume: null, mfeAtr: null, maeAtr: null, fwd20: null, resolveSession: null,
      });
    }
  });
  return out;
}

function blockCI(rs: Row[], allDates: string[], seed: number, b = B) {
  const byDate = new Map<string, Row[]>();
  for (const r of rs) {
    const a = byDate.get(r.sessionDate) ?? [];
    a.push(r);
    byDate.set(r.sessionDate, a);
  }
  const nBlocks = Math.max(1, Math.ceil(allDates.length / BLOCK_SESSIONS));
  const starts = Math.max(1, allDates.length - BLOCK_SESSIONS + 1);
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < b; i++) {
    let c = 0, n = 0;
    for (let k = 0; k < nBlocks; k++) {
      const s0 = Math.floor(rand() * starts);
      for (let d = s0; d < Math.min(s0 + BLOCK_SESSIONS, allDates.length); d++) {
        for (const r of byDate.get(allDates[d]!) ?? []) {
          n++;
          if (r.outcome === "CONTINUATION") c++;
        }
      }
    }
    if (n > 0) draws.push(c / n);
  }
  draws.sort((a, z) => a - z);
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))]!;
  return { lo: q(0.025), hi: q(0.975) };
}

function main(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  const A = scored.filter((r) => r.quality === "A");
  const Bq = scored.filter((r) => r.quality === "B");
  console.log(`§15 RECONCILIATION  resolved ${scored.length} = A ${A.length} + B ${Bq.length}  ${A.length + Bq.length === scored.length ? "OK" : "FAIL"}`);

  // ---- negative controls, before any result ----
  console.log("\n=== §9 NEGATIVE CONTROLS ===");
  const sizes = byQuarter(A).map((g) => g.length);
  const calRand = rng(24680);
  let cov = 0;
  for (let i = 0; i < CAL_RUNS; i++) {
    const syn = syntheticClustered(sizes, REFERENCE, 0.0609, calRand);
    const ci = clusterCI(syn, 2000 + i, 400);
    if (ci.lo <= REFERENCE && REFERENCE <= ci.hi) cov++;
  }
  console.log(`  NC1 cluster-bootstrap CI coverage, synthetic clustered null: ${(100 * cov / CAL_RUNS).toFixed(1)}%  (target 95%, ${CAL_RUNS} runs)`);

  const pr = rng(13579);
  let fp = 0;
  for (let i = 0; i < 400; i++) {
    const sh = scored.map((r) => ({ ...r }));
    const idx = sh.map((_, j) => j);
    for (let j = idx.length - 1; j > 0; j--) {
      const t = Math.floor(pr() * (j + 1));
      [idx[j], idx[t]] = [idx[t]!, idx[j]!];
    }
    idx.forEach((orig, pos) => { sh[orig]!.quality = pos < A.length ? "A" : "B"; });
    if (permP(sh, 9000 + i, 400).p < 0.05) fp++;
  }
  console.log(`  NC2 stratified-permutation empirical FPR at nominal 5%: ${(100 * fp / 400).toFixed(1)}%  (400 runs)`);
  const calOk = cov / CAL_RUNS >= 0.9 && cov / CAL_RUNS <= 0.99 && fp / 400 <= 0.09;
  console.log(`  calibration ${calOk ? "PASS" : "FAIL"}`);
  if (!calOk) { console.log("\nVERDICT: INFERENCE INVALID"); return; }

  // ---- primary comparisons ----
  console.log("\n=== §1/§3 PRIMARY — A vs B (alpha = 0.0167, Bonferroni over 3) ===");
  console.log("id  stratum     nA   nB    A         B         A-B      98.33% CI on A-B      perm p");
  const strata: Array<[string, string, (r: Row) => boolean]> = [
    ["P1", "all", () => true],
    ["P2", "WARNING", (r) => r.gate1 === "WARNING"],
    ["P3", "PASS", (r) => r.gate1 === "PASS"],
  ];
  for (const [id, label, sel] of strata) {
    const rs = scored.filter(sel);
    const a = rs.filter((r) => r.quality === "A");
    const b = rs.filter((r) => r.quality === "B");
    const d = diffCI(rs, 40000 + id.length + label.length);
    const p = permP(rs, 50000 + label.length);
    console.log(
      `${id}  ${label.padEnd(9)} ${String(a.length).padStart(4)} ${String(b.length).padStart(4)}  ${pct(rate(a)).padStart(7)}  ${pct(rate(b)).padStart(7)}  ${(100 * d.lo < 0 && 100 * d.hi > 0 ? "" : "")}${((rate(a) - rate(b)) * 100).toFixed(2).padStart(6)}pp  [${(100 * d.loB).toFixed(2)}, ${(100 * d.hiB).toFixed(2)}]pp  ${p.p.toFixed(4)}`,
    );
  }
  console.log("\n  FAIL stratum (descriptive, too small to test):");
  const fA = scored.filter((r) => r.gate1 === "FAIL" && r.quality === "A");
  const fB = scored.filter((r) => r.gate1 === "FAIL" && r.quality === "B");
  console.log(`    A n=${fA.length} ${pct(rate(fA))}   B n=${fB.length} ${pct(rate(fB))}`);

  // ---- §10 economic criterion ----
  console.log("\n=== §10 ECONOMIC CRITERION — do the labels straddle the 33.33% break-even? ===");
  for (const [id, label, sel] of strata) {
    const rs = scored.filter(sel);
    const a = rs.filter((r) => r.quality === "A");
    const b = rs.filter((r) => r.quality === "B");
    const ca = clusterCI(a, 61000 + label.length);
    const cb = clusterCI(b, 62000 + label.length);
    const straddle = (rate(a) - REFERENCE) * (rate(b) - REFERENCE) < 0;
    console.log(
      `  ${id} ${label.padEnd(9)} A ${pct(rate(a))} [${pct(ca.lo)}, ${pct(ca.hi)}]   B ${pct(rate(b))} [${pct(cb.lo)}, ${pct(cb.hi)}]   straddle break-even? ${straddle ? "YES" : "NO"}`,
    );
  }

  // ---- robustness ----
  console.log("\n=== ROBUSTNESS — moving-block bootstrap, 30-session blocks ===");
  const dates = [...new Set(scored.map((r) => r.sessionDate))].sort();
  for (const [label, rs] of [["A", A], ["B", Bq]] as const) {
    const c = blockCI(rs as Row[], dates, 71000 + label.length);
    console.log(`  ${label}  ${pct(rate(rs as Row[]))}  block-bootstrap 95% CI [${pct(c.lo)}, ${pct(c.hi)}]`);
  }

  // ---- §7 era stability ----
  console.log("\n=== §7 ERA STABILITY (descriptive) ===");
  console.log("era   nA   nB    A         B         A-B");
  for (const e of ["old", "new"] as const) {
    const a = A.filter((r) => era(r.sessionDate) === e);
    const b = Bq.filter((r) => era(r.sessionDate) === e);
    console.log(`${e}  ${String(a.length).padStart(4)} ${String(b.length).padStart(4)}  ${pct(rate(a)).padStart(7)}  ${pct(rate(b)).padStart(7)}  ${((rate(a) - rate(b)) * 100).toFixed(2).padStart(6)}pp`);
  }
  console.log("  within WARNING:");
  for (const e of ["old", "new"] as const) {
    const a = scored.filter((r) => r.gate1 === "WARNING" && r.quality === "A" && era(r.sessionDate) === e);
    const b = scored.filter((r) => r.gate1 === "WARNING" && r.quality === "B" && era(r.sessionDate) === e);
    console.log(`  ${e}  ${String(a.length).padStart(4)} ${String(b.length).padStart(4)}  ${pct(rate(a)).padStart(7)}  ${pct(rate(b)).padStart(7)}  ${((rate(a) - rate(b)) * 100).toFixed(2).padStart(6)}pp`);
  }

  // ---- §4 secondary, H2 ordering ----
  console.log("\n=== §4/H2 SECONDARY OUTCOMES (descriptive ordering) ===");
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);
  console.log("label  failRate   medMFE/ATR  medMAE/ATR  medFwd20   medResolve");
  for (const [label, rs] of [["A", A], ["B", Bq]] as const) {
    const g = rs as Row[];
    const num = (f: (r: Row) => number | null) => g.map(f).filter((x): x is number => x != null);
    console.log(
      `  ${label}    ${pct(1 - rate(g))}    ${med(num((r) => r.mfeAtr)).toFixed(2).padStart(6)}      ${med(num((r) => r.maeAtr)).toFixed(2).padStart(6)}     ${med(num((r) => r.fwd20)).toFixed(2).padStart(6)}%      ${med(num((r) => r.resolveSession))}`,
    );
  }
}

main();
