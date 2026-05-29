import type { Gate2Quality } from "./types";
import type { ForwardReturnHorizon, ForwardReturnLabels } from "./forward-returns";
import { FORWARD_RETURN_HORIZONS } from "./forward-returns";
import { HIGH_MISSING_FUTURE_20D_RATE, SMALL_SAMPLE_THRESHOLD } from "./forward-return-validation";
import {
  compareGate2RankOrdering,
  type Gate2RankOrderingComparison,
  type Gate2RankOrderingEntry,
} from "./rs-rank-term";

export const RS_RANK_EVIDENCE_SCHEMA_VERSION = "d2.1-rs-rank-evidence";
/** Minimum A/B replay rows recommended before enabling RS-adjusted production ordering. */
export const RS_RANK_ENABLE_MIN_AB_SAMPLES = 30;

export type RsRankReplayAbRow = {
  symbol: string;
  underlying: string;
  sessionDate: string;
  quality: Gate2Quality;
  terminalCode: string;
  rankScoreBase: number;
  rs20SpreadPct: number | null;
  rs50SpreadPct: number | null;
  rsTerm: number;
  rankScoreWithRs: number;
  forward: ForwardReturnLabels | null;
};

export type ForwardHorizonSummary = {
  horizon: ForwardReturnHorizon;
  n: number;
  avgPct: number | null;
  medianPct: number | null;
  winRate: number | null;
};

export type ForwardOutcomeGroupSummary = {
  group: "promoted" | "demoted" | "unchanged";
  sampleSize: number;
  missingFuture20: number;
  missingFuture20Pct: number | null;
  highMissingFuture20Warning: string | null;
  horizons: ForwardHorizonSummary[];
  avgMfe20Pct: number | null;
  avgMae20Pct: number | null;
  hitPlus5BeforeMinus3Rate: number | null;
  hitPlus10Within20Rate: number | null;
  drawdownWorseThanMinus5Rate: number | null;
};

export type RsRankEvidenceReport = {
  reportSchemaVersion: string;
  anchorSession: string;
  lookbackSessions: number;
  mode: "anchor_ab" | "walkforward_ab";
  formula: string;
  productionRsRankEnabled: boolean;
  abCandidateCount: number;
  tierCounts: { A: number; B: number };
  evaluationRowCount: number;
  ordering: Gate2RankOrderingComparison;
  entriesDetailed: Array<
    Gate2RankOrderingEntry & {
      underlying: string;
      sessionDate: string;
      quality: Gate2Quality;
      terminalCode: string;
      rs50SpreadPct: number | null;
      rankDelta: number;
      forward20Pct: number | null;
    }
  >;
  forwardOutcomes: ForwardOutcomeGroupSummary[];
  smallSampleWarning: string | null;
  enablementReadiness: "insufficient_ab_sample" | "insufficient_ordering_changes" | "review_forward_outcomes" | "not_recommended_yet";
  enablementRecommendation: string;
  rsAtAnchorLimitation: string;
};

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

export function aggregateForwardOutcomeGroup(
  group: ForwardOutcomeGroupSummary["group"],
  rows: RsRankReplayAbRow[]
): ForwardOutcomeGroupSummary {
  const missingFuture20 = rows.filter(
    (r) => r.forward == null || r.forward.futureSessionsAvailable < 20
  ).length;
  const sampleSize = rows.length;
  const missingFuture20Pct = sampleSize > 0 ? missingFuture20 / sampleSize : null;

  const horizons: ForwardHorizonSummary[] = FORWARD_RETURN_HORIZONS.map((horizon) => {
    const vals = rows
      .map((r) => r.forward?.forwardReturnPct[horizon])
      .filter((v): v is number => v != null && Number.isFinite(v));
    return { horizon, n: vals.length, avgPct: mean(vals), medianPct: median(vals), winRate: winRate(vals) };
  });

  const mfe = rows
    .map((r) => r.forward?.maxFavorableExcursion20Pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const mae = rows
    .map((r) => r.forward?.maxAdverseExcursion20Pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const hit53 = rows
    .map((r) => r.forward?.hitPlus5BeforeMinus3)
    .filter((v): v is boolean => v != null);
  const hit10 = rows
    .map((r) => r.forward?.hitPlus10Within20)
    .filter((v): v is boolean => v != null);
  const dd5 = rows
    .map((r) => r.forward?.drawdownWorseThanMinus5Within20)
    .filter((v): v is boolean => v != null);

  return {
    group,
    sampleSize,
    missingFuture20,
    missingFuture20Pct,
    highMissingFuture20Warning:
      missingFuture20Pct != null && missingFuture20Pct > HIGH_MISSING_FUTURE_20D_RATE
        ? `>${(HIGH_MISSING_FUTURE_20D_RATE * 100).toFixed(0)}% missing 20-session forward labels (${missingFuture20}/${sampleSize}).`
        : null,
    horizons,
    avgMfe20Pct: mean(mfe),
    avgMae20Pct: mean(mae),
    hitPlus5BeforeMinus3Rate: rateTruthy(hit53),
    hitPlus10Within20Rate: rateTruthy(hit10),
    drawdownWorseThanMinus5Rate: rateTruthy(dd5),
  };
}

function underlyingFromSymbol(symbol: string): string {
  const at = symbol.indexOf("@");
  return at >= 0 ? symbol.slice(0, at) : symbol;
}

export function buildRsRankEvidenceReport(params: {
  anchorSession: string;
  lookbackSessions: number;
  mode: RsRankEvidenceReport["mode"];
  formula: string;
  productionRsRankEnabled: boolean;
  abRows: RsRankReplayAbRow[];
  evaluationRowCount: number;
  rsComputedPerSession: boolean;
}): RsRankEvidenceReport {
  const ordering = compareGate2RankOrdering(
    params.abRows.map((r) => ({
      symbol: r.symbol,
      rankScoreBase: r.rankScoreBase,
      rs20SpreadPct: r.rs20SpreadPct,
    }))
  );

  const rowBySymbol = new Map(params.abRows.map((r) => [r.symbol, r]));

  const entriesDetailed = ordering.entries.map((e) => {
    const row = rowBySymbol.get(e.symbol);
    return {
      ...e,
      underlying: row?.underlying ?? underlyingFromSymbol(e.symbol),
      sessionDate: row?.sessionDate ?? "",
      quality: row?.quality ?? "INVALID",
      terminalCode: row?.terminalCode ?? "",
      rs50SpreadPct: row?.rs50SpreadPct ?? null,
      rankDelta: e.baseRank - e.rsAdjustedRank,
      forward20Pct: row?.forward?.forwardReturnPct[20] ?? null,
    };
  });

  const promotedSymbols = new Set(ordering.promoted.map((p) => p.symbol));
  const demotedSymbols = new Set(ordering.demoted.map((d) => d.symbol));

  const promotedRows = params.abRows.filter((r) => promotedSymbols.has(r.symbol));
  const demotedRows = params.abRows.filter((r) => demotedSymbols.has(r.symbol));
  const unchangedRows = params.abRows.filter(
    (r) => !promotedSymbols.has(r.symbol) && !demotedSymbols.has(r.symbol)
  );

  const forwardOutcomes: ForwardOutcomeGroupSummary[] = [
    aggregateForwardOutcomeGroup("promoted", promotedRows),
    aggregateForwardOutcomeGroup("demoted", demotedRows),
    aggregateForwardOutcomeGroup("unchanged", unchangedRows),
  ];

  const tierCounts = {
    A: params.abRows.filter((r) => r.quality === "A").length,
    B: params.abRows.filter((r) => r.quality === "B").length,
  };

  const abCandidateCount = params.abRows.length;
  const orderingChanges = ordering.promoted.length + ordering.demoted.length;

  let smallSampleWarning: string | null = null;
  if (abCandidateCount < SMALL_SAMPLE_THRESHOLD) {
    smallSampleWarning = `Very small A/B sample (n=${abCandidateCount}) — hypothesis only.`;
  } else if (abCandidateCount < RS_RANK_ENABLE_MIN_AB_SAMPLES) {
    smallSampleWarning = `A/B sample below enablement threshold (n=${abCandidateCount}, need ≥${RS_RANK_ENABLE_MIN_AB_SAMPLES}).`;
  }

  let enablementReadiness: RsRankEvidenceReport["enablementReadiness"] =
    "not_recommended_yet";
  let enablementRecommendation =
    "Keep RS rank preview only — do not enable GATE2_RS_RANK_TERM_ENABLED.";

  if (abCandidateCount < RS_RANK_ENABLE_MIN_AB_SAMPLES) {
    enablementReadiness = "insufficient_ab_sample";
    enablementRecommendation = `Collect more walk-forward A/B samples (≥${RS_RANK_ENABLE_MIN_AB_SAMPLES}) before staging enablement.`;
  } else if (orderingChanges === 0) {
    enablementReadiness = "insufficient_ordering_changes";
    enablementRecommendation =
      "RS term does not change rank order on this sample — keep preview only.";
  } else {
    enablementReadiness = "review_forward_outcomes";
    const prom = forwardOutcomes.find((g) => g.group === "promoted");
    const dem = forwardOutcomes.find((g) => g.group === "demoted");
    const prom20 = prom?.horizons.find((h) => h.horizon === 20);
    const dem20 = dem?.horizons.find((h) => h.horizon === 20);
    if (
      prom20 &&
      dem20 &&
      prom20.n >= SMALL_SAMPLE_THRESHOLD &&
      dem20.n >= SMALL_SAMPLE_THRESHOLD &&
      prom20.avgPct != null &&
      dem20.avgPct != null &&
      prom20.avgPct > dem20.avgPct &&
      (prom?.drawdownWorseThanMinus5Rate ?? 1) <= (dem?.drawdownWorseThanMinus5Rate ?? 1) + 0.05
    ) {
      enablementRecommendation =
        "Consider staging GATE2_RS_RANK_TERM_ENABLED after sign-off — promoted group shows better forward-20d with acceptable drawdown.";
    } else {
      enablementRecommendation =
        "Ordering changes exist but forward outcomes do not clearly favor promoted group — keep preview only.";
    }
  }

  const rsLimitation = params.rsComputedPerSession
    ? "RS20/RS50 computed at each replay session date."
    : "RS loaded at anchor session for all rows (walk-forward look-ahead bias on historical sessions).";

  return {
    reportSchemaVersion: RS_RANK_EVIDENCE_SCHEMA_VERSION,
    anchorSession: params.anchorSession,
    lookbackSessions: params.lookbackSessions,
    mode: params.mode,
    formula: params.formula,
    productionRsRankEnabled: params.productionRsRankEnabled,
    abCandidateCount,
    tierCounts,
    evaluationRowCount: params.evaluationRowCount,
    ordering,
    entriesDetailed,
    forwardOutcomes,
    smallSampleWarning,
    enablementReadiness,
    enablementRecommendation,
    rsAtAnchorLimitation: rsLimitation,
  };
}

export function formatRsRankEvidenceTable(report: RsRankEvidenceReport): string {
  const lines: string[] = [];
  lines.push(
    `RS rank evidence (${report.mode}, anchor ${report.anchorSession}, lookback ${report.lookbackSessions})`
  );
  lines.push(`A/B candidates: ${report.abCandidateCount} (A=${report.tierCounts.A}, B=${report.tierCounts.B})`);
  lines.push(`Ordering changes: +${report.ordering.promoted.length} promoted, ${report.ordering.demoted.length} demoted`);
  if (report.smallSampleWarning) lines.push(`⚠ ${report.smallSampleWarning}`);
  lines.push(report.enablementRecommendation);
  lines.push("");
  lines.push(
    "symbol".padEnd(14) +
      "sess".padStart(11) +
      "Q".padStart(3) +
      "base".padStart(7) +
      "rsT".padStart(7) +
      "+RS".padStart(7) +
      "R#".padStart(4) +
      "R+RS".padStart(5) +
      "RS20".padStart(8)
  );
  lines.push("-".repeat(66));
  for (const e of [...report.entriesDetailed].sort((a, b) => a.baseRank - b.baseRank)) {
    const rs20 =
      e.rs20SpreadPct == null ? "—" : `${e.rs20SpreadPct >= 0 ? "+" : ""}${e.rs20SpreadPct.toFixed(1)}`;
    lines.push(
      e.symbol.slice(0, 13).padEnd(14) +
        e.sessionDate.slice(5).padStart(11) +
        e.quality.padStart(3) +
        e.rankScoreBase.toFixed(0).padStart(7) +
        e.rsTerm.toFixed(0).padStart(7) +
        e.rankScoreWithRs.toFixed(0).padStart(7) +
        String(e.baseRank).padStart(4) +
        String(e.rsAdjustedRank).padStart(5) +
        rs20.padStart(8)
    );
  }
  for (const g of report.forwardOutcomes) {
    if (g.sampleSize === 0) continue;
    lines.push("");
    lines.push(`Forward outcomes — ${g.group} (n=${g.sampleSize})`);
    if (g.highMissingFuture20Warning) lines.push(`  ⚠ ${g.highMissingFuture20Warning}`);
    const h20 = g.horizons.find((h) => h.horizon === 20);
    if (h20) {
      lines.push(
        `  Fwd20: n=${h20.n} avg=${h20.avgPct?.toFixed(2) ?? "—"}% win=${h20.winRate != null ? (h20.winRate * 100).toFixed(1) : "—"}%`
      );
    }
    lines.push(
      `  MFE20=${g.avgMfe20Pct?.toFixed(2) ?? "—"}% MAE20=${g.avgMae20Pct?.toFixed(2) ?? "—"}% hit+5/-3=${g.hitPlus5BeforeMinus3Rate != null ? (g.hitPlus5BeforeMinus3Rate * 100).toFixed(1) : "—"}%`
    );
  }
  return lines.join("\n");
}
