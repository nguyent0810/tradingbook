/**
 * Early-entry cohort backtest — validation & calibration (audit only).
 *
 * Usage:
 *   npx tsx scripts/audit/early-entry-backtest.ts
 *   npx tsx scripts/audit/early-entry-backtest.ts --min-symbols=50
 */
import "../load-env";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  COHORT_ANCHORS,
  sectorForSymbol,
  type EarlyEntrySector,
} from "./early-entry-sector-map";
import {
  runEarlyEntryBacktest,
  toGate2Bar,
  type BacktestRunResult,
  type VariantSummary,
} from "./lib/early-entry-backtest-core";

type StockBarsFile = Array<{
  symbol: string;
  bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}>;

const EVIDENCE_DIR = resolve(process.cwd(), "docs/trading/evidence");
const JSON_OUT = resolve(EVIDENCE_DIR, "early-entry-backtest.json");
const MD_OUT = resolve(EVIDENCE_DIR, "early-entry-backtest.md");

function loadCohort(minBars: number) {
  const stockPath = resolve(process.cwd(), "data/stock-bars.json");
  const indexPath = resolve(process.cwd(), "data/vnindex.json");
  if (!existsSync(stockPath) || !existsSync(indexPath)) {
    throw new Error("Missing data/stock-bars.json or data/vnindex.json");
  }

  const raw = JSON.parse(readFileSync(stockPath, "utf8")) as StockBarsFile;
  const indexRaw = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;

  const symbols = new Map<string, ReturnType<typeof toGate2Bar>[]>();
  const liquidity = new Map<string, number>();

  for (const entry of raw) {
    const bars = entry.bars.map(toGate2Bar).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (bars.length >= minBars) {
      symbols.set(entry.symbol, bars);
      const avgVol =
        bars.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, bars.length);
      liquidity.set(entry.symbol, avgVol);
    }
  }

  const indexBars = indexRaw.map(toGate2Bar);
  return { symbols, indexBars, liquidity };
}

function selectDiverseCohort(
  symbols: Map<string, unknown>,
  liquidity: Map<string, number>,
  minSymbols: number
): string[] {
  const picked = new Set<string>();
  const bySector = new Map<EarlyEntrySector, string[]>();

  for (const sym of symbols.keys()) {
    const sector = sectorForSymbol(sym);
    const list = bySector.get(sector) ?? [];
    list.push(sym);
    bySector.set(sector, list);
  }

  for (const anchor of COHORT_ANCHORS) {
    if (symbols.has(anchor)) picked.add(anchor);
  }

  const sectorOrder: EarlyEntrySector[] = [
    "bank",
    "securities",
    "real_estate",
    "retail",
    "oil_gas",
    "industrial",
    "other",
  ];

  for (const sector of sectorOrder) {
    const list = (bySector.get(sector) ?? []).sort(
      (a, b) => (liquidity.get(b) ?? 0) - (liquidity.get(a) ?? 0)
    );
    let added = 0;
    for (const sym of list) {
      if (picked.size >= minSymbols) break;
      if (!picked.has(sym)) {
        picked.add(sym);
        added++;
      }
      if (added >= 8) break;
    }
  }

  if (picked.size < minSymbols) {
    const rest = [...symbols.keys()]
      .filter((s) => !picked.has(s))
      .sort((a, b) => (liquidity.get(b) ?? 0) - (liquidity.get(a) ?? 0));
    for (const sym of rest) {
      picked.add(sym);
      if (picked.size >= minSymbols) break;
    }
  }

  return [...picked].slice(0, Math.max(minSymbols, picked.size));
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function buildMarkdown(
  symbolList: string[],
  result: BacktestRunResult,
  baseline: VariantSummary,
  bestVariant: VariantSummary
): string {
  const lines: string[] = [
    "# Early Entry Backtest Evidence",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Status",
    "",
    "**Experimental display-only research lane — not decision support.**",
    "`EARLY_ENTRY_V1_ENABLED` remains off by default.",
    "",
    "## Cohort",
    "",
    `- Symbols: **${symbolList.length}**`,
    `- Observations: **${result.observations.length}**`,
    `- Sector anchors included: ${COHORT_ANCHORS.filter((s) => symbolList.includes(s)).join(", ")}`,
    "",
    "## Baseline PILOT_BUY performance (current logic)",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Pilot signals | ${baseline.pilotCount} |`,
    `| False pilot rate (10d < 0) | ${baseline.falsePilotRate != null ? fmtPct(baseline.falsePilotRate * 100, 1) : "—"} |`,
    `| Avg 5d / 10d / 20d return | ${fmtPct(baseline.avgRet5d)} / ${fmtPct(baseline.avgRet10d)} / ${fmtPct(baseline.avgRet20d)} |`,
    `| Avg MAE / MFE (10d) | ${fmtPct(baseline.avgMae10d)} / ${fmtPct(baseline.avgMfe10d)} |`,
    `| EXTENDED_DO_NOT_CHASE blocked | ${baseline.extendedBlocked} (${baseline.extendedNegative5d} neg 5d) |`,
    "",
    "## Best calibration variant",
    "",
    `**${bestVariant.variant}** — pilots: ${bestVariant.pilotCount}, false rate: ${
      bestVariant.falsePilotRate != null ? fmtPct(bestVariant.falsePilotRate * 100, 1) : "—"
    }, avg 10d: ${fmtPct(bestVariant.avgRet10d)}`,
    "",
    "## Calibration variant comparison",
    "",
    "| Variant | Pilots | False rate | Avg 10d | Avg MAE |",
    "|---------|--------|------------|---------|---------|",
  ];

  for (const v of result.variantSummaries) {
    lines.push(
      `| ${v.variant} | ${v.pilotCount} | ${
        v.falsePilotRate != null ? fmtPct(v.falsePilotRate * 100, 1) : "—"
      } | ${fmtPct(v.avgRet10d)} | ${fmtPct(v.avgMae10d)} |`
    );
  }

  lines.push("", "## State buckets (baseline)", "");
  for (const b of result.buckets.byState) {
    lines.push(
      `### ${b.bucket} (n=${b.count})`,
      `- Avg 10d: ${fmtPct(b.avgRet10d)} · Win rate: ${
        b.winRate10d != null ? fmtPct(b.winRate10d * 100, 1) : "—"
      }`,
      ""
    );
  }

  lines.push("## False pilot diagnosis", "");
  for (const fp of result.falsePilots.slice(0, 15)) {
    lines.push(
      `- **${fp.symbol}** ${fp.sessionDate} — score ${fp.score}, R:R ${fp.rr?.toFixed(2) ?? "—"}, 10d ${fmtPct(fp.ret10d)}`,
      `  - Hypotheses: ${fp.hypotheses.join(", ")}`,
      `  - Codes: ${fp.reasonCodes.join(", ")}`
    );
  }

  lines.push("", "## Recommendation", "");
  lines.push(
    "1. Keep early-entry **display-only**; do not enable for staging decision support.",
    "2. Rename UI label **Pilot Buy → Pilot Candidate** (research signal, not a buy).",
    "3. Demote production PILOT_BUY to WATCH until 20+ paper-validated future signals.",
    "4. EXTENDED_DO_NOT_CHASE shows useful defensive value — keep prominently displayed.",
    "5. Test tightened calibration (R:R≥2.5 + Gate1 PASS + volume) in paper trading before any default change."
  );

  return lines.join("\n");
}

function pickBestVariant(summaries: VariantSummary[]): VariantSummary {
  const candidates = summaries.filter((s) => s.variant !== "baseline" && s.pilotCount >= 3);
  if (candidates.length === 0) return summaries[0]!;
  return [...candidates].sort((a, b) => {
    const scoreA = (a.avgRet10d ?? -999) - (a.falsePilotRate ?? 1) * 20;
    const scoreB = (b.avgRet10d ?? -999) - (b.falsePilotRate ?? 1) * 20;
    return scoreB - scoreA;
  })[0]!;
}

function main() {
  const minSymbols = Number.parseInt(
    process.argv.find((a) => a.startsWith("--min-symbols="))?.split("=")[1] ?? "50",
    10
  );

  const { symbols, indexBars, liquidity } = loadCohort(80);
  const symbolList = selectDiverseCohort(symbols, liquidity, minSymbols);

  const result = runEarlyEntryBacktest({
    symbols,
    symbolList,
    indexBars,
    sectorFor: sectorForSymbol,
    step: 5,
  });

  const baseline = result.variantSummaries.find((v) => v.variant === "baseline")!;
  const bestVariant = pickBestVariant(result.variantSummaries);

  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    status: "experimental_display_only",
    flagDefault: false,
    cohort: {
      symbolCount: symbolList.length,
      symbols: symbolList,
      observationCount: result.observations.length,
    },
    baseline,
    bestCalibrationVariant: bestVariant,
    variantSummaries: result.variantSummaries,
    buckets: result.buckets,
    falsePilots: result.falsePilots,
    recommendation: {
      enableDecisionSupport: false,
      renamePilotBuyTo: "Pilot Candidate",
      demotePilotUntilPaperValidation: true,
      extendedChaseBlockUseful: true,
      preferredCalibrationVariant: bestVariant.variant,
    },
  };

  writeFileSync(JSON_OUT, JSON.stringify(payload, null, 2));
  writeFileSync(MD_OUT, buildMarkdown(symbolList, result, baseline, bestVariant));

  console.log("Early Entry Validation Backtest");
  console.log("==============================");
  console.log(`Cohort: ${symbolList.length} symbols, ${result.observations.length} observations`);
  console.log(`Evidence: ${JSON_OUT}`);
  console.log(`Report:   ${MD_OUT}`);
  console.log("");
  console.log("Baseline PILOT_BUY:");
  console.log(`  Count: ${baseline.pilotCount}`);
  console.log(`  False rate: ${baseline.falsePilotRate != null ? (baseline.falsePilotRate * 100).toFixed(1) : "—"}%`);
  console.log(`  Avg 5d/10d/20d: ${fmtPct(baseline.avgRet5d)} / ${fmtPct(baseline.avgRet10d)} / ${fmtPct(baseline.avgRet20d)}`);
  console.log(`Best variant: ${bestVariant.variant} (pilots ${bestVariant.pilotCount}, avg 10d ${fmtPct(bestVariant.avgRet10d)})`);
}

main();
