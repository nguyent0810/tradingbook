import "../load-env";
import { readFileSync } from "node:fs";
import { ROUND_TRIP_FEE_FRAC } from "../../src/lib/scanner/stop-feasibility";
const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : `${(100 * x).toFixed(2)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qtl = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN; };
type S = { session: string; symbol: string; feasibility: string; fwd5: number | null; fwdBars: number; riskFrac: number | null };
const rows = readFileSync("docs/trading/replay/postbackfill/setups.ndjson", "utf-8").trim().split(/\r?\n/).filter(Boolean)
  .map((l) => JSON.parse(l) as S)
  .filter((r) => (r.feasibility === "FEASIBLE" || r.feasibility === "NOT_FEASIBLE_NOISE") && r.fwdBars >= 5 && r.fwd5 != null && r.riskFrac != null);
const br = new Map<string, number>(readFileSync("docs/trading/replay/postbackfill/breadth.ndjson", "utf-8").trim().split(/\r?\n/).filter(Boolean)
  .map((l) => { const b = JSON.parse(l) as { session: string; advShare: number }; return [b.session, b.advShare]; }));
const sh = [...br.values()];
const p10 = qtl(sh, 0.1), p90 = qtl(sh, 0.9);
const coh = (d: string) => { const a = br.get(d); return a == null ? "?" : a >= p90 ? "strong" : a <= p10 ? "weak" : "mid"; };
const F = (r: S) => r.feasibility === "FEASIBLE";
const delta = (rs: S[]) => { const f = rs.filter(F).map((r) => r.fwd5!); const n = rs.filter((r) => !F(r)).map((r) => r.fwd5!); return f.length && n.length ? mean(f) - mean(n) : NaN; };
const medDelta = (rs: S[]) => { const f = rs.filter(F).map((r) => r.fwd5!); const n = rs.filter((r) => !F(r)).map((r) => r.fwd5!); return f.length && n.length ? qtl(f, 0.5) - qtl(n, 0.5) : NaN; };
const trimMean = (xs: number[], t = 0.1) => { const s = [...xs].sort((a, b) => a - b); const k = Math.floor(t * s.length); return mean(s.slice(k, s.length - k)); };

console.log("== REVIEWER #3: combine strong+weak into 'non-ordinary' to clear n>=30 ==");
const nonOrd = rows.filter((r) => coh(r.session) === "strong" || coh(r.session) === "weak");
const strong = rows.filter((r) => coh(r.session) === "strong");
const weak = rows.filter((r) => coh(r.session) === "weak");
for (const [nm, rs] of [["strong", strong], ["weak", weak], ["strong+weak", nonOrd]] as const) {
  const nF = rs.filter(F).length, nN = rs.length - rs.filter(F).length;
  console.log(`  ${nm.padEnd(12)} nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  delta ${pct(delta(rs)).padStart(8)}  ${nN >= 30 ? "(clears 30/arm)" : "(STILL below 30 in the noise arm)"}`);
}

console.log("\n== REVIEWER #10: outlier sensitivity of the small noise arm ==");
const f5 = rows.filter(F).map((r) => r.fwd5!), n5 = rows.filter((r) => !F(r)).map((r) => r.fwd5!);
console.log(`  mean delta          ${pct(mean(f5) - mean(n5))}`);
console.log(`  median delta        ${pct(qtl(f5, 0.5) - qtl(n5, 0.5))}`);
console.log(`  10% trimmed-mean    ${pct(trimMean(f5) - trimMean(n5))}`);
console.log(`  noise arm: min ${pct(Math.min(...n5))} p10 ${pct(qtl(n5,0.1))} med ${pct(qtl(n5,0.5))} p90 ${pct(qtl(n5,0.9))} max ${pct(Math.max(...n5))}`);

console.log("\n== REVIEWER #6: does the CI lower bound cover the repo's own trading cost? ==");
console.log(`  ROUND_TRIP_FEE_FRAC (production constant) = ${pct(ROUND_TRIP_FEE_FRAC)}`);
console.log(`  primary CI lower bound                    = ${pct(0.0013)}`);
console.log(`  point estimate                            = ${pct(0.0119)}`);
console.log(`  lower bound covers round-trip cost?         ${0.0013 >= ROUND_TRIP_FEE_FRAC ? "YES" : "NO"}`);
console.log(`  point estimate covers round-trip cost?      ${0.0119 >= ROUND_TRIP_FEE_FRAC ? "YES" : "NO"}`);

console.log("\n== REVIEWER #11: MFE/MAE window vs the T+5 endpoint ==");
console.log("  MFE/MAE were measured over 20 sessions while the primary is T+5.");
console.log("  Secondary only, and barred from rescuing the primary - but the mismatch is real and noted.");
