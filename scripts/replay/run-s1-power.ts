/**
 * S1 §6 — power, computed BEFORE any outcome is read, from population counts and
 * the ICC measured in phase 13 (`audit-oos-clustering.ts`).
 *
 * Reads population labels only. It never touches the outcome field.
 *
 *   npx tsx scripts/replay/run-s1-power.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";

const ICC_MONTH = 0.0829;
const ICC_QUARTER = 0.0609;
const BREAKEVEN = 1 / 3;
const Z975 = 1.96;
const Z95 = 1.6449;
const Z80 = 0.8416;

type Row = { sessionDate: string; population: "RETAINED" | "DISCARDED"; outcome: string | null };

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const era = (d: string) => (d < "2022-01-01" ? "old" : "new");

/** SE of a proportion under cluster sampling, at the assumed null rate. */
function se(n: number, clusters: number, icc: number, p = BREAKEVEN): number {
  if (n === 0 || clusters === 0) return NaN;
  const m = n / clusters;
  const deff = 1 + Math.max(0, m - 1) * icc;
  return Math.sqrt((p * (1 - p)) / n) * Math.sqrt(deff);
}

function main(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");

  const slice = (pop: Row["population"], e?: "old" | "new") =>
    scored.filter((r) => r.population === pop && (e ? era(r.sessionDate) === e : true));

  console.log(`ICC month=${ICC_MONTH} quarter=${ICC_QUARTER} · economic reference=${(100 * BREAKEVEN).toFixed(1)}%\n`);

  const cells: Array<[string, Row[]]> = [
    ["DISCARDED all", slice("DISCARDED")],
    ["DISCARDED old", slice("DISCARDED", "old")],
    ["DISCARDED new", slice("DISCARDED", "new")],
    ["RETAINED all", slice("RETAINED")],
    ["RETAINED old", slice("RETAINED", "old")],
    ["RETAINED new", slice("RETAINED", "new")],
  ];

  console.log("ONE-SAMPLE PRECISION AGAINST A FIXED REFERENCE");
  console.log("cell             n   months  quarters   SE(mo)   SE(qtr)   MDE80 1-sided(qtr)");
  const seByCell = new Map<string, { m: number; q: number }>();
  for (const [label, rs] of cells) {
    const months = new Set(rs.map((r) => r.sessionDate.slice(0, 7))).size;
    const quarters = new Set(rs.map((r) => quarter(r.sessionDate))).size;
    const sm = se(rs.length, months, ICC_MONTH);
    const sq = se(rs.length, quarters, ICC_QUARTER);
    seByCell.set(label, { m: sm, q: sq });
    console.log(
      `${label.padEnd(15)} ${String(rs.length).padStart(3)}   ${String(months).padStart(5)}   ${String(quarters).padStart(7)}   ${(100 * sm).toFixed(2)}pp   ${(100 * sq).toFixed(2)}pp   ${(100 * (Z95 + Z80) * sq).toFixed(2)}pp`,
    );
  }

  console.log("\nTWO-SAMPLE PRECISION, DISCARDED vs RETAINED");
  console.log("comparison        SE_diff(qtr)   MDE80 2-sided   MDE80 1-sided");
  for (const e of ["all", "old", "new"] as const) {
    const dk = `DISCARDED ${e}`;
    const rk = `RETAINED ${e}`;
    const sd = seByCell.get(dk)!.q;
    const sr = seByCell.get(rk)!.q;
    const sdiff = Math.sqrt(sd * sd + sr * sr);
    console.log(
      `${e.padEnd(16)}  ${(100 * sdiff).toFixed(2)}pp        ${(100 * (Z975 + Z80) * sdiff).toFixed(2)}pp          ${(100 * (Z95 + Z80) * sdiff).toFixed(2)}pp`,
    );
  }

  console.log("\nWHAT THE PRIMARY CELL CAN RESOLVE (DISCARDED all, quarter-clustered)");
  const s = seByCell.get("DISCARDED all")!.q;
  console.log(`  reject 'rate >= 33.3%' at 80% power if the true rate is at or below ${(100 * (BREAKEVEN - (Z95 + Z80) * s)).toFixed(1)}%`);
  console.log(`  establish 'rate > 33.3%' at 80% power if the true rate is at or above ${(100 * (BREAKEVEN + (Z95 + Z80) * s)).toFixed(1)}%`);
  console.log(`  95% CI half-width at the reference rate: ±${(100 * Z975 * s).toFixed(2)}pp`);

  console.log("\nREFERENCE POINTS (already published, not S1 outcomes)");
  console.log("  union of both populations: old 40.8% -> new 27.1%, pooled");
  console.log("  economic reference at the frozen 2:1 race: 33.3%");
}

main();
