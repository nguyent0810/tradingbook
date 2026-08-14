/**
 * S1 outcome test. Executes S1-DISCARDED-CANDIDATE-PREREGISTRATION.md, committed
 * at `ef870aa` before any outcome was split by population.
 *
 * Inference is quarter-clustered throughout, per the protocol frozen at 9738e69:
 *   H1  P(cont | DISCARDED) vs the 33.3% economic reference  — cluster bootstrap CI
 *   H2  DISCARDED - RETAINED                                  — stratified permutation
 * Both estimators are calibrated against negative controls BEFORE their results
 * are read, and the run aborts if calibration fails.
 *
 *   npx tsx scripts/replay/run-s1-outcome.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";

const REFERENCE = 1 / 3;
const B = 20_000; // bootstrap / permutation replicates
const CAL_RUNS = 2_000;

type Row = {
  sessionDate: string;
  symbol: string;
  quality: "A" | "B";
  gate1: "PASS" | "WARNING" | "FAIL";
  population: "RETAINED" | "DISCARDED";
  outcome: string | null;
  stopFeasible: boolean | null;
  mfeAtr: number | null;
  maeAtr: number | null;
  fwd20: number | null;
  resolveSession: number | null;
};

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const era = (d: string) => (d < "2022-01-01" ? "old" : "new");
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

/**
 * Deterministic PRNG. `Math.random` is unavailable to workflow scripts and a
 * fixed seed makes every interval in the artifact reproducible.
 */
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

function groupByQuarter(rs: Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rs) {
    const k = quarter(r.sessionDate);
    const a = m.get(k) ?? [];
    a.push(r);
    m.set(k, a);
  }
  return m;
}

/** Cluster bootstrap over quarters; returns percentile interval of the pooled rate. */
function clusterBootstrapCI(rs: Row[], seed: number, b = B): { lo: number; hi: number; se: number } {
  const groups = [...groupByQuarter(rs).values()];
  const k = groups.length;
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < b; i++) {
    let cont = 0;
    let n = 0;
    for (let j = 0; j < k; j++) {
      const g = groups[Math.floor(rand() * k)]!;
      for (const r of g) {
        n++;
        if (r.outcome === "CONTINUATION") cont++;
      }
    }
    if (n > 0) draws.push(cont / n);
  }
  draws.sort((a, z) => a - z);
  const mean = draws.reduce((a, x) => a + x, 0) / draws.length;
  const se = Math.sqrt(draws.reduce((a, x) => a + (x - mean) ** 2, 0) / (draws.length - 1));
  return { lo: draws[Math.floor(0.025 * draws.length)]!, hi: draws[Math.floor(0.975 * draws.length)]!, se };
}

/**
 * Stratified permutation of the population label WITHIN quarter. Conditions on
 * quarter, so between-quarter variation cannot masquerade as a population effect.
 */
function stratifiedPermutationP(rs: Row[], seed: number, b = B): { diff: number; p: number } {
  const observed = rate(rs.filter((r) => r.population === "DISCARDED")) - rate(rs.filter((r) => r.population === "RETAINED"));
  const groups = [...groupByQuarter(rs).values()];
  const rand = rng(seed);
  let atLeast = 0;
  for (let i = 0; i < b; i++) {
    let dc = 0, dn = 0, rc = 0, rn = 0;
    for (const g of groups) {
      const labels = g.map((r) => r.population);
      for (let j = labels.length - 1; j > 0; j--) {
        const t = Math.floor(rand() * (j + 1));
        [labels[j], labels[t]] = [labels[t]!, labels[j]!];
      }
      for (let j = 0; j < g.length; j++) {
        const isCont = g[j]!.outcome === "CONTINUATION" ? 1 : 0;
        if (labels[j] === "DISCARDED") { dn++; dc += isCont; } else { rn++; rc += isCont; }
      }
    }
    if (dn > 0 && rn > 0 && Math.abs(dc / dn - rc / rn) >= Math.abs(observed)) atLeast++;
  }
  return { diff: observed, p: (atLeast + 1) / (b + 1) };
}

// ---------------------------------------------------------------- calibration

/** Synthetic clustered binary data with a beta-binomial cluster effect. */
function syntheticClustered(
  sizes: number[],
  p: number,
  icc: number,
  rand: () => number,
): Row[] {
  // beta-binomial: Var(cluster p) = p(1-p) * icc  ->  a+b = 1/icc - 1
  const conc = Math.max(0.01, 1 / icc - 1);
  const a = p * conc;
  const bb = (1 - p) * conc;
  const gamma = (shape: number): number => {
    // Marsaglia-Tsang; shape >= 1 branch with the standard boost for shape < 1.
    if (shape < 1) return gamma(shape + 1) * Math.pow(rand(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = 0, v = 0;
      do {
        const u1 = Math.max(1e-12, rand());
        const u2 = Math.max(1e-12, rand());
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
    const g1 = gamma(a), g2 = gamma(bb);
    const pq = g1 / (g1 + g2);
    for (let i = 0; i < n; i++) {
      out.push({
        sessionDate: `20${String(15 + Math.floor(qi / 4)).padStart(2, "0")}-${String(1 + 3 * (qi % 4)).padStart(2, "0")}-01`,
        symbol: `S${i}`,
        quality: "A",
        gate1: "PASS",
        population: "DISCARDED",
        outcome: rand() < pq ? "CONTINUATION" : "FAILURE",
        stopFeasible: true, mfeAtr: null, maeAtr: null, fwd20: null, resolveSession: null,
      });
    }
  });
  return out;
}

function main(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  const D = scored.filter((r) => r.population === "DISCARDED");
  const R = scored.filter((r) => r.population === "RETAINED");

  console.log(`resolved ${scored.length} = RETAINED ${R.length} + DISCARDED ${D.length}`);
  if (R.length + D.length !== scored.length) throw new Error("reconciliation failed");

  // ---------------- §6 calibration, BEFORE any result is read ----------------
  console.log("\n=== NEGATIVE CONTROLS (run before results are interpreted) ===");
  const sizes = [...groupByQuarter(D).values()].map((g) => g.length);
  const calRand = rng(99991);
  let covered = 0;
  for (let i = 0; i < CAL_RUNS; i++) {
    const syn = syntheticClustered(sizes, REFERENCE, 0.0609, calRand);
    const ci = clusterBootstrapCI(syn, 1000 + i, 400);
    if (ci.lo <= REFERENCE && REFERENCE <= ci.hi) covered++;
  }
  const coverage = covered / CAL_RUNS;
  console.log(`  NC1 cluster-bootstrap CI coverage on synthetic clustered null (target 95%): ${(100 * coverage).toFixed(1)}%  [${CAL_RUNS} runs]`);

  const permRand = rng(4242);
  let falsePos = 0;
  for (let i = 0; i < 400; i++) {
    const shuffled = scored.map((r) => ({ ...r }));
    // random population labels preserving the observed marginal count
    const idx = shuffled.map((_, j) => j);
    for (let j = idx.length - 1; j > 0; j--) {
      const t = Math.floor(permRand() * (j + 1));
      [idx[j], idx[t]] = [idx[t]!, idx[j]!];
    }
    idx.forEach((orig, pos) => { shuffled[orig]!.population = pos < D.length ? "DISCARDED" : "RETAINED"; });
    if (stratifiedPermutationP(shuffled, 7000 + i, 400).p < 0.05) falsePos++;
  }
  const fpr = falsePos / 400;
  console.log(`  NC2 stratified-permutation empirical FPR at nominal 5%: ${(100 * fpr).toFixed(1)}%  [400 runs]`);

  const calOk = coverage >= 0.90 && coverage <= 0.99 && fpr <= 0.09;
  console.log(`  calibration ${calOk ? "PASS" : "FAIL"}`);
  if (!calOk) {
    console.log("\nVERDICT: INFERENCE INVALID — estimators do not reproduce nominal levels.");
    return;
  }

  // ---------------- H1 ----------------
  console.log("\n=== H1 — P(continuation | DISCARDED) vs the 33.3% economic reference ===");
  const pD = rate(D);
  const ciD = clusterBootstrapCI(D, 20250814);
  console.log(`  point estimate ${pct(pD)}  (${D.filter((r) => r.outcome === "CONTINUATION").length}/${D.length})`);
  console.log(`  95% cluster-bootstrap CI [${pct(ciD.lo)}, ${pct(ciD.hi)}]   SE ${pct(ciD.se)}`);
  console.log(`  reference 33.33% — CI upper below reference? ${ciD.hi < REFERENCE ? "YES" : "no"} · CI lower at/above? ${ciD.lo >= REFERENCE ? "YES" : "no"}`);

  // ---------------- H2 ----------------
  console.log("\n=== H2 — DISCARDED minus RETAINED (declared underpowered in advance) ===");
  const pR = rate(R);
  const ciR = clusterBootstrapCI(R, 20250815);
  const perm = stratifiedPermutationP(scored, 20250816);
  console.log(`  RETAINED  ${pct(pR)}  (${R.filter((r) => r.outcome === "CONTINUATION").length}/${R.length})  95% CI [${pct(ciR.lo)}, ${pct(ciR.hi)}]`);
  console.log(`  DISCARDED ${pct(pD)}  (${D.filter((r) => r.outcome === "CONTINUATION").length}/${D.length})`);
  console.log(`  difference ${(100 * perm.diff).toFixed(2)}pp   stratified permutation p = ${perm.p.toFixed(4)}`);

  // ---------------- §7 era breakdown, descriptive ----------------
  console.log("\n=== §7 ERA BREAKDOWN (descriptive, no significance claim) ===");
  console.log("population   era    n    P(cont)     95% CI");
  for (const pop of ["RETAINED", "DISCARDED"] as const) {
    for (const e of ["old", "new"] as const) {
      const rs = scored.filter((r) => r.population === pop && era(r.sessionDate) === e);
      const ci = clusterBootstrapCI(rs, 31337 + rs.length);
      console.log(`${pop.padEnd(11)} ${e}   ${String(rs.length).padStart(4)}   ${pct(rate(rs)).padStart(7)}   [${pct(ci.lo)}, ${pct(ci.hi)}]`);
    }
  }

  // ---------------- §8 why discarded, descriptive ----------------
  console.log("\n=== §8 DISCARD REASON (descriptive — no subgroup claim) ===");
  for (const key of ["WARNING|B", "FAIL|A", "FAIL|B"]) {
    const [g, q] = key.split("|");
    const rs = D.filter((r) => r.gate1 === g && r.quality === q);
    if (rs.length === 0) continue;
    console.log(`  ${key.padEnd(10)} n=${String(rs.length).padStart(3)}  P(cont)=${pct(rate(rs))}`);
  }
  console.log("  RETAINED composition:");
  for (const key of ["PASS|A", "PASS|B", "WARNING|A"]) {
    const [g, q] = key.split("|");
    const rs = R.filter((r) => r.gate1 === g && r.quality === q);
    console.log(`  ${key.padEnd(10)} n=${String(rs.length).padStart(3)}  P(cont)=${pct(rate(rs))}`);
  }

  // ---------------- outlier dependence ----------------
  console.log("\n=== OUTLIER DEPENDENCE ===");
  const contByQ = new Map<string, number>();
  for (const r of D) if (r.outcome === "CONTINUATION") contByQ.set(quarter(r.sessionDate), (contByQ.get(quarter(r.sessionDate)) ?? 0) + 1);
  const totalCont = [...contByQ.values()].reduce((a, x) => a + x, 0);
  const top = [...contByQ.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(`  DISCARDED continuations ${totalCont}; largest quarter ${top?.[0]} contributes ${top?.[1]} (${((100 * (top?.[1] ?? 0)) / totalCont).toFixed(1)}%)  — threshold 20%`);

  // ---------------- secondary descriptive ----------------
  console.log("\n=== SECONDARY (descriptive only) ===");
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);
  for (const [label, rs] of [["RETAINED", R], ["DISCARDED", D]] as const) {
    const mfe = rs.map((r) => r.mfeAtr).filter((x): x is number => x != null);
    const mae = rs.map((r) => r.maeAtr).filter((x): x is number => x != null);
    const fwd = rs.map((r) => r.fwd20).filter((x): x is number => x != null);
    const res = rs.map((r) => r.resolveSession).filter((x): x is number => x != null);
    const feas = rs.filter((r) => r.stopFeasible === true);
    console.log(
      `  ${label.padEnd(10)} medMFE/ATR ${med(mfe).toFixed(2)}  medMAE/ATR ${med(mae).toFixed(2)}  medFwd20 ${med(fwd).toFixed(2)}%  medResolve ${med(res)}  P(cont|stopFeasible) ${pct(rate(feas))} (n=${feas.length})`,
    );
  }
}

main();

/**
 * Addendum — the confound S1's design creates by construction.
 *
 * DISCARDED contains no PASS setups (PASS surfaces both tiers), so comparing the
 * populations also compares market states. The like-for-like comparison holds the
 * market state fixed: inside WARNING, tier A is retained and tier B is discarded.
 * Descriptive per §8; no test, no subgroup claim.
 */
export function withinWarningAddendum(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  console.log("\n=== ADDENDUM — like-for-like inside WARNING (descriptive) ===");
  for (const e of [null, "old", "new"] as const) {
    const sel = (q: "A" | "B") =>
      scored.filter((r) => r.gate1 === "WARNING" && r.quality === q && (e ? era(r.sessionDate) === e : true));
    const a = sel("A"), b = sel("B");
    const ca = clusterBootstrapCI(a, 555), cb = clusterBootstrapCI(b, 556);
    console.log(
      `  ${(e ?? "all").padEnd(4)} WARNING×A (retained) n=${String(a.length).padStart(3)} ${pct(rate(a))} [${pct(ca.lo)}, ${pct(ca.hi)}]   ` +
      `WARNING×B (discarded) n=${String(b.length).padStart(3)} ${pct(rate(b))} [${pct(cb.lo)}, ${pct(cb.hi)}]   diff ${((rate(b) - rate(a)) * 100).toFixed(2)}pp`,
    );
  }
  console.log("\n  Market-state composition, by construction:");
  for (const pop of ["RETAINED", "DISCARDED"] as const) {
    const rs = scored.filter((r) => r.population === pop);
    const c = (g: string) => rs.filter((r) => r.gate1 === g).length;
    console.log(`    ${pop.padEnd(10)} PASS=${c("PASS")} WARNING=${c("WARNING")} FAIL=${c("FAIL")}`);
  }
}
withinWarningAddendum();
