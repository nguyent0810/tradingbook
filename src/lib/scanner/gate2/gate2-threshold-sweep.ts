import type { Gate2BarInput, Gate2Quality } from "./types";
import type { BreakoutPullbackEvaluation } from "./types";
import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import {
  GATE2_SWEEP_DIMENSIONS,
  gate2EvalParamsForSweep,
  PRODUCTION_GATE2_EVAL_PARAMS,
  type Gate2EvalParams,
  type Gate2SweepDimensionSpec,
} from "./gate2-eval-params";
import { RS_LOOKBACK_20, RS_LOOKBACK_50 } from "./relative-strength";
import type { RelativeStrengthDiagnostic } from "./relative-strength";

export type SymbolGate2Snapshot = {
  symbol: string;
  sessionDate: string;
  quality: Gate2Quality;
  rankScore: number;
  terminalCode: string;
  rs20SpreadPct: number | null;
  rs50SpreadPct: number | null;
};

export type QualityCounts = {
  A: number;
  B: number;
  INVALID: number;
};

export type SweepArmResult = {
  dimensionKey: string;
  dimensionLabel: string;
  multiplier: number;
  paramValue: number;
  productionValue: number;
  counts: QualityCounts;
  terminalCodeCounts: Record<string, number>;
  deltaVsBaseline: {
    A: number;
    B: number;
    INVALID: number;
  };
  newlyPassingSymbols: string[];
  newlyRejectedSymbols: string[];
  changedSymbolsRs: Array<{
    symbol: string;
    baselineQuality: Gate2Quality;
    variantQuality: Gate2Quality;
    rs20SpreadPct: number | null;
    rs50SpreadPct: number | null;
  }>;
};

export const THRESHOLD_SWEEP_REPORT_SCHEMA_VERSION = "d1.7-replay-fixed";

export type ThresholdSweepReport = {
  reportSchemaVersion: string;
  disclaimer: string;
  asOfSession: string;
  symbolCount: number;
  lookbackSessions: number;
  /** True when rows use per-row session dates (walk-forward). */
  replayMode: boolean;
  staleSessionMismatchCount: number;
  highStaleRateWarning: string | null;
  baseline: {
    counts: QualityCounts;
    terminalCodeCounts: Record<string, number>;
  };
  arms: SweepArmResult[];
};

export function resolveTerminalCode(ev: BreakoutPullbackEvaluation): string {
  if (ev.quality !== "INVALID") return "VALID";
  return ev.terminalCode ?? "unknown";
}

export function qualityCounts(snapshots: SymbolGate2Snapshot[]): QualityCounts {
  const c: QualityCounts = { A: 0, B: 0, INVALID: 0 };
  for (const s of snapshots) {
    c[s.quality]++;
  }
  return c;
}

export function terminalCodeCounts(
  snapshots: SymbolGate2Snapshot[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of snapshots) {
    out[s.terminalCode] = (out[s.terminalCode] ?? 0) + 1;
  }
  return out;
}

function rsSpread(
  rs: RelativeStrengthDiagnostic | null | undefined,
  lookback: number
): number | null {
  const row = rs?.returns.find((r) => r.lookbackSessions === lookback);
  return row?.rsSpreadPct ?? null;
}

export function evaluateSymbolAtSession(params: {
  symbol: string;
  bars: readonly Gate2BarInput[];
  sessionDate: Date;
  evalParams?: Gate2EvalParams;
  rsDiagnostic?: RelativeStrengthDiagnostic | null;
}): SymbolGate2Snapshot {
  const ev = evaluateBreakoutPullbackCandidate(
    params.bars,
    params.sessionDate,
    params.evalParams ?? PRODUCTION_GATE2_EVAL_PARAMS
  );
  return {
    symbol: params.symbol,
    sessionDate: params.sessionDate.toISOString().slice(0, 10),
    quality: ev.quality,
    rankScore: ev.rankScore,
    terminalCode: resolveTerminalCode(ev),
    rs20SpreadPct: rsSpread(params.rsDiagnostic, RS_LOOKBACK_20),
    rs50SpreadPct: rsSpread(params.rsDiagnostic, RS_LOOKBACK_50),
  };
}

function isPassingQuality(q: Gate2Quality): boolean {
  return q === "A" || q === "B";
}

export function diffSnapshots(
  baseline: SymbolGate2Snapshot[],
  variant: SymbolGate2Snapshot[]
): Pick<
  SweepArmResult,
  "newlyPassingSymbols" | "newlyRejectedSymbols" | "changedSymbolsRs"
> {
  const baseBySym = new Map(baseline.map((s) => [s.symbol, s]));
  const varBySym = new Map(variant.map((s) => [s.symbol, s]));
  const newlyPassingSymbols: string[] = [];
  const newlyRejectedSymbols: string[] = [];
  const changedSymbolsRs: SweepArmResult["changedSymbolsRs"] = [];

  for (const [sym, b] of baseBySym) {
    const v = varBySym.get(sym);
    if (!v) continue;
    if (!isPassingQuality(b.quality) && isPassingQuality(v.quality)) {
      newlyPassingSymbols.push(sym);
    }
    if (isPassingQuality(b.quality) && !isPassingQuality(v.quality)) {
      newlyRejectedSymbols.push(sym);
    }
    if (b.quality !== v.quality) {
      changedSymbolsRs.push({
        symbol: sym,
        baselineQuality: b.quality,
        variantQuality: v.quality,
        rs20SpreadPct: v.rs20SpreadPct ?? b.rs20SpreadPct,
        rs50SpreadPct: v.rs50SpreadPct ?? b.rs50SpreadPct,
      });
    }
  }

  newlyPassingSymbols.sort();
  newlyRejectedSymbols.sort();
  return { newlyPassingSymbols, newlyRejectedSymbols, changedSymbolsRs };
}

export function buildSweepArm(
  dimension: Gate2SweepDimensionSpec,
  multiplier: number,
  baselineSnapshots: SymbolGate2Snapshot[],
  variantSnapshots: SymbolGate2Snapshot[]
): SweepArmResult {
  const productionValue = PRODUCTION_GATE2_EVAL_PARAMS[dimension.paramKey];
  const params = gate2EvalParamsForSweep(dimension, multiplier);
  const paramValue = params[dimension.paramKey];
  const counts = qualityCounts(variantSnapshots);
  const baselineCounts = qualityCounts(baselineSnapshots);
  const diff = diffSnapshots(baselineSnapshots, variantSnapshots);

  return {
    dimensionKey: dimension.key,
    dimensionLabel: dimension.label,
    multiplier,
    paramValue,
    productionValue,
    counts,
    terminalCodeCounts: terminalCodeCounts(variantSnapshots),
    deltaVsBaseline: {
      A: counts.A - baselineCounts.A,
      B: counts.B - baselineCounts.B,
      INVALID: counts.INVALID - baselineCounts.INVALID,
    },
    ...diff,
  };
}

export type SymbolBarsInput = {
  symbol: string;
  bars: readonly Gate2BarInput[];
  /** Walk-forward: evaluate at this session. Omit to use `asOfSession` (anchor-only). */
  sessionDate?: Date;
  rsDiagnostic?: RelativeStrengthDiagnostic | null;
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resolve evaluation session for one sweep row (anchor vs walk-forward). */
export function resolveSymbolEvaluationSession(
  input: SymbolBarsInput,
  asOfSession: Date
): Date {
  return input.sessionDate ?? asOfSession;
}

export function isWalkForwardReplayInput(
  symbols: readonly SymbolBarsInput[],
  asOfSession: Date
): boolean {
  const anchorKey = utcDayKey(asOfSession);
  return symbols.some(
    (s) => s.sessionDate != null && utcDayKey(s.sessionDate) !== anchorKey
  );
}

/**
 * Run single-parameter threshold sweeps (diagnostic only).
 * Each row is evaluated at `sessionDate` when set, else `asOfSession`.
 */
export function runThresholdSweep(params: {
  asOfSession: Date;
  symbols: SymbolBarsInput[];
  lookbackSessions?: number;
}): ThresholdSweepReport {
  const baselineSnapshots = params.symbols.map((s) =>
    evaluateSymbolAtSession({
      symbol: s.symbol,
      bars: s.bars,
      sessionDate: resolveSymbolEvaluationSession(s, params.asOfSession),
      rsDiagnostic: s.rsDiagnostic,
    })
  );

  const arms: SweepArmResult[] = [];

  for (const dimension of GATE2_SWEEP_DIMENSIONS) {
    for (const multiplier of dimension.multipliers) {
      if (multiplier === 1) continue;
      const evalParams = gate2EvalParamsForSweep(dimension, multiplier);
      const variantSnapshots = params.symbols.map((s) =>
        evaluateSymbolAtSession({
          symbol: s.symbol,
          bars: s.bars,
          sessionDate: resolveSymbolEvaluationSession(s, params.asOfSession),
          evalParams,
          rsDiagnostic: s.rsDiagnostic,
        })
      );
      arms.push(
        buildSweepArm(dimension, multiplier, baselineSnapshots, variantSnapshots)
      );
    }
  }

  const staleSessionMismatchCount = baselineSnapshots.filter(
    (s) => s.terminalCode === "stale_or_session_mismatch"
  ).length;
  const staleRate =
    baselineSnapshots.length > 0
      ? staleSessionMismatchCount / baselineSnapshots.length
      : 0;
  const replayMode = isWalkForwardReplayInput(params.symbols, params.asOfSession);

  return {
    reportSchemaVersion: THRESHOLD_SWEEP_REPORT_SCHEMA_VERSION,
    disclaimer:
      "Diagnostic threshold sweep only — production Gate 2 constants and scanner job unchanged.",
    asOfSession: params.asOfSession.toISOString().slice(0, 10),
    symbolCount: params.symbols.length,
    lookbackSessions: params.lookbackSessions ?? 1,
    replayMode,
    staleSessionMismatchCount,
    highStaleRateWarning:
      staleRate > 0.3
        ? `High stale_or_session_mismatch rate (${(staleRate * 100).toFixed(1)}%, n=${staleSessionMismatchCount}) — check per-row sessionDate replay.`
        : null,
    baseline: {
      counts: qualityCounts(baselineSnapshots),
      terminalCodeCounts: terminalCodeCounts(baselineSnapshots),
    },
    arms,
  };
}

/** Text table for CLI when not using --json. */
export function formatSweepReportTable(report: ThresholdSweepReport): string {
  const lines: string[] = [];
  lines.push(`Gate 2 threshold sweep (as-of ${report.asOfSession}, n=${report.symbolCount})`);
  lines.push(report.disclaimer);
  if (report.replayMode) lines.push(`Replay mode: per-row sessionDate`);
  if (report.highStaleRateWarning) lines.push(`⚠ ${report.highStaleRateWarning}`);
  lines.push("");
  lines.push(
    `Baseline: A=${report.baseline.counts.A} B=${report.baseline.counts.B} INVALID=${report.baseline.counts.INVALID}`
  );
  lines.push("Top baseline terminal codes:");
  const sortedTerms = Object.entries(report.baseline.terminalCodeCounts).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [code, n] of sortedTerms.slice(0, 8)) {
    lines.push(`  ${code}: ${n}`);
  }
  lines.push("");
  lines.push(
    "dimension".padEnd(28) +
      "mult".padStart(6) +
      "value".padStart(8) +
      " ΔA".padStart(5) +
      " ΔB".padStart(5) +
      " ΔInv".padStart(6) +
      " pass+".padStart(7) +
      " pass-".padStart(7)
  );
  lines.push("-".repeat(72));
  for (const arm of report.arms) {
    lines.push(
      arm.dimensionLabel.slice(0, 27).padEnd(28) +
        arm.multiplier.toFixed(1).padStart(6) +
        (typeof arm.paramValue === "number" && arm.paramValue < 1
          ? arm.paramValue.toFixed(3)
          : String(arm.paramValue)
        ).padStart(8) +
        String(arm.deltaVsBaseline.A).padStart(5) +
        String(arm.deltaVsBaseline.B).padStart(5) +
        String(arm.deltaVsBaseline.INVALID).padStart(6) +
        String(arm.newlyPassingSymbols.length).padStart(7) +
        String(arm.newlyRejectedSymbols.length).padStart(7)
    );
    if (arm.newlyPassingSymbols.length > 0) {
      lines.push(`  newly passing: ${arm.newlyPassingSymbols.slice(0, 12).join(", ")}`);
    }
    if (arm.newlyRejectedSymbols.length > 0) {
      lines.push(`  newly rejected: ${arm.newlyRejectedSymbols.slice(0, 12).join(", ")}`);
    }
  }
  return lines.join("\n");
}
