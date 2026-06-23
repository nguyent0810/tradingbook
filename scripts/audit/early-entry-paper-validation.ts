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
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import {
  evaluatePaperAcceptance,
  PAPER_CALIBRATION_VARIANTS,
  resolvePaperSignalOutcomes,
  type PaperCalibrationVariantId,
  type PaperSignalRecord,
  type PaperSignalStore,
} from "../../src/lib/scanner/early-entry/paper-signals";
import { tradeStateDisplayLabel } from "../../src/lib/scanner/early-entry";

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

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}

type VariantStats = {
  variant: PaperCalibrationVariantId;
  signalCount: number;
  resolvedCount: number;
  pilotQualifiedCount: number;
  winRate10d: number | null;
  falseSignalRate: number | null;
  avgRet5d: number | null;
  avgRet10d: number | null;
  avgRet20d: number | null;
  medianRet10d: number | null;
  avgRMultiple: number | null;
  medianRMultiple: number | null;
  best5: Array<{ symbol: string; sessionDate: string; ret10d: number | null }>;
  worst5: Array<{ symbol: string; sessionDate: string; ret10d: number | null }>;
  acceptance: ReturnType<typeof evaluatePaperAcceptance>;
};

function variantStats(
  signals: PaperSignalRecord[],
  variant: PaperCalibrationVariantId
): VariantStats {
  const qualified = signals.filter((s) => s.calibration[variant].pilotQualified);
  const resolved = qualified.filter((s) => s.outcomes != null);
  const ret10 = resolved.map((s) => s.outcomes!.ret10d).filter((v): v is number => v != null);
  const falseCount = resolved.filter((s) => (s.outcomes!.ret10d ?? 0) < 0).length;
  const sorted = [...resolved].sort(
    (a, b) => (b.outcomes?.ret10d ?? -999) - (a.outcomes?.ret10d ?? -999)
  );

  return {
    variant,
    signalCount: qualified.length,
    resolvedCount: resolved.length,
    pilotQualifiedCount: qualified.length,
    winRate10d: ret10.length ? ret10.filter((r) => r > 0).length / ret10.length : null,
    falseSignalRate: resolved.length ? falseCount / resolved.length : null,
    avgRet5d: avg(resolved.map((s) => s.outcomes!.ret5d!).filter(Number.isFinite)),
    avgRet10d: avg(ret10),
    avgRet20d: avg(resolved.map((s) => s.outcomes!.ret20d!).filter(Number.isFinite)),
    medianRet10d: median(ret10),
    avgRMultiple: avg(
      resolved.map((s) => s.outcomes!.rMultiple).filter((v): v is number => v != null)
    ),
    medianRMultiple: median(
      resolved.map((s) => s.outcomes!.rMultiple).filter((v): v is number => v != null)
    ),
    best5: sorted.slice(0, 5).map((s) => ({
      symbol: s.symbol,
      sessionDate: s.sessionDate,
      ret10d: s.outcomes?.ret10d ?? null,
    })),
    worst5: sorted.slice(-5).reverse().map((s) => ({
      symbol: s.symbol,
      sessionDate: s.sessionDate,
      ret10d: s.outcomes?.ret10d ?? null,
    })),
    acceptance: evaluatePaperAcceptance({ variant, resolvedPilots: resolved }),
  };
}

function buildMarkdown(store: PaperSignalStore, variants: VariantStats[]): string {
  const open = store.signals.filter((s) => !s.outcomes);
  const closed = store.signals.filter((s) => s.outcomes);
  const extended = store.signals.filter((s) => s.baselineState === "EXTENDED_DO_NOT_CHASE");
  const extendedResolved = extended.filter((s) => s.outcomes);
  const extendedAvoided = extendedResolved.filter((s) => s.outcomes?.extendedAvoidedBad5d);
  const extendedMissed = extendedResolved.filter(
    (s) => (s.outcomes?.ret5d ?? 0) > 3 && !s.outcomes?.extendedAvoidedBad5d
  );

  const byState = new Map<string, PaperSignalRecord[]>();
  for (const s of closed) {
    const label = s.displayLabel;
    const list = byState.get(label) ?? [];
    list.push(s);
    byState.set(label, list);
  }

  const lines: string[] = [
    "# Early Entry Paper Validation",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Status",
    "",
    "**Research lane only** — `EARLY_ENTRY_V1_ENABLED` defaults off. Not decision support.",
    "",
    "## How to run",
    "",
    "```bash",
    "npm run audit:early-entry:paper-log          # log latest session",
    "npm run audit:early-entry:paper-log -- --seed-historical  # backfill cohort",
    "npm run audit:early-entry:paper-validate     # resolve outcomes + refresh report",
    "```",
    "",
    "## Signal inventory",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total logged | ${store.signals.length} |`,
    `| Open (awaiting 20d) | ${open.length} |`,
    `| Resolved | ${closed.length} |`,
    "",
    "## Per-state summary (resolved)",
    "",
  ];

  for (const [state, items] of byState) {
    const r10 = items.map((s) => s.outcomes!.ret10d).filter((v): v is number => v != null);
    lines.push(
      `### ${state} (n=${items.length})`,
      `- Avg 10d: ${fmtPct(avg(r10))} · Median 10d: ${fmtPct(median(r10))} · Win rate: ${
        r10.length ? fmtPct((r10.filter((r) => r > 0).length / r10.length) * 100, 1) : "—"
      }`,
      ""
    );
  }

  lines.push("## Calibration variant leaderboard", "");
  lines.push(
    "| Variant | Pilots | Resolved | Win% 10d | False% | Avg 10d | Med 10d | Ready? |",
    "|---------|--------|----------|----------|--------|---------|---------|--------|"
  );
  for (const v of variants) {
    lines.push(
      `| ${v.variant} | ${v.pilotQualifiedCount} | ${v.resolvedCount} | ${
        v.winRate10d != null ? fmtPct(v.winRate10d * 100, 1) : "—"
      } | ${v.falseSignalRate != null ? fmtPct(v.falseSignalRate * 100, 1) : "—"} | ${fmtPct(
        v.avgRet10d
      )} | ${fmtPct(v.medianRet10d)} | ${v.acceptance.ready ? "⚠️ check" : "❌ no"} |`
    );
  }

  lines.push("", "## EXTENDED_DO_NOT_CHASE defensive validation", "");
  lines.push(`- Total signals: **${extended.length}**`);
  lines.push(`- Resolved: **${extendedResolved.length}**`);
  lines.push(
    `- Correctly avoided bad 5d (price down): **${extendedAvoided.length}** / ${extendedResolved.length}`
  );
  lines.push("", "### Examples — correctly avoided chase", "");
  for (const s of extendedAvoided.slice(0, 5)) {
    lines.push(
      `- **${s.symbol}** ${s.sessionDate} — 5d ${fmtPct(s.outcomes?.ret5d)}, 10d ${fmtPct(s.outcomes?.ret10d)}`
    );
  }
  lines.push("", "### Examples — possibly too conservative (5d > +3%)", "");
  for (const s of extendedMissed.slice(0, 5)) {
    lines.push(
      `- **${s.symbol}** ${s.sessionDate} — 5d ${fmtPct(s.outcomes?.ret5d)}, 10d ${fmtPct(s.outcomes?.ret10d)}`
    );
  }

  lines.push("", "## Open signals (awaiting outcome)", "");
  if (open.length === 0) {
    lines.push("_None — all logged signals resolved._");
  } else {
    lines.push("| Date | Symbol | State | Score | R:R |", "|------|--------|-------|-------|-----|");
    for (const s of open.slice(0, 30)) {
      lines.push(
        `| ${s.sessionDate} | ${s.symbol} | ${s.displayLabel} | ${s.earlyReversalScore} | ${
          s.estimatedRiskReward?.toFixed(2) ?? "—"
        } |`
      );
    }
    if (open.length > 30) lines.push(`_…and ${open.length - 30} more_`);
  }

  lines.push("", "## Closed signals (sample)", "");
  lines.push(
    "| Date | Symbol | State | 5d | 10d | 20d | MAE | MFE | R |",
    "|------|--------|-------|----|-----|-----|-----|-----|---|"
  );
  for (const s of closed.slice(0, 25)) {
    const o = s.outcomes!;
    lines.push(
      `| ${s.sessionDate} | ${s.symbol} | ${s.displayLabel} | ${fmtPct(o.ret5d)} | ${fmtPct(
        o.ret10d
      )} | ${fmtPct(o.ret20d)} | ${fmtPct(o.mae10d)} | ${fmtPct(o.mfe10d)} | ${
        o.rMultiple?.toFixed(2) ?? "—"
      } |`
    );
  }

  const bestBaseline = variants.find((v) => v.variant === "baseline");
  lines.push("", "## Current recommendation", "");
  lines.push(
    "1. **Do not enable** for staging decision support.",
    "2. **Keep Pilot Candidate** as research-only UI label.",
    "3. **Continue paper logging** until ≥20 resolved pilots per variant.",
    `4. Baseline resolved pilots: **${bestBaseline?.resolvedCount ?? 0}** (need 20).`,
    "5. **EXTENDED_DO_NOT_CHASE** remains the most useful defensive signal — keep prominent in UI."
  );

  if (bestBaseline && !bestBaseline.acceptance.ready) {
    lines.push("", "### Blockers", "");
    for (const b of bestBaseline.acceptance.blockers) {
      lines.push(`- ${b}`);
    }
  }

  return lines.join("\n");
}

function main() {
  if (!existsSync(SIGNALS_PATH)) {
    console.error(`No signals file at ${SIGNALS_PATH}. Run paper-log first.`);
    process.exit(1);
  }

  const store = JSON.parse(readFileSync(SIGNALS_PATH, "utf8")) as PaperSignalStore;
  const barsMap = loadBarsMap();

  let resolvedCount = 0;
  for (const signal of store.signals) {
    if (signal.outcomes) continue;
    const bars = barsMap.get(signal.symbol);
    if (!bars) continue;
    const idx = bars.findIndex((b) => b.date.toISOString().slice(0, 10) === signal.sessionDate);
    if (idx < 0) continue;

    let gate2BecameAb = false;
    for (let d = 1; d <= 20; d++) {
      const future = bars[idx + d];
      if (!future) break;
      const ev = evaluateBreakoutPullbackCandidate(bars, future.date);
      if (ev.quality === "A" || ev.quality === "B") {
        gate2BecameAb = true;
        break;
      }
    }

    const outcomes = resolvePaperSignalOutcomes({
      signal,
      bars,
      sessionIdx: idx,
      gate2BecameAb,
    });
    if (outcomes) {
      signal.outcomes = outcomes;
      resolvedCount++;
    }
  }

  store.lastUpdated = new Date().toISOString();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(SIGNALS_PATH, JSON.stringify(store, null, 2));

  const variantSummaries = PAPER_CALIBRATION_VARIANTS.map((v) => variantStats(store.signals, v));
  const markdown = buildMarkdown(store, variantSummaries);
  writeFileSync(REPORT_PATH, markdown);

  const payload = {
    generatedAt: new Date().toISOString(),
    totalSignals: store.signals.length,
    openSignals: store.signals.filter((s) => !s.outcomes).length,
    resolvedSignals: store.signals.filter((s) => s.outcomes).length,
    newlyResolved: resolvedCount,
    variantLeaderboard: variantSummaries.map((v) => ({
      variant: v.variant,
      pilotQualifiedCount: v.pilotQualifiedCount,
      resolvedCount: v.resolvedCount,
      falseSignalRate: v.falseSignalRate,
      avgRet10d: v.avgRet10d,
      medianRet10d: v.medianRet10d,
      acceptanceReady: v.acceptance.ready,
      blockers: v.acceptance.blockers,
    })),
    extended: {
      total: store.signals.filter((s) => s.baselineState === "EXTENDED_DO_NOT_CHASE").length,
      resolved: store.signals.filter(
        (s) => s.baselineState === "EXTENDED_DO_NOT_CHASE" && s.outcomes
      ).length,
      avoidedBad5d: store.signals.filter(
        (s) => s.baselineState === "EXTENDED_DO_NOT_CHASE" && s.outcomes?.extendedAvoidedBad5d
      ).length,
    },
    reportPath: REPORT_PATH,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main();
