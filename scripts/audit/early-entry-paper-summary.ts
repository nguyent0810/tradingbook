/**
 * Lightweight safety summary for Early Entry paper validation.
 *
 * Usage:
 *   npm run audit:early-entry:paper-summary
 */
import "../load-env";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  buildPaperSafetySummary,
  filterSignalsBySource,
  normalizePaperStore,
  PAPER_CALIBRATION_VARIANTS,
} from "../../src/lib/scanner/early-entry/paper-signals";

const SIGNALS_PATH = resolve(
  process.cwd(),
  "docs/trading/evidence/early-entry-paper-signals.json"
);

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function main() {
  if (!existsSync(SIGNALS_PATH)) {
    console.error(`No signals file at ${SIGNALS_PATH}. Run paper-log first.`);
    process.exit(1);
  }

  const store = normalizePaperStore(
    JSON.parse(readFileSync(SIGNALS_PATH, "utf8"))
  );
  const safety = buildPaperSafetySummary(store);
  const live = filterSignalsBySource(store.signals, "live_paper");
  const historical = filterSignalsBySource(store.signals, "historical_seed");

  console.log("Early Entry Paper Validation — Safety Summary");
  console.log("============================================");
  console.log(`Store version: ${store.version}`);
  console.log(`Total signals: ${store.signals.length}`);
  console.log(`  historical_seed: ${historical.length}`);
  console.log(`  live_paper: ${live.length}`);
  console.log("");
  console.log(`Open signals (all): ${safety.openSignals}`);
  console.log(`Open live signals: ${safety.openLiveSignals}`);
  console.log(`Resolved live signals: ${live.filter((s) => s.isResolved).length}`);
  console.log("");
  console.log(
    `EXTENDED_DO_NOT_CHASE 5d avoidance (live): ${fmtPct(safety.extendedAvoidanceRate5d)} (n=${safety.extendedTotal})`
  );
  console.log("");
  console.log("Resolved live pilots by variant:");
  for (const v of PAPER_CALIBRATION_VARIANTS) {
    const n = safety.resolvedLivePilots[v];
    const fr = safety.falseRateByVariant[v];
    const med = safety.medianRet10dByVariant[v];
  console.log(
      `  ${v}: n=${n} false_rate=${fmtPct(fr)} median_10d=${
        med != null ? `${med.toFixed(2)}%` : "—"
      } ready=${safety.acceptanceLive[v].ready ? "YES" : "no"}`
    );
  }
  console.log("");
  console.log(
    `Staging enablement (live only): ${safety.anyVariantReady ? "ONE OR MORE VARIANTS PASS — review manually" : "NOT MET"}`
  );
  if (!safety.anyVariantReady) {
    console.log("Blockers (baseline live):");
    for (const b of safety.acceptanceLive.baseline.blockers) {
      console.log(`  - ${b}`);
    }
  }
  console.log("");
  console.log(JSON.stringify(safety, null, 2));
}

main();
