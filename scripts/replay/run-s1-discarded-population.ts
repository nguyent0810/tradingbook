/**
 * S1 — does Gate 1 discard setups worth studying?
 *
 * Two stages, deliberately separated so the population can be characterised and
 * powered BEFORE any outcome is read:
 *
 *   --stage funnel    population assignment, funnel, cluster counts. Reads no outcome.
 *   --stage outcome   the preregistered test. Only run after the preregistration
 *                     is committed.
 *
 * Population assignment reuses PRODUCTION `deriveGate1SurfacingRule` — the same
 * function the daily scan, the library path and the replay all call. Gate 1 and
 * Gate 2 are not reimplemented here: the input rows were produced by
 * `run-continuation-study.ts`, which calls `evaluateMarketRegime` and
 * `evaluateBreakoutPullbackCandidate` directly and — importantly — does NOT apply
 * the Gate 1 surfacing filter, so both populations survive in its output.
 *
 *   npx tsx scripts/replay/run-s1-discarded-population.ts --stage funnel
 */
import "../load-env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deriveGate1SurfacingRule } from "../../src/lib/scanner/gate2/collect-candidates";
import type { Gate1Level } from "../../src/lib/scanner/gate2/types";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Row = {
  sessionDate: string;
  symbol: string;
  quality: "A" | "B";
  gate1: Gate1Level;
  breakoutLevel: number;
  stopFeasible: boolean | null;
  outcome: string | null;
  mfeAtr: number | null;
  maeAtr: number | null;
  fwd20: number | null;
  resolveSession: number | null;
};

export type Population = "RETAINED" | "DISCARDED";

/**
 * V1's actual surfacing decision, from production's single source of truth.
 * `none` drops everything; `tier-a-only` drops B; `all` keeps both.
 */
export function assignPopulation(gate1: Gate1Level, quality: "A" | "B"): Population {
  const rule = deriveGate1SurfacingRule(gate1);
  if (rule === "none") return "DISCARDED";
  if (rule === "tier-a-only") return quality === "A" ? "RETAINED" : "DISCARDED";
  return "RETAINED";
}

/** §1 dedup of the frozen continuation-study preregistration. */
function dedupe(rows: Row[]): Row[] {
  const bySymbol = new Map<string, Row[]>();
  for (const r of [...rows].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))) {
    const arr = bySymbol.get(r.symbol) ?? [];
    arr.push(r);
    bySymbol.set(r.symbol, arr);
  }
  const kept: Row[] = [];
  for (const [, arr] of bySymbol) {
    const anchors: Row[] = [];
    for (const r of arr) {
      const dup = anchors.some(
        (a) =>
          a.breakoutLevel > 0 &&
          Math.abs(r.breakoutLevel - a.breakoutLevel) / a.breakoutLevel <= 0.005 &&
          (Date.parse(r.sessionDate) - Date.parse(a.sessionDate)) / 86_400_000 <=
            GATE2_RANGE_DAYS * 1.45,
      );
      if (!dup) anchors.push(r);
    }
    kept.push(...anchors);
  }
  return kept.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

const quarter = (d: string) => `${d.slice(0, 4)}Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const era = (d: string) => (d < "2022-01-01" ? "old" : "new");

function counts(rows: Row[]) {
  return {
    setups: rows.length,
    symbols: new Set(rows.map((r) => r.symbol)).size,
    dates: new Set(rows.map((r) => r.sessionDate)).size,
    months: new Set(rows.map((r) => r.sessionDate.slice(0, 7))).size,
    quarters: new Set(rows.map((r) => quarter(r.sessionDate))).size,
  };
}

function main(): void {
  const stage = arg("stage") ?? "funnel";
  const src = arg("setups") ?? "docs/trading/replay/continuation/setups.ndjson";
  const outDir = arg("out") ?? "docs/trading/replay/s1";

  const raw: Row[] = readFileSync(src, "utf-8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));

  console.log(`source ${src} · raw Gate-2-valid setups = ${raw.length}`);

  // ---- §1 reconciliation: every setup lands in exactly one population ----
  const withPop = raw.map((r) => ({ ...r, population: assignPopulation(r.gate1, r.quality) }));
  const retained = withPop.filter((r) => r.population === "RETAINED");
  const discarded = withPop.filter((r) => r.population === "DISCARDED");
  if (retained.length + discarded.length !== raw.length) {
    throw new Error("population reconciliation failed");
  }
  console.log(
    `RECONCILIATION raw ${raw.length} = RETAINED ${retained.length} + DISCARDED ${discarded.length}  OK`,
  );

  // ---- §8 why discarded (descriptive) ----
  console.log("\nWHY DISCARDED (raw rows)");
  const why = new Map<string, number>();
  for (const r of discarded) {
    const k = r.gate1 === "FAIL" ? `FAIL (rule=none), tier ${r.quality}` : `WARNING (rule=tier-a-only), tier B`;
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...why.entries()].sort()) console.log(`  ${k}: ${v}`);

  console.log("\nRETAINED COMPOSITION (raw rows)");
  const rc = new Map<string, number>();
  for (const r of retained) {
    const k = `${r.gate1} × ${r.quality}`;
    rc.set(k, (rc.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...rc.entries()].sort()) console.log(`  ${k}: ${v}`);

  // ---- dedup, then the funnel that matters ----
  const uniq = dedupe(withPop as Row[]).map((r) => ({
    ...r,
    population: assignPopulation(r.gate1, r.quality),
  }));
  const uR = uniq.filter((r) => r.population === "RETAINED");
  const uD = uniq.filter((r) => r.population === "DISCARDED");
  const scored = (rs: typeof uniq) =>
    rs.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");

  console.log("\n§11 FUNNEL");
  console.log(`  Gate-2-valid setups (raw)        ${raw.length}`);
  console.log(`  after frozen dedup               ${uniq.length}`);
  console.log(`    RETAINED                       ${uR.length}`);
  console.log(`    DISCARDED                      ${uD.length}  (${((100 * uD.length) / uniq.length).toFixed(1)}%)`);
  console.log(`  resolved (CONTINUATION|FAILURE)  ${scored(uniq).length}`);
  console.log(`    RETAINED resolved              ${scored(uR).length}`);
  console.log(`    DISCARDED resolved             ${scored(uD).length}`);

  console.log("\n§9 EFFECTIVE INFORMATION UNITS (resolved setups)");
  for (const [label, rs] of [
    ["ALL", scored(uniq)],
    ["RETAINED", scored(uR)],
    ["DISCARDED", scored(uD)],
  ] as const) {
    const c = counts(rs as Row[]);
    console.log(
      `  ${label.padEnd(10)} setups=${String(c.setups).padStart(4)} symbols=${String(c.symbols).padStart(4)} dates=${String(c.dates).padStart(4)} months=${String(c.months).padStart(4)} quarters=${String(c.quarters).padStart(3)}`,
    );
  }

  console.log("\nERA SPLIT (resolved setups, counts only)");
  for (const [label, rs] of [
    ["RETAINED", scored(uR)],
    ["DISCARDED", scored(uD)],
  ] as const) {
    const o = (rs as Row[]).filter((r) => era(r.sessionDate) === "old").length;
    const n = (rs as Row[]).filter((r) => era(r.sessionDate) === "new").length;
    console.log(`  ${label.padEnd(10)} old=${o} new=${n}`);
  }

  console.log("\nSTOP FEASIBILITY (population characteristic, not an outcome)");
  for (const [label, rs] of [
    ["RETAINED", scored(uR)],
    ["DISCARDED", scored(uD)],
  ] as const) {
    const f = (rs as Row[]).filter((r) => r.stopFeasible === true).length;
    console.log(`  ${label.padEnd(10)} feasible=${f}/${rs.length} (${((100 * f) / rs.length).toFixed(1)}%)`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    `${outDir}/populations.ndjson`,
    uniq.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  console.log(`\nwrote ${outDir}/populations.ndjson (${uniq.length} unique setups with population labels)`);

  if (stage === "funnel") {
    console.log("\nstage=funnel — no outcome was read beyond resolved/unresolved counts.");
    return;
  }
  console.log("\nstage=outcome — run scripts/replay/run-s1-outcome.ts");
}

main();
