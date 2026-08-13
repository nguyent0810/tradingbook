/**
 * READ-ONLY: classify every session on two independent axes — the cap-weighted
 * index and the equal-weighted cross-section — and describe the resulting
 * regimes structurally.
 *
 * This run produces the classification ONLY. No strategy outcome is read here,
 * by design: the regime definition is frozen and committed before any outcome is
 * overlaid, so the classification cannot be tuned to the result.
 *
 *   npx tsx scripts/replay/run-regime-classification.ts --out docs/trading/replay/regimes
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { classifyRegime, isDivergent, toRuns, transitionStats, REGIMES, type Regime } from "../../src/lib/research/market-regime";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Internal = {
  sessionDate: string; indexClose: number; indexMa50: number | null; n: number;
  pctAboveMa10: number | null; pctAboveMa20: number | null; pctAboveMa50: number | null;
  pctUp20d: number | null; advancing: number; declining: number; advDeclRatio: number | null;
  newHighs: number; newLows: number; nWithYear: number;
  pctVolumeExpanding: number | null; upVolumeShare: number | null;
  ewDailyMeanPct: number | null; ewDailyMedianPct: number | null;
  ewCohortMeanPct: number | null; cohortEligible: number;
  r20Median: number | null; r20Iqr: number | null;
};

const MIN_UNIVERSE = 100;
const ERA = (d: string) => (d < "2015-01-01" ? "pre-2015" : d < "2022-01-01" ? "2015-2021" : "2022-2026");

function main(): void {
  const outDir = arg("out") ?? "docs/trading/replay/regimes";
  const cutoff = Number(arg("breadth-cutoff") ?? 50);

  const rows: Internal[] = readFileSync("docs/trading/replay/recovery/internals.ndjson", "utf8")
    .trim().split("\n").map((l) => JSON.parse(l) as Internal);

  const gate1ByDate = new Map<string, string>();
  for (const l of readFileSync("docs/trading/replay/leadership/observations.ndjson", "utf8").trim().split("\n")) {
    const o = JSON.parse(l) as { sessionDate: string; gate1Level: string };
    if (!gate1ByDate.has(o.sessionDate)) gate1ByDate.set(o.sessionDate, o.gate1Level);
  }

  const classified = rows.map((r) => {
    const c = classifyRegime(
      { indexClose: r.indexClose, indexMa50: r.indexMa50, pctAboveMa50: r.pctAboveMa50, universeN: r.n },
      { minUniverse: MIN_UNIVERSE, breadthCutoffPct: cutoff }
    );
    return {
      sessionDate: r.sessionDate, era: ERA(r.sessionDate),
      regime: c?.regime ?? null, index: c?.index ?? null, breadth: c?.breadth ?? null,
      divergent: c ? isDivergent(c) : null,
      gate1: gate1ByDate.get(r.sessionDate) ?? null,
      indexClose: r.indexClose, pctAboveMa10: r.pctAboveMa10, pctAboveMa20: r.pctAboveMa20,
      pctAboveMa50: r.pctAboveMa50, advDeclRatio: r.advDeclRatio,
      newHighRate: r.nWithYear > 0 ? (r.newHighs / r.nWithYear) * 100 : null,
      newLowRate: r.nWithYear > 0 ? (r.newLows / r.nWithYear) * 100 : null,
      upVolumeShare: r.upVolumeShare, r20Iqr: r.r20Iqr,
      ewDailyMeanPct: r.ewDailyMeanPct, ewCohortMeanPct: r.ewCohortMeanPct,
      universeN: r.n, cohortEligible: r.cohortEligible,
    };
  });

  const usable = classified.filter((c) => c.regime != null);
  const runs = toRuns(classified.map((c) => c.regime as Regime | null));
  const t = transitionStats(runs);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/sessions.ndjson`, classified.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
  writeFileSync(`${outDir}/runs.json`, JSON.stringify(
    runs.map((r) => ({ ...r, startDate: classified[r.startIdx]!.sessionDate, endDate: classified[r.endIdx]!.sessionDate,
      era: ERA(classified[r.startIdx]!.sessionDate) })), null, 1), "utf8");

  console.error(`breadth cutoff: ${cutoff}%`);
  console.error(`sessions: ${rows.length} total, ${usable.length} classifiable (universe >= ${MIN_UNIVERSE})`);
  console.error(`first classifiable: ${usable[0]?.sessionDate}`);
  console.error(`runs: ${runs.length}  median run length: ${t.medianRunLength}  one-session flip rate: ${(t.oneDayFlipRate * 100).toFixed(1)}%`);
  for (const r of REGIMES) {
    const n = usable.filter((c) => c.regime === r).length;
    console.error(`  ${r.padEnd(21)} ${String(n).padStart(5)} sessions (${((n / usable.length) * 100).toFixed(1)}%)`);
  }
  console.error(`wrote ${outDir}/sessions.ndjson and runs.json`);
}

main();
