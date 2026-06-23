import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import {
  applyCalibrationVariant,
  type CalibrationContext,
  type CalibrationVariantId,
  type Gate1RegimeLevel,
} from "./calibration";
import type { EarlyEntryEvaluationResult, EarlyEntryTradeState } from "./types";
import { tradeStateDisplayLabel } from "./state-machine";

/** Variants tracked in paper-trading validation (experimental). */
export const PAPER_CALIBRATION_VARIANTS = [
  "baseline",
  "rr_min_2_5",
  "demote_weak_regime",
  "rr_min_2_5_plus_demote_weak_regime",
  "next_day_confirmation_candidate",
  "two_day_follow_through",
] as const;

export type PaperCalibrationVariantId = (typeof PAPER_CALIBRATION_VARIANTS)[number];

export type PaperCalibrationResult = {
  state: EarlyEntryTradeState;
  displayLabel: string;
  pilotQualified: boolean;
  demotedFromPilot: boolean;
  note: string | null;
};

export type PaperSignalRecord = {
  id: string;
  sessionDate: string;
  symbol: string;
  loggedAt: string;
  close: number;
  volume: number;
  gate1Level: Gate1RegimeLevel | null;
  gate1RegimeLabel: string;
  gate2Quality: string;
  gate2TerminalCode: string | null;
  rs20SpreadPct: number | null;
  rs20Delta3d: number | null;
  baselineState: EarlyEntryTradeState;
  displayLabel: string;
  entryType: string | null;
  earlyReversalScore: number;
  estimatedRiskReward: number | null;
  stopDistancePct: number | null;
  estimatedRewardPct: number | null;
  targetPrice: number | null;
  targetReason: string | null;
  invalidLevel: number | null;
  invalidLevelReason: string | null;
  reasonCodes: string[];
  transitionReasonCodes: string[];
  calibration: Record<PaperCalibrationVariantId, PaperCalibrationResult>;
  suggestedAction: string;
  whyNotPilotYet: string | null;
  outcomes: PaperSignalOutcomes | null;
};

export type PaperSignalOutcomes = {
  resolvedAt: string;
  ret5d: number | null;
  ret10d: number | null;
  ret20d: number | null;
  mae10d: number | null;
  mfe10d: number | null;
  rMultiple: number | null;
  invalidLevelHit: boolean;
  targetHit: boolean;
  gate2BecameAb: boolean;
  extendedAvoidedBad5d: boolean | null;
};

export type PaperSignalStore = {
  version: 1;
  lastUpdated: string;
  signals: PaperSignalRecord[];
};

export const PAPER_SIGNALS_PATH = "docs/trading/evidence/early-entry-paper-signals.json";

export function paperSignalId(symbol: string, sessionDate: string): string {
  return `${symbol.toUpperCase()}|${sessionDate}`;
}

export function isPaperWorthySignal(state: EarlyEntryTradeState, score: number): boolean {
  if (state === "BLOCKED") return false;
  if (state === "EXTENDED_DO_NOT_CHASE") return true;
  if (state === "PILOT_BUY" || state === "ADD_ZONE" || state === "CONFIRMED_BUY") return true;
  return score >= 35;
}

export function applyPaperCalibration(
  evaluation: EarlyEntryEvaluationResult,
  variant: PaperCalibrationVariantId,
  ctx: CalibrationContext
): PaperCalibrationResult {
  const result = applyCalibrationVariant(
    evaluation,
    variant as CalibrationVariantId,
    ctx
  );
  const pilotQualified = result.state === "PILOT_BUY";
  return {
    state: result.state,
    displayLabel: tradeStateDisplayLabel(result.state),
    pilotQualified,
    demotedFromPilot: result.demotedFromPilot,
    note: result.calibrationNote,
  };
}

export function buildPaperCalibrationMap(
  evaluation: EarlyEntryEvaluationResult,
  ctx: CalibrationContext
): Record<PaperCalibrationVariantId, PaperCalibrationResult> {
  const out = {} as Record<PaperCalibrationVariantId, PaperCalibrationResult>;
  for (const variant of PAPER_CALIBRATION_VARIANTS) {
    out[variant] = applyPaperCalibration(evaluation, variant, ctx);
  }
  return out;
}

export function paperSuggestedAction(
  baselineState: EarlyEntryTradeState,
  calibration: Record<PaperCalibrationVariantId, PaperCalibrationResult>
): string {
  if (baselineState === "EXTENDED_DO_NOT_CHASE") {
    return "Research: avoid chasing — defensive signal only; needs forward validation.";
  }
  if (calibration.baseline.pilotQualified) {
    return "Research: Pilot Candidate under review — not a buy recommendation.";
  }
  const anyVariantPilot = PAPER_CALIBRATION_VARIANTS.some(
    (v) => v !== "baseline" && calibration[v].pilotQualified
  );
  if (anyVariantPilot) {
    return "Research: experimental variant qualified — paper validation only.";
  }
  if (baselineState === "WATCH") {
    return "Research: watch early structure — wait for R:R and confirmation.";
  }
  return "Research signal only — display-only lane.";
}

export type BuildPaperSignalParams = {
  symbol: string;
  sessionDate: string;
  evaluation: EarlyEntryEvaluationResult;
  calibrationCtx: CalibrationContext;
  gate1RegimeLabel: string;
  gate2Quality: string;
  gate2TerminalCode: string | null;
  loggedAt?: string;
};

export function buildPaperSignal(params: BuildPaperSignalParams): PaperSignalRecord {
  const { evaluation: ev, calibrationCtx } = params;
  const calibration = buildPaperCalibrationMap(ev, calibrationCtx);
  const display = tradeStateDisplayLabel(ev.proposedTradeState);

  return {
    id: paperSignalId(params.symbol, params.sessionDate),
    sessionDate: params.sessionDate,
    symbol: params.symbol.toUpperCase(),
    loggedAt: params.loggedAt ?? new Date().toISOString(),
    close: ev.metrics.close,
    volume: ev.metrics.volume,
    gate1Level: calibrationCtx.gate1Level,
    gate1RegimeLabel: params.gate1RegimeLabel,
    gate2Quality: params.gate2Quality,
    gate2TerminalCode: params.gate2TerminalCode,
    rs20SpreadPct: ev.metrics.rs20SpreadPct,
    rs20Delta3d: ev.metrics.rs20Delta3d,
    baselineState: ev.proposedTradeState,
    displayLabel: display,
    entryType: ev.entryType,
    earlyReversalScore: ev.earlyReversalScore,
    estimatedRiskReward: ev.estimatedRiskReward,
    stopDistancePct: ev.stopDistancePct,
    estimatedRewardPct: ev.estimatedRewardPct,
    targetPrice: ev.targetPrice,
    targetReason: ev.targetReason,
    invalidLevel: ev.invalidLevel,
    invalidLevelReason: ev.invalidLevelReason,
    reasonCodes: [...ev.reasonCodes],
    transitionReasonCodes: [...ev.transitionReasonCodes],
    calibration,
    suggestedAction: paperSuggestedAction(ev.proposedTradeState, calibration),
    whyNotPilotYet: ev.whyNotPilotYet,
    outcomes: null,
  };
}

export function mergeSignalsIntoStore(
  store: PaperSignalStore,
  incoming: PaperSignalRecord[]
): PaperSignalStore {
  const byId = new Map(store.signals.map((s) => [s.id, s]));
  for (const sig of incoming) {
    const existing = byId.get(sig.id);
    if (existing?.outcomes) {
      byId.set(sig.id, { ...sig, outcomes: existing.outcomes });
    } else {
      byId.set(sig.id, sig);
    }
  }
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    signals: [...byId.values()].sort((a, b) =>
      a.sessionDate === b.sessionDate
        ? a.symbol.localeCompare(b.symbol)
        : a.sessionDate.localeCompare(b.sessionDate)
    ),
  };
}

export function forwardReturn(
  bars: readonly Gate2BarInput[],
  idx: number,
  days: number
): number | null {
  const target = idx + days;
  if (target >= bars.length) return null;
  const entry = bars[idx]!.close;
  const exit = bars[target]!.close;
  if (!(entry > 0)) return null;
  return ((exit - entry) / entry) * 100;
}

export function excursion(
  bars: readonly Gate2BarInput[],
  idx: number,
  days: number
): { mae: number | null; mfe: number | null } {
  const entry = bars[idx]!.close;
  if (!(entry > 0)) return { mae: null, mfe: null };
  let minLow = entry;
  let maxHigh = entry;
  const end = Math.min(bars.length - 1, idx + days);
  for (let i = idx + 1; i <= end; i++) {
    minLow = Math.min(minLow, bars[i]!.low);
    maxHigh = Math.max(maxHigh, bars[i]!.high);
  }
  return {
    mae: ((minLow - entry) / entry) * 100,
    mfe: ((maxHigh - entry) / entry) * 100,
  };
}

export function resolvePaperSignalOutcomes(params: {
  signal: PaperSignalRecord;
  bars: readonly Gate2BarInput[];
  sessionIdx: number;
  gate2BecameAb: boolean;
}): PaperSignalOutcomes | null {
  const { signal, bars, sessionIdx, gate2BecameAb } = params;
  const ret20 = forwardReturn(bars, sessionIdx, 20);
  if (ret20 == null) return null;

  const { mae, mfe } = excursion(bars, sessionIdx, 10);
  const stopDist = signal.stopDistancePct;
  const rMultiple =
    stopDist != null && stopDist > 0 && mfe != null ? mfe / stopDist : null;

  let invalidLevelHit = false;
  let targetHit = false;
  if (signal.invalidLevel != null) {
    for (let i = sessionIdx + 1; i <= Math.min(bars.length - 1, sessionIdx + 20); i++) {
      if (bars[i]!.low < signal.invalidLevel) {
        invalidLevelHit = true;
        break;
      }
    }
  }
  if (signal.targetPrice != null) {
    for (let i = sessionIdx + 1; i <= Math.min(bars.length - 1, sessionIdx + 20); i++) {
      if (bars[i]!.high >= signal.targetPrice) {
        targetHit = true;
        break;
      }
    }
  }

  const ret5 = forwardReturn(bars, sessionIdx, 5);
  const extendedAvoidedBad5d =
    signal.baselineState === "EXTENDED_DO_NOT_CHASE"
      ? ret5 != null && ret5 < 0
      : null;

  return {
    resolvedAt: new Date().toISOString(),
    ret5d: ret5,
    ret10d: forwardReturn(bars, sessionIdx, 10),
    ret20d: ret20,
    mae10d: mae,
    mfe10d: mfe,
    rMultiple,
    invalidLevelHit,
    targetHit,
    gate2BecameAb,
    extendedAvoidedBad5d,
  };
}

export type PaperAcceptanceResult = {
  ready: boolean;
  blockers: string[];
  checks: Record<string, boolean>;
};

export function evaluatePaperAcceptance(params: {
  variant: PaperCalibrationVariantId;
  resolvedPilots: PaperSignalRecord[];
}): PaperAcceptanceResult {
  const pilots = params.resolvedPilots.filter((s) => s.calibration[params.variant].pilotQualified);
  const blockers: string[] = [];
  const checks: Record<string, boolean> = {};

  checks.minSignals = pilots.length >= 20;
  if (!checks.minSignals) blockers.push(`Need ≥20 resolved pilots (have ${pilots.length})`);

  const falsePilots = pilots.filter((p) => (p.outcomes?.ret10d ?? 0) < 0);
  const falseRate = pilots.length ? falsePilots.length / pilots.length : 1;
  checks.falsePilotRate = pilots.length > 0 && falseRate <= 0.35;
  if (!checks.falsePilotRate) {
    blockers.push(`False pilot rate ${(falseRate * 100).toFixed(0)}% exceeds 35%`);
  }

  const rMultiples = pilots
    .map((p) => p.outcomes?.rMultiple)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const avgR = rMultiples.length
    ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length
    : null;
  checks.avgRMultiplePositive = avgR != null && avgR > 0;
  if (!checks.avgRMultiplePositive) blockers.push("Average R multiple not positive");

  const ret10 = pilots.map((p) => p.outcomes?.ret10d).filter((v): v is number => v != null);
  const sorted10 = [...ret10].sort((a, b) => a - b);
  const median10 =
    sorted10.length === 0
      ? null
      : sorted10.length % 2 === 0
        ? (sorted10[sorted10.length / 2 - 1]! + sorted10[sorted10.length / 2]!) / 2
        : sorted10[Math.floor(sorted10.length / 2)]!;
  checks.median10dPositive = median10 != null && median10 > 0;
  if (!checks.median10dPositive) blockers.push("Median 10d return not positive");

  const maeVals = pilots.map((p) => p.outcomes?.mae10d).filter((v): v is number => v != null);
  const avgMae = maeVals.length ? maeVals.reduce((a, b) => a + b, 0) / maeVals.length : null;
  checks.maeAcceptable = avgMae == null || avgMae > -12;
  if (!checks.maeAcceptable) blockers.push("Average MAE worse than -12%");

  if (pilots.length >= 3) {
    const sorted = [...pilots].sort(
      (a, b) => (b.outcomes?.ret10d ?? -999) - (a.outcomes?.ret10d ?? -999)
    );
    const top = sorted[0]!.outcomes?.ret10d ?? 0;
    const rest = sorted.slice(1);
    const restAvg =
      rest.length > 0
        ? rest.reduce((s, p) => s + (p.outcomes?.ret10d ?? 0), 0) / rest.length
        : 0;
    checks.notOutlierDriven = top < restAvg * 3 || rest.length < 2;
    if (!checks.notOutlierDriven) blockers.push("Results appear driven by a single outlier");
  } else {
    checks.notOutlierDriven = false;
    blockers.push("Too few signals to assess outlier stability");
  }

  const regimes = new Set(pilots.map((p) => p.gate1RegimeLabel));
  checks.multiRegime = regimes.size >= 2;
  if (!checks.multiRegime) blockers.push("Need signals across ≥2 market regimes");

  const ready = Object.values(checks).every(Boolean);
  return { ready, blockers, checks };
}

export function emptyPaperStore(): PaperSignalStore {
  return { version: 1, lastUpdated: new Date().toISOString(), signals: [] };
}
