import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import { resolveTerminalCode } from "./gate2-threshold-sweep";
import {
  buildReplayRowsForSymbol,
  futureSessionsAfter,
  GATE2_FORWARD_20_SESSIONS,
  GATE2_MIN_BARS_FOR_EVAL,
  hasSufficientForwardSessions,
  maxEvaluationSessionWithForward,
  type Gate2ReplayEvaluationRow,
} from "./gate2-replay-dataset";
import type { Gate2BarInput, Gate2Quality } from "./types";
import { RS_RANK_ENABLE_MIN_AB_SAMPLES } from "./rs-rank-evidence";

export const EVIDENCE_READINESS_SCHEMA_VERSION = "d2.2-evidence-readiness";
export const DECISION_GRADE_AB_TARGET = RS_RANK_ENABLE_MIN_AB_SAMPLES;

export type SymbolBarSummary = {
  symbol: string;
  barCount: number;
  latestBarDate: string | null;
  latestBarMatchesAnchor: boolean;
  maxEvalWithForward20: string | null;
};

export type LookbackWindowReadiness = {
  lookbackSessions: number;
  tradableSymbolCount: number;
  replayRowCount: number;
  replayRowCountForward20Eligible: number;
  qualityCounts: { A: number; B: number; INVALID: number };
  qualityCountsForward20Eligible: { A: number; B: number; INVALID: number };
  abCount: number;
  abCountForward20Eligible: number;
  missingForward20Count: number;
  missingForward20Rate: number | null;
  rowsWithForward5: number;
  rowsWithForward10: number;
  rowsWithForward20: number;
  terminalCodeCounts: Record<string, number>;
  decisionGradeAb: boolean;
};

export type EvidenceReadinessReport = {
  reportSchemaVersion: string;
  anchorSession: string;
  activeSymbolCount: number;
  symbolsWithMinBars: number;
  symbolsWithForward20Capacity: number;
  tradableAtAnchorCount: number;
  staleBarSymbolCount: number;
  lookbackWindows: LookbackWindowReadiness[];
  bestAbCountForward20Eligible: number;
  bestLookbackForAb: number | null;
  recommendedLookbackForAb30: number | null;
  decisionGradeAbAchievable: boolean;
  readinessVerdict: string;
  recommendation: string;
};

export type ReplayRowGate2Snapshot = {
  symbol: string;
  sessionDate: string;
  quality: Gate2Quality;
  terminalCode: string;
  futureSessionsAvailable: number;
  hasForward5: boolean;
  hasForward10: boolean;
  hasForward20: boolean;
};

export function snapshotReplayRowGate2(
  row: Gate2ReplayEvaluationRow
): ReplayRowGate2Snapshot {
  const ev = evaluateBreakoutPullbackCandidate(row.bars, row.sessionDate);
  const future = futureSessionsAfter(row.fullBars, row.sessionDate);
  return {
    symbol: row.symbol,
    sessionDate: row.sessionDate.toISOString().slice(0, 10),
    quality: ev.quality,
    terminalCode: resolveTerminalCode(ev),
    futureSessionsAvailable: future,
    hasForward5: future >= 5,
    hasForward10: future >= 10,
    hasForward20: future >= GATE2_FORWARD_20_SESSIONS,
  };
}

function emptyQuality(): { A: number; B: number; INVALID: number } {
  return { A: 0, B: 0, INVALID: 0 };
}

function addQuality(
  counts: { A: number; B: number; INVALID: number },
  q: Gate2Quality
): void {
  counts[q]++;
}

export function aggregateLookbackReadiness(params: {
  lookbackSessions: number;
  tradableSymbolCount: number;
  snapshots: ReplayRowGate2Snapshot[];
  forward20EligibleSnapshots: ReplayRowGate2Snapshot[];
}): LookbackWindowReadiness {
  const qualityCounts = emptyQuality();
  const qualityCountsForward20Eligible = emptyQuality();
  const terminalCodeCounts: Record<string, number> = {};

  let rowsWithForward5 = 0;
  let rowsWithForward10 = 0;
  let rowsWithForward20 = 0;

  for (const s of params.snapshots) {
    addQuality(qualityCounts, s.quality);
    terminalCodeCounts[s.terminalCode] = (terminalCodeCounts[s.terminalCode] ?? 0) + 1;
    if (s.hasForward5) rowsWithForward5++;
    if (s.hasForward10) rowsWithForward10++;
    if (s.hasForward20) rowsWithForward20++;
  }

  for (const s of params.forward20EligibleSnapshots) {
    addQuality(qualityCountsForward20Eligible, s.quality);
  }

  const abCount = qualityCounts.A + qualityCounts.B;
  const abCountForward20Eligible =
    qualityCountsForward20Eligible.A + qualityCountsForward20Eligible.B;
  const missingForward20Count = params.snapshots.length - rowsWithForward20;
  const missingForward20Rate =
    params.snapshots.length > 0 ? missingForward20Count / params.snapshots.length : null;

  return {
    lookbackSessions: params.lookbackSessions,
    tradableSymbolCount: params.tradableSymbolCount,
    replayRowCount: params.snapshots.length,
    replayRowCountForward20Eligible: params.forward20EligibleSnapshots.length,
    qualityCounts,
    qualityCountsForward20Eligible,
    abCount,
    abCountForward20Eligible,
    missingForward20Count,
    missingForward20Rate,
    rowsWithForward5,
    rowsWithForward10,
    rowsWithForward20,
    terminalCodeCounts,
    decisionGradeAb: abCountForward20Eligible >= DECISION_GRADE_AB_TARGET,
  };
}

export function recommendLookbackForAbTarget(
  windows: LookbackWindowReadiness[],
  target = DECISION_GRADE_AB_TARGET
): number | null {
  const eligible = windows.filter((w) => w.abCountForward20Eligible >= target);
  if (eligible.length === 0) return null;
  return eligible.reduce((min, w) =>
    w.lookbackSessions < min.lookbackSessions ? w : min
  ).lookbackSessions;
}

export function buildEvidenceReadinessReport(params: {
  anchorSession: string;
  activeSymbolCount: number;
  symbolSummaries: SymbolBarSummary[];
  tradableAtAnchorCount: number;
  lookbackWindows: LookbackWindowReadiness[];
}): EvidenceReadinessReport {
  const symbolsWithMinBars = params.symbolSummaries.filter(
    (s) => s.barCount >= GATE2_MIN_BARS_FOR_EVAL
  ).length;
  const symbolsWithForward20Capacity = params.symbolSummaries.filter(
    (s) => s.maxEvalWithForward20 != null
  ).length;
  const staleBarSymbolCount = params.symbolSummaries.filter(
    (s) => s.latestBarDate != null && !s.latestBarMatchesAnchor
  ).length;

  const bestAbCountForward20Eligible = Math.max(
    0,
    ...params.lookbackWindows.map((w) => w.abCountForward20Eligible)
  );
  const bestLookbackForAb = params.lookbackWindows.reduce<LookbackWindowReadiness | null>(
    (best, w) => (!best || w.abCountForward20Eligible > best.abCountForward20Eligible ? w : best),
    null
  );
  const recommendedLookbackForAb30 = recommendLookbackForAbTarget(params.lookbackWindows);
  const decisionGradeAbAchievable = recommendedLookbackForAb30 != null;

  let readinessVerdict: string;
  let recommendation: string;

  if (decisionGradeAbAchievable) {
    readinessVerdict = `Decision-grade A/B sample achievable at lookback ≥${recommendedLookbackForAb30} with T−20 forward cutoff.`;
    recommendation = `Rerun D1.6 / D2.1 with --lookbackSessions=${recommendedLookbackForAb30} --requireForward20d. RS rank remains preview-only until those reports are reviewed.`;
  } else if (bestAbCountForward20Eligible < DECISION_GRADE_AB_TARGET) {
    const staleNote =
      staleBarSymbolCount > params.activeSymbolCount * 0.1
        ? ` (${staleBarSymbolCount} symbols with latest bar ≠ anchor).`
        : "";
    readinessVerdict = `A/B with forward-20d eligibility peaks at n=${bestAbCountForward20Eligible} (lookback ${bestLookbackForAb?.lookbackSessions ?? "—"}) — below n≥${DECISION_GRADE_AB_TARGET}.${staleNote}`;
    recommendation =
      "Keep RS preview only. Rerun diagnostics at lookback 120 with --requireForward20d for best available sample; pursue near-miss RS watchlist from INVALID cohort rather than production RS rank enablement.";
  } else if (staleBarSymbolCount > params.activeSymbolCount * 0.1) {
    readinessVerdict = `Bar freshness gaps on ${staleBarSymbolCount} symbols vs anchor ${params.anchorSession}.`;
    recommendation =
      "Improve data coverage/freshness first, then rerun readiness. Keep RS preview only.";
  } else {
    readinessVerdict = `Readiness checks passed but enablement criteria not met — review forward outcomes manually.`;
    recommendation = "Keep RS preview only until explicit sign-off.";
  }

  return {
    reportSchemaVersion: EVIDENCE_READINESS_SCHEMA_VERSION,
    anchorSession: params.anchorSession,
    activeSymbolCount: params.activeSymbolCount,
    symbolsWithMinBars,
    symbolsWithForward20Capacity,
    tradableAtAnchorCount: params.tradableAtAnchorCount,
    staleBarSymbolCount,
    lookbackWindows: params.lookbackWindows,
    bestAbCountForward20Eligible,
    bestLookbackForAb: bestLookbackForAb?.lookbackSessions ?? null,
    recommendedLookbackForAb30,
    decisionGradeAbAchievable,
    readinessVerdict,
    recommendation,
  };
}

export function summarizeSymbolBars(
  symbol: string,
  allBars: Gate2BarInput[],
  anchorSession: Date
): SymbolBarSummary {
  const anchorKey = anchorSession.toISOString().slice(0, 10);
  const latest = allBars.length > 0 ? allBars[allBars.length - 1]!.date : null;
  const latestKey = latest?.toISOString().slice(0, 10) ?? null;
  const maxEval = maxEvaluationSessionWithForward(allBars);
  return {
    symbol,
    barCount: allBars.length,
    latestBarDate: latestKey,
    latestBarMatchesAnchor: latestKey === anchorKey,
    maxEvalWithForward20: maxEval?.toISOString().slice(0, 10) ?? null,
  };
}

export function buildSnapshotsForLookback(params: {
  symbol: string;
  allBars: Gate2BarInput[];
  lookbackSessions: number;
  requireForward20d: boolean;
}): { all: ReplayRowGate2Snapshot[]; forward20Eligible: ReplayRowGate2Snapshot[] } {
  const rows = buildReplayRowsForSymbol({
    symbol: params.symbol,
    allBars: params.allBars,
    lookbackSessions: params.lookbackSessions,
    asOf: null,
    requireForward20d: false,
  });
  const all = rows.map(snapshotReplayRowGate2);
  const forward20Eligible = params.requireForward20d
    ? all.filter((s) => s.hasForward20)
    : rows
        .filter((r) => hasSufficientForwardSessions(r.fullBars, r.sessionDate))
        .map(snapshotReplayRowGate2);
  return { all, forward20Eligible };
}

export function formatReadinessTable(report: EvidenceReadinessReport): string {
  const lines: string[] = [];
  lines.push(`Gate 2 evidence readiness (anchor ${report.anchorSession})`);
  lines.push(report.readinessVerdict);
  lines.push("");
  lines.push(
    `Active: ${report.activeSymbolCount} · ≥${GATE2_MIN_BARS_FOR_EVAL} bars: ${report.symbolsWithMinBars} · forward-20d capacity: ${report.symbolsWithForward20Capacity} · tradable@anchor: ${report.tradableAtAnchorCount} · stale bars: ${report.staleBarSymbolCount}`
  );
  lines.push("");
  lines.push(
    "lb".padEnd(5) +
      "replay".padStart(8) +
      "r+20".padStart(8) +
      "A/B".padStart(6) +
      "A/B+20".padStart(8) +
      "miss%".padStart(8) +
      "fwd20".padStart(8)
  );
  lines.push("-".repeat(51));
  for (const w of report.lookbackWindows) {
    const miss =
      w.missingForward20Rate != null
        ? `${(w.missingForward20Rate * 100).toFixed(1)}%`
        : "—";
    lines.push(
      String(w.lookbackSessions).padEnd(5) +
        String(w.replayRowCount).padStart(8) +
        String(w.replayRowCountForward20Eligible).padStart(8) +
        String(w.abCount).padStart(6) +
        String(w.abCountForward20Eligible).padStart(8) +
        miss.padStart(8) +
        String(w.rowsWithForward20).padStart(8)
    );
  }
  lines.push("");
  lines.push(report.recommendation);
  return lines.join("\n");
}
