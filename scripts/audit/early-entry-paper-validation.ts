/**
 * Resolve outcomes for Early Entry paper signals and write validation report.
 *
 * Usage:
 *   npm run audit:early-entry:paper-validate
 *   npx tsx scripts/audit/early-entry-paper-validation.ts
 */
import "../load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import {
  buildPaperSafetySummary,
  detectGate2AbAfterSignal,
  evaluatePaperAcceptance,
  filterSignalsBySource,
  normalizePaperStore,
  PAPER_CALIBRATION_VARIANTS,
  resolvePaperSignalOutcomes,
  type PaperCalibrationVariantId,
  type PaperSignalRecord,
  type PaperSignalSource,
} from "../../src/lib/scanner/early-entry/paper-signals";

const EVIDENCE_DIR = resolve(process.cwd(), "docs/trading/evidence");
const SIGNALS_PATH = resolve(EVIDENCE_DIR, "early-entry-paper-signals.json");
const REPORT_PATH = resolve(EVIDENCE_DIR, "early-entry-paper-validation.md");

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

function toGate2Bar(row: {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Gate2BarInput {
  return {
    date: new Date(row.time),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

function loadBarsMap(): Map<string, Gate2BarInput[]> {
  const stockPath = resolve(process.cwd(), "data/stock-bars.json");
  const raw = JSON.parse(readFileSync(stockPath, "utf8")) as StockBarsFile;
  const out = new Map<string, Gate2BarInput[]>();
  for (const entry of raw) {
    out.set(
      entry.symbol,
      entry.bars.map(toGate2Bar).sort((a, b) => a.date.getTime() - b.date.getTime())
    );
  }
  return out;
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

function avg(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

type VariantStats = {
  variant: PaperCalibrationVariantId;
  signalCount: number;
  resolvedCount: number;
  partialCount: number;
  openCount: number;
  pilotQualifiedCount: number;
  winRate10d: number | null;
  falseSignalRate: number | null;
  avgRet5d: number | null;
  avgRet10d: number | null;
  avgRet20d: number | null;
  medianRet10d: number | null;
  avgRMultiple: number | null;
  acceptance: ReturnType<typeof evaluatePaperAcceptance>;
};

function variantStats(
  signals: PaperSignalRecord[],
  variant: PaperCalibrationVariantId,
  scope: "live_only" | "all"
): VariantStats {
  const qualified = signals.filter((s) => s.calibration[variant].pilotQualified);
  const resolved = qualified.filter((s) => s.isResolved);
  const partial = qualified.filter((s) => s.validationStatus === "partial");
  const open = qualified.filter((s) => s.validationStatus === "open");
  const withRet10 = qualified.filter((s) => s.outcomes?.ret10d != null);
  const falseCount = withRet10.filter((s) => (s.outcomes!.ret10d ?? 0) < 0).length;

  return {
    variant,
    signalCount: qualified.length,
    resolvedCount: resolved.length,
    partialCount: partial.length,
    openCount: open.length,
    pilotQualifiedCount: qualified.length,
    winRate10d: withRet10.length
      ? withRet10.filter((s) => (s.outcomes!.ret10d ?? 0) > 0).length / withRet10.length
      : null,
    falseSignalRate: withRet10.length ? falseCount / withRet10.length : null,
    avgRet5d: avg(
      qualified.map((s) => s.outcomes?.ret5d).filter((v): v is number => v != null)
    ),
    avgRet10d: avg(withRet10.map((s) => s.outcomes!.ret10d!)),
    avgRet20d: avg(
      resolved.map((s) => s.outcomes?.ret20d).filter((v): v is number => v != null)
    ),
    medianRet10d: median(withRet10.map((s) => s.outcomes!.ret10d!)),
    avgRMultiple: avg(
      resolved.map((s) => s.outcomes?.rMultiple).filter((v): v is number => v != null)
    ),
    acceptance: evaluatePaperAcceptance({
      variant,
      resolvedPilots: signals,
      scope,
    }),
  };
}

function sourceSummary(signals: PaperSignalRecord[], label: string): string[] {
  const pilots = signals.filter((s) => s.calibration.baseline.pilotQualified);
  const resolved = signals.filter((s) => s.isResolved);
  const open = signals.filter((s) => !s.isResolved);
  const partial = signals.filter((s) => s.validationStatus === "partial");
  const extended = signals.filter((s) => s.baselineState === "EXTENDED_DO_NOT_CHASE");
  const extendedResolved = extended.filter((s) => s.outcomes?.ret5d != null);
  const extendedAvoided = extendedResolved.filter((s) => s.outcomes?.extendedAvoidedBad5d);

  return [
    `### ${label}`,
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total signals | ${signals.length} |`,
    `| Baseline pilots | ${pilots.length} |`,
    `| Open | ${open.length} |`,
    `| Partial (5d/10d only) | ${partial.length} |`,
    `| Fully resolved (20d) | ${resolved.length} |`,
    `| EXTENDED_DO_NOT_CHASE | ${extended.length} |`,
    `| EXTENDED 5d avoidance rate | ${
      extendedResolved.length
        ? fmtPct((extendedAvoided.length / extendedResolved.length) * 100, 0)
        : "—"
    } |`,
    "",
  ];
}

function leaderboardTable(variants: VariantStats[], scopeLabel: string): string[] {
  const lines = [
    `#### Variant leaderboard — ${scopeLabel}`,
    "",
    "| Variant | Pilots | Resolved | Partial | Open | False% 10d | Avg 10d | Med 10d | Staging ready? |",
    "|---------|--------|----------|---------|------|------------|---------|---------|----------------|",
  ];
  for (const v of variants) {
    lines.push(
      `| ${v.variant} | ${v.pilotQualifiedCount} | ${v.resolvedCount} | ${v.partialCount} | ${v.openCount} | ${
        v.falseSignalRate != null ? fmtPct(v.falseSignalRate * 100, 0) : "—"
      } | ${fmtPct(v.avgRet10d)} | ${fmtPct(v.medianRet10d)} | ${
        v.acceptance.ready ? "⚠️ review" : "❌ no"
      } |`
    );
  }
  lines.push("");
  return lines;
}

function signalTable(
  signals: PaperSignalRecord[],
  title: string,
  limit = 25
): string[] {
  const lines = [`### ${title}`, ""];
  if (signals.length === 0) {
    lines.push("_None._", "");
    return lines;
  }
  lines.push(
    "| Date | Symbol | Source | State | Status | 5d | 10d | 20d | Inv→Tgt | Tgt→Inv | G2 A/B |",
    "|------|--------|--------|-------|--------|----|-----|-----|---------|---------|--------|"
  );
  for (const s of signals.slice(0, limit)) {
    const o = s.outcomes;
    lines.push(
      `| ${s.sessionDate} | ${s.symbol} | ${s.source} | ${s.displayLabel} | ${s.validationStatus} | ${fmtPct(
        o?.ret5d ?? null
      )} | ${fmtPct(o?.ret10d ?? null)} | ${fmtPct(o?.ret20d ?? null)} | ${
        o?.invalidHitBeforeTarget == null ? "—" : o.invalidHitBeforeTarget ? "yes" : "no"
      } | ${o?.targetHitBeforeInvalid == null ? "—" : o.targetHitBeforeInvalid ? "yes" : "no"} | ${
        o?.gate2BecameAb ? `yes (${o.gate2BecameAbSession ?? "?"})` : "no"
      } |`
    );
  }
  if (signals.length > limit) lines.push(`_…and ${signals.length - limit} more_`, "");
  else lines.push("");
  return lines;
}

function buildMarkdown(
  store: ReturnType<typeof normalizePaperStore>,
  historical: PaperSignalRecord[],
  live: PaperSignalRecord[],
  allVariants: VariantStats[],
  histVariants: VariantStats[],
  liveVariants: VariantStats[],
  safety: ReturnType<typeof buildPaperSafetySummary>
): string {
  const openLive = live.filter((s) => !s.isResolved);
  const resolvedLive = live.filter((s) => s.isResolved);
  const openAll = store.signals.filter((s) => !s.isResolved);

  const lines: string[] = [
    "# Early Entry Paper Validation",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Status",
    "",
    "**Research lane only** — `EARLY_ENTRY_V1_ENABLED` defaults off. Not decision support.",
    "",
    "Pilot Candidate is **not** buy-ready. Use **EXTENDED_DO_NOT_CHASE** only as a cautionary anti-FOMO warning.",
    "",
    "## Weekly operating routine",
    "",
    "1. **After each market session** — `npm run audit:early-entry:paper-log` (idempotent; skips duplicates).",
    "2. **Weekly** — `npm run audit:early-entry:paper-validate` to resolve partial/full horizons.",
    "3. **Review** — `npm run audit:early-entry:paper-summary` for open counts and acceptance gates.",
    "4. Read open vs resolved live signals in this report.",
    "5. **Do not** enable staging or trade from Pilot Candidate until live acceptance gates pass.",
  ];

  lines.push("", "## Safety summary (live paper)", "");
  lines.push(`| Metric | Value |`, `|--------|-------|`);
  lines.push(`| Open signals (all) | ${safety.openSignals} |`);
  lines.push(`| Open live signals | ${safety.openLiveSignals} |`);
  lines.push(
    `| EXTENDED 5d avoidance (live) | ${
      safety.extendedAvoidanceRate5d != null
        ? fmtPct(safety.extendedAvoidanceRate5d * 100, 0)
        : "—"
    } (${safety.extendedTotal} live EXTENDED) |`
  );
  lines.push(`| Any variant staging-ready | ${safety.anyVariantReady ? "yes (review)" : "no"} |`);
  lines.push("");

  lines.push("## Historical seed summary", "");
  lines.push(...sourceSummary(historical, "Historical seed cohort"));
  lines.push(...leaderboardTable(histVariants, "historical seed only"));

  lines.push("## Live paper summary", "");
  lines.push(...sourceSummary(live, "Live forward paper"));
  lines.push(...leaderboardTable(liveVariants, "live paper only"));

  lines.push("## Combined view (historical + live)", "");
  lines.push(
    "_Combined metrics are for context only. **Staging acceptance gates apply to live paper only.**_",
    ""
  );
  lines.push(...sourceSummary(store.signals, "Combined"));
  lines.push(...leaderboardTable(allVariants, "combined (not for staging)"));

  lines.push("## Open live signals", "");
  lines.push(...signalTable(openLive, "Awaiting forward data", 30));

  lines.push("## Resolved live signals", "");
  lines.push(...signalTable(resolvedLive, "Fully resolved (20 sessions)", 25));

  lines.push("## Acceptance gates (staging enablement)", "");
  lines.push(
    "Do **not** recommend staging unless **all** pass on **live paper** resolved pilots:",
    "",
    "- ≥20 live resolved pilot-qualified signals per variant under review",
    "- False pilot rate ≤ 35%",
    "- Median 10d or 20d return > 0",
    "- Average R multiple > 0",
    "- No single outlier explains most gains",
    "- ≥2 market regimes represented (or explicit regime filter required)",
    ""
  );

  for (const v of liveVariants) {
    if (v.pilotQualifiedCount === 0) continue;
    lines.push(`### ${v.variant} (live)`, "");
    lines.push(`- Staging ready: **${v.acceptance.ready ? "yes — review carefully" : "no"}**`);
    if (!v.acceptance.ready) {
      lines.push("- Blockers:");
      for (const b of v.acceptance.blockers) lines.push(`  - ${b}`);
    }
    lines.push("");
  }

  lines.push("## EXTENDED_DO_NOT_CHASE (all sources)", "");
  const extended = store.signals.filter((s) => s.baselineState === "EXTENDED_DO_NOT_CHASE");
  const extResolved = extended.filter((s) => s.outcomes?.ret5d != null);
  const extAvoided = extResolved.filter((s) => s.outcomes?.extendedAvoidedBad5d);
  lines.push(`- Total: **${extended.length}** · With 5d outcome: **${extResolved.length}**`);
  lines.push(
    `- Correctly avoided bad 5d: **${extAvoided.length}** / ${extResolved.length} (${
      extResolved.length ? fmtPct((extAvoided.length / extResolved.length) * 100, 0) : "—"
    })`
  );
  lines.push(
    "",
    "**Keep EXTENDED_DO_NOT_CHASE prominent** — strongest useful defensive signal in research."
  );

  lines.push("", "## Open signals (all sources)", "");
  if (openAll.length === 0) {
    lines.push("_None._");
  } else {
    lines.push(...signalTable(openAll, "All open", 20).slice(2));
  }

  lines.push("", "## Current recommendation", "");
  lines.push(
    "1. **Do not enable** staging decision support.",
    "2. **Keep Pilot Candidate** as research-only UI label.",
    "3. **Run paper-log daily** after each session; **paper-validate weekly**.",
    `4. Live resolved pilots (baseline): **${
      liveVariants.find((v) => v.variant === "baseline")?.resolvedCount ?? 0
    }** (need 20 for staging).`,
    "5. **EXTENDED_DO_NOT_CHASE** remains the most useful defensive signal."
  );

  return lines.join("\n");
}

function main() {
  if (!existsSync(SIGNALS_PATH)) {
    console.error(`No signals file at ${SIGNALS_PATH}. Run paper-log first.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(SIGNALS_PATH, "utf8"));
  let store = normalizePaperStore(raw);
  const barsMap = loadBarsMap();

  let updated = 0;
  let newlyFullyResolved = 0;

  store = {
    ...store,
    signals: store.signals.map((signal) => {
      const bars = barsMap.get(signal.symbol);
      if (!bars) return signal;
      const idx = bars.findIndex(
        (b) => b.date.toISOString().slice(0, 10) === signal.sessionDate
      );
      if (idx < 0) return signal;

      const wasResolved = signal.isResolved;
      const gate2 = detectGate2AbAfterSignal(bars, idx);
      const resolved = resolvePaperSignalOutcomes({
        signal,
        bars,
        sessionIdx: idx,
        gate2BecameAb: gate2.becameAb,
        gate2BecameAbSession: gate2.session,
      });

      if (
        resolved.daysAvailable !== signal.daysAvailable ||
        resolved.validationStatus !== signal.validationStatus ||
        JSON.stringify(resolved.outcomes) !== JSON.stringify(signal.outcomes)
      ) {
        updated++;
      }
      if (!wasResolved && resolved.isResolved) newlyFullyResolved++;

      return resolved;
    }),
  };

  store.lastUpdated = new Date().toISOString();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(SIGNALS_PATH, JSON.stringify(store, null, 2));

  const historical = filterSignalsBySource(store.signals, "historical_seed");
  const live = filterSignalsBySource(store.signals, "live_paper");
  const safety = buildPaperSafetySummary(store);

  const allVariants = PAPER_CALIBRATION_VARIANTS.map((v) =>
    variantStats(store.signals, v, "all")
  );
  const histVariants = PAPER_CALIBRATION_VARIANTS.map((v) =>
    variantStats(historical, v, "all")
  );
  const liveVariants = PAPER_CALIBRATION_VARIANTS.map((v) =>
    variantStats(live, v, "live_only")
  );

  const markdown = buildMarkdown(
    store,
    historical,
    live,
    allVariants,
    histVariants,
    liveVariants,
    safety
  );
  writeFileSync(REPORT_PATH, markdown);

  const payload = {
    generatedAt: new Date().toISOString(),
    totalSignals: store.signals.length,
    historicalSeed: historical.length,
    livePaper: live.length,
    openSignals: store.signals.filter((s) => !s.isResolved).length,
    openLiveSignals: live.filter((s) => !s.isResolved).length,
    partialSignals: store.signals.filter((s) => s.validationStatus === "partial").length,
    resolvedSignals: store.signals.filter((s) => s.isResolved).length,
    resolvedLiveSignals: live.filter((s) => s.isResolved).length,
    signalsUpdated: updated,
    newlyFullyResolved,
    safety,
    variantLeaderboardLive: liveVariants.map((v) => ({
      variant: v.variant,
      pilotQualifiedCount: v.pilotQualifiedCount,
      resolvedCount: v.resolvedCount,
      falseSignalRate: v.falseSignalRate,
      avgRet10d: v.avgRet10d,
      medianRet10d: v.medianRet10d,
      acceptanceReady: v.acceptance.ready,
      blockers: v.acceptance.blockers,
    })),
    reportPath: REPORT_PATH,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main();
