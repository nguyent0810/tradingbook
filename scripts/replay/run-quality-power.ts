/**
 * Phase 14.5 §12 — power for the quality-label test, computed from population
 * counts before any new inference is run. Reads no outcome field beyond
 * resolved / unresolved.
 *
 *   npx tsx scripts/replay/run-quality-power.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";

const ICC_QUARTER = 0.0609;
const BREAKEVEN = 1 / 3;
const Z975 = 1.96;
const Z80 = 0.8416;
/** two-sided alpha = 0.0167, Bonferroni over the three primary comparisons */
const BONFERRONI_Z = 2.394;

type Row = {
  sessionDate: string;
  symbol: string;
  gate1: string;
  quality: "A" | "B";
  outcome: string | null;
};
const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;

function se(n: number, clusters: number, p = BREAKEVEN): number {
  if (n === 0 || clusters === 0) return NaN;
  const m = n / clusters;
  const deff = 1 + Math.max(0, m - 1) * ICC_QUARTER;
  return Math.sqrt((p * (1 - p)) / n) * Math.sqrt(deff);
}

function main(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");

  console.log(`resolved setups ${scored.length} · ICC(quarter) ${ICC_QUARTER}\n`);
  console.log("cell               n   symbols  dates  months  quarters   SE(qtr)");

  const cellSE = new Map<string, number>();
  const defs: Array<[string, (r: Row) => boolean]> = [
    ["P1 all A", (r) => r.quality === "A"],
    ["P1 all B", (r) => r.quality === "B"],
    ["P2 WARN A", (r) => r.gate1 === "WARNING" && r.quality === "A"],
    ["P2 WARN B", (r) => r.gate1 === "WARNING" && r.quality === "B"],
    ["P3 PASS A", (r) => r.gate1 === "PASS" && r.quality === "A"],
    ["P3 PASS B", (r) => r.gate1 === "PASS" && r.quality === "B"],
    ["   FAIL A", (r) => r.gate1 === "FAIL" && r.quality === "A"],
    ["   FAIL B", (r) => r.gate1 === "FAIL" && r.quality === "B"],
  ];
  for (const [label, sel] of defs) {
    const rs = scored.filter(sel);
    const q = new Set(rs.map((r) => quarter(r.sessionDate))).size;
    const s = se(rs.length, q);
    cellSE.set(label, s);
    console.log(
      `${label.padEnd(12)} ${String(rs.length).padStart(4)}  ${String(new Set(rs.map((r) => r.symbol)).size).padStart(6)}  ${String(new Set(rs.map((r) => r.sessionDate)).size).padStart(5)}  ${String(new Set(rs.map((r) => r.sessionDate.slice(0, 7))).size).padStart(6)}  ${String(q).padStart(8)}   ${(100 * s).toFixed(2)}pp`,
    );
  }

  console.log("\nA-MINUS-B PRECISION (quarter-clustered, independent-sample approximation)");
  console.log("comparison    SE_diff    MDE80 a=.05    MDE80 a=.0167");
  for (const [label, a, b] of [
    ["P1 all", "P1 all A", "P1 all B"],
    ["P2 WARNING", "P2 WARN A", "P2 WARN B"],
    ["P3 PASS", "P3 PASS A", "P3 PASS B"],
  ] as const) {
    const sa = cellSE.get(a)!;
    const sb = cellSE.get(b)!;
    const sd = Math.sqrt(sa * sa + sb * sb);
    console.log(
      `${label.padEnd(12)}  ${(100 * sd).toFixed(2)}pp     ${(100 * (Z975 + Z80) * sd).toFixed(2)}pp        ${(100 * (BONFERRONI_Z + Z80) * sd).toFixed(2)}pp`,
    );
  }

  console.log("\nCOMPONENT CELLS (§6 decomposition, counts only — no outcome read)");
  console.log("  quality A requires volRatio >= 1.5 AND close >= MA20; B is everything else");
  console.log("  the 2x2 cannot be reconstructed from the stored label alone; see preregistration");

  console.log("\nECONOMIC ANCHOR");
  console.log(`  break-even at the frozen 2:1 race: ${(100 * BREAKEVEN).toFixed(2)}%`);
  console.log("  the dual role does real work only if the two labels sit on OPPOSITE sides of it");
  console.log("  (one fundable, one not). Same side means the label is not what decides.");
}

main();
