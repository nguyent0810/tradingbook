import type { Gate2Quality } from "./types";
import {
  computeForwardReturnLabels,
  FORWARD_RETURN_HORIZONS,
  type ForwardReturnHorizon,
  type ForwardReturnLabels,
} from "./forward-returns";
import type { Gate2ReplayEvaluationRow } from "./gate2-replay-dataset";
import {
  GATE2_SWEEP_DIMENSIONS,
  gate2EvalParamsForSweep,
} from "./gate2-eval-params";
import {
  buildSweepArm,
  evaluateSymbolAtSession,
  type SweepArmResult,
} from "./gate2-threshold-sweep";
import type { RelativeStrengthDiagnostic } from "./relative-strength";

export const SMALL_SAMPLE_THRESHOLD = 10;
export const HIGH_MISSING_FUTURE_20D_RATE = 0.3;
export const FORWARD_RETURN_REPORT_SCHEMA_VERSION = "d1.7-replay-fixed";

export type InvalidRs20CohortKey =
  | "invalid_rs20_positive"
  | "invalid_rs20_negative"
  | "invalid_rs20_neutral_or_missing";

export type CohortKey =
  | "baseline_tier_a"
  | "baseline_tier_b"
  | InvalidRs20CohortKey
  | `sweep_new_pass:${string}:${number}`
  | `sweep_new_reject:${string}:${number}`;

/** Classify INVALID rows by RS20 spread (diagnostic only; does not affect pass/fail). */
export function classifyInvalidRs20Cohort(
  quality: Gate2Quality,
  rs20SpreadPct: number | null
): InvalidRs20CohortKey | null {
  if (quality !== "INVALID") return null;
  if (rs20SpreadPct == null || !Number.isFinite(rs20SpreadPct) || rs20SpreadPct === 0) {
    return "invalid_rs20_neutral_or_missing";
  }
  return rs20SpreadPct > 0 ? "invalid_rs20_positive" : "invalid_rs20_negative";
}

export type LabeledForwardRow = {
  symbol: string;
  sessionDate: string;
  cohorts: CohortKey[];
  baselineQuality: Gate2Quality;
  terminalCode: string;
  rs20SpreadPct: number | null;
  forward: ForwardReturnLabels | null;
};

export type HorizonAggregate = {
  horizon: ForwardReturnHorizon;
  n: number;
  avgPct: number | null;
  medianPct: number | null;
  winRate: number | null;
};

export type CohortForwardSummary = {
  cohort: CohortKey;
  label: string;
  sampleSize: number;
  smallSampleWarning: string | null;
  missingFutureBars: number;
  missingFuture20Pct: number | null;
  highMissingFuture20Warning: string | null;
  horizons: HorizonAggregate[];
  avgMaxFavorableExcursion20Pct: number | null;
  avgMaxAdverseExcursion20Pct: number | null;
  hitPlus5BeforeMinus3Rate: number | null;
  hitPlus10Within20Rate: number | null;
  drawdownWorseThanMinus5Rate: number | null;
  rs20Split: {
    positive: { n: number; avgForward20Pct: number | null };
    negative: { n: number; avgForward20Pct: number | null };
  } | null;
};

export type ForwardReturnValidationReport = {
  reportSchemaVersion: string;
  disclaimer: string;
  anchorSession: string;
  evaluationRowCount: number;
  lookbackSessions: number;
  includeSweepArms: boolean;
  includeSweepRejects: boolean;
  cohorts: CohortForwardSummary[];
  sweepArmCount: number;
};

function cohortLabel(key: CohortKey): string {
  if (key === "baseline_tier_a") return "Baseline Tier A";
  if (key === "baseline_tier_b") return "Baseline Tier B";
  if (key === "invalid_rs20_positive") return "INVALID + RS20>0";
  if (key === "invalid_rs20_negative") return "INVALID + RS20<0";
  if (key === "invalid_rs20_neutral_or_missing") return "INVALID + RS20 neutral/missing";
  if (key.startsWith("sweep_new_pass:")) {
    const [, dim, mult] = key.split(":");
    return `Sweep new pass · ${dim} ×${mult}`;
  }
  if (key.startsWith("sweep_new_reject:")) {
    const [, dim, mult] = key.split(":");
    return `Sweep new reject · ${dim} ×${mult}`;
  }
  return key;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function winRate(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.filter((v) => v > 0).length / values.length;
}

function rateTruthy(flags: boolean[]): number | null {
  if (flags.length === 0) return null;
  return flags.filter(Boolean).length / flags.length;
}

export function aggregateCohort(rows: LabeledForwardRow[], cohort: CohortKey): CohortForwardSummary {
  const members = rows.filter((r) => r.cohorts.includes(cohort));
  const missingFutureBars = members.filter(
    (r) => r.forward == null || r.forward.futureSessionsAvailable < 20
  ).length;

  const horizons: HorizonAggregate[] = FORWARD_RETURN_HORIZONS.map((horizon) => {
    const vals = members
      .map((r) => r.forward?.forwardReturnPct[horizon])
      .filter((v): v is number => v != null && Number.isFinite(v));
    return {
      horizon,
      n: vals.length,
      avgPct: mean(vals),
      medianPct: median(vals),
      winRate: winRate(vals),
    };
  });

  const mfe = members
    .map((r) => r.forward?.maxFavorableExcursion20Pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const mae = members
    .map((r) => r.forward?.maxAdverseExcursion20Pct)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const hit53 = members
    .map((r) => r.forward?.hitPlus5BeforeMinus3)
    .filter((v): v is boolean => v != null);
  const hit10 = members
    .map((r) => r.forward?.hitPlus10Within20)
    .filter((v): v is boolean => v != null);
  const dd5 = members
    .map((r) => r.forward?.drawdownWorseThanMinus5Within20)
    .filter((v): v is boolean => v != null);

  const withRs = members.filter((r) => r.rs20SpreadPct != null);
  let rs20Split: CohortForwardSummary["rs20Split"] = null;
  if (withRs.length >= 3) {
    const pos = withRs.filter((r) => (r.rs20SpreadPct ?? 0) > 0);
    const neg = withRs.filter((r) => (r.rs20SpreadPct ?? 0) <= 0);
    const pos20 = pos
      .map((r) => r.forward?.forwardReturnPct[20])
      .filter((v): v is number => v != null);
    const neg20 = neg
      .map((r) => r.forward?.forwardReturnPct[20])
      .filter((v): v is number => v != null);
    rs20Split = {
      positive: { n: pos20.length, avgForward20Pct: mean(pos20) },
      negative: { n: neg20.length, avgForward20Pct: mean(neg20) },
    };
  }

  const sampleSize = members.length;
  const missingFuture20Pct =
    sampleSize > 0 ? missingFutureBars / sampleSize : null;
  const highMissingFuture20Warning =
    missingFuture20Pct != null && missingFuture20Pct > HIGH_MISSING_FUTURE_20D_RATE
      ? `>${(HIGH_MISSING_FUTURE_20D_RATE * 100).toFixed(0)}% of cohort missing 20-session forward labels (${missingFutureBars}/${sampleSize}).`
      : null;

  return {
    cohort,
    label: cohortLabel(cohort),
    sampleSize,
    smallSampleWarning:
      sampleSize < SMALL_SAMPLE_THRESHOLD
        ? `Small sample (n=${sampleSize}) — hypothesis generation only, not production proof.`
        : null,
    missingFutureBars,
    missingFuture20Pct,
    highMissingFuture20Warning,
    horizons,
    avgMaxFavorableExcursion20Pct: mean(mfe),
    avgMaxAdverseExcursion20Pct: mean(mae),
    hitPlus5BeforeMinus3Rate: rateTruthy(hit53),
    hitPlus10Within20Rate: rateTruthy(hit10),
    drawdownWorseThanMinus5Rate: rateTruthy(dd5),
    rs20Split,
  };
}

function sweepPassCohort(arm: SweepArmResult): CohortKey {
  return `sweep_new_pass:${arm.dimensionKey}:${arm.multiplier}`;
}

function sweepRejectCohort(arm: SweepArmResult): CohortKey {
  return `sweep_new_reject:${arm.dimensionKey}:${arm.multiplier}`;
}

function buildSweepArmsForReplayRows(
  replayRows: Gate2ReplayEvaluationRow[],
  rsByUnderlying?: Map<string, RelativeStrengthDiagnostic | null>
): SweepArmResult[] {
  const baselineSnapshots = replayRows.map((row) =>
    evaluateSymbolAtSession({
      symbol: row.symbol,
      bars: row.bars,
      sessionDate: row.sessionDate,
      rsDiagnostic: rsByUnderlying?.get(row.symbol.split("@")[0]!) ?? null,
    })
  );

  const arms: SweepArmResult[] = [];
  for (const dimension of GATE2_SWEEP_DIMENSIONS) {
    for (const multiplier of dimension.multipliers) {
      if (multiplier === 1) continue;
      const evalParams = gate2EvalParamsForSweep(dimension, multiplier);
      const variantSnapshots = replayRows.map((row) =>
        evaluateSymbolAtSession({
          symbol: row.symbol,
          bars: row.bars,
          sessionDate: row.sessionDate,
          evalParams,
          rsDiagnostic: rsByUnderlying?.get(row.symbol.split("@")[0]!) ?? null,
        })
      );
      arms.push(
        buildSweepArm(dimension, multiplier, baselineSnapshots, variantSnapshots)
      );
    }
  }
  return arms;
}

export function buildLabeledForwardRows(params: {
  replayRows: Gate2ReplayEvaluationRow[];
  rsByUnderlying?: Map<string, RelativeStrengthDiagnostic | null>;
  includeSweepArms: boolean;
  includeSweepRejects: boolean;
}): LabeledForwardRow[] {
  if (params.replayRows.length === 0) return [];

  const baselineSnapshots = params.replayRows.map((row) =>
    evaluateSymbolAtSession({
      symbol: row.symbol,
      bars: row.bars,
      sessionDate: row.sessionDate,
      rsDiagnostic: params.rsByUnderlying?.get(row.symbol.split("@")[0]!) ?? null,
    })
  );

  const passSets = new Map<string, Set<string>>();
  const rejectSets = new Map<string, Set<string>>();
  if (params.includeSweepArms) {
    const arms = buildSweepArmsForReplayRows(params.replayRows, params.rsByUnderlying);
    for (const arm of arms) {
      passSets.set(sweepPassCohort(arm), new Set(arm.newlyPassingSymbols));
      if (params.includeSweepRejects) {
        rejectSets.set(sweepRejectCohort(arm), new Set(arm.newlyRejectedSymbols));
      }
    }
  }

  return params.replayRows.map((row, idx) => {
    const snap = baselineSnapshots[idx]!;
    const cohorts: CohortKey[] = [];

    if (snap.quality === "A") cohorts.push("baseline_tier_a");
    if (snap.quality === "B") cohorts.push("baseline_tier_b");
    const invalidRs = classifyInvalidRs20Cohort(snap.quality, snap.rs20SpreadPct);
    if (invalidRs) cohorts.push(invalidRs);

    for (const [cohort, symbols] of passSets) {
      if (symbols.has(row.symbol)) cohorts.push(cohort);
    }
    for (const [cohort, symbols] of rejectSets) {
      if (symbols.has(row.symbol)) cohorts.push(cohort);
    }

    const forward = computeForwardReturnLabels(row.fullBars, row.sessionDate);

    return {
      symbol: row.symbol,
      sessionDate: snap.sessionDate,
      cohorts,
      baselineQuality: snap.quality,
      terminalCode: snap.terminalCode,
      rs20SpreadPct: snap.rs20SpreadPct,
      forward,
    };
  });
}

export function buildForwardReturnValidationReport(params: {
  replayRows: Gate2ReplayEvaluationRow[];
  rsByUnderlying?: Map<string, RelativeStrengthDiagnostic | null>;
  includeSweepArms?: boolean;
  includeSweepRejects?: boolean;
  lookbackSessions?: number;
}): ForwardReturnValidationReport {
  const includeSweepArms = params.includeSweepArms ?? true;
  const includeSweepRejects = params.includeSweepRejects ?? false;

  const labeled = buildLabeledForwardRows({
    replayRows: params.replayRows,
    rsByUnderlying: params.rsByUnderlying,
    includeSweepArms,
    includeSweepRejects,
  });

  const cohortKeys = new Set<CohortKey>();
  for (const row of labeled) {
    for (const c of row.cohorts) cohortKeys.add(c);
  }

  const priority: CohortKey[] = [
    "baseline_tier_a",
    "baseline_tier_b",
    "invalid_rs20_positive",
    "invalid_rs20_negative",
    "invalid_rs20_neutral_or_missing",
  ];
  const sweepKeys = [...cohortKeys].filter(
    (k) => typeof k === "string" && k.startsWith("sweep_")
  ) as CohortKey[];
  sweepKeys.sort();
  const ordered = [
    ...priority.filter((k) => cohortKeys.has(k)),
    ...sweepKeys,
  ];

  const cohorts = ordered.map((c) => aggregateCohort(labeled, c));

  const anchor =
    params.replayRows.length === 1
      ? params.replayRows[0]!.sessionDate.toISOString().slice(0, 10)
      : `${params.replayRows[0]!.sessionDate.toISOString().slice(0, 10)}…${params.replayRows[params.replayRows.length - 1]!.sessionDate.toISOString().slice(0, 10)}`;

  return {
    reportSchemaVersion: FORWARD_RETURN_REPORT_SCHEMA_VERSION,
    disclaimer:
      "Forward-return validation is diagnostic only — past outcomes do not guarantee future results. Do not change production thresholds from small samples.",
    anchorSession: anchor,
    evaluationRowCount: labeled.length,
    lookbackSessions: params.lookbackSessions ?? 1,
    includeSweepArms,
    includeSweepRejects,
    cohorts,
    sweepArmCount: sweepKeys.filter((k) => k.startsWith("sweep_new_pass")).length,
  };
}

export function formatForwardReturnReportTable(report: ForwardReturnValidationReport): string {
  const lines: string[] = [];
  lines.push(
    `Gate 2 forward-return validation (anchor ${report.anchorSession}, rows=${report.evaluationRowCount})`
  );
  lines.push(report.disclaimer);
  lines.push("");

  for (const c of report.cohorts) {
    lines.push(`── ${c.label} (n=${c.sampleSize})`);
    if (c.smallSampleWarning) lines.push(`   ⚠ ${c.smallSampleWarning}`);
    if (c.highMissingFuture20Warning) lines.push(`   ⚠ ${c.highMissingFuture20Warning}`);
    if (c.missingFutureBars > 0) {
      const pct =
        c.missingFuture20Pct != null
          ? ` (${(c.missingFuture20Pct * 100).toFixed(1)}%)`
          : "";
      lines.push(`   missing/short 20d forward: ${c.missingFutureBars}${pct}`);
    }
    for (const h of c.horizons) {
      lines.push(
        `   Fwd ${h.horizon}d: n=${h.n} avg=${fmt(h.avgPct)}% med=${fmt(h.medianPct)}% win=${fmtPct(h.winRate)}`
      );
    }
    lines.push(
      `   MFE20 avg=${fmt(c.avgMaxFavorableExcursion20Pct)}% · MAE20 avg=${fmt(c.avgMaxAdverseExcursion20Pct)}%`
    );
    lines.push(
      `   hit+5 before -3: ${fmtPct(c.hitPlus5BeforeMinus3Rate)} · hit+10: ${fmtPct(c.hitPlus10Within20Rate)} · DD<-5%: ${fmtPct(c.drawdownWorseThanMinus5Rate)}`
    );
    if (c.rs20Split) {
      lines.push(
        `   RS20 split: pos n=${c.rs20Split.positive.n} avg20=${fmt(c.rs20Split.positive.avgForward20Pct)}% · neg n=${c.rs20Split.negative.n} avg20=${fmt(c.rs20Split.negative.avgForward20Pct)}%`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
