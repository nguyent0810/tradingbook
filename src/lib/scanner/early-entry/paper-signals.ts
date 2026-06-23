import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
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

export type PaperSignalSource = "historical_seed" | "live_paper";

export type PaperValidationStatus = "open" | "partial" | "resolved";

export type PaperCalibrationResult = {
  state: EarlyEntryTradeState;
  displayLabel: string;
  pilotQualified: boolean;
  demotedFromPilot: boolean;
  note: string | null;
};

export type PaperSignalOutcomes = {
  updatedAt: string;
  ret5d: number | null;
  ret10d: number | null;
  ret20d: number | null;
  mae10d: number | null;
  mfe10d: number | null;
  rMultiple: number | null;
  invalidLevelHit: boolean;
  targetHit: boolean;
  invalidHitBeforeTarget: boolean | null;
  targetHitBeforeInvalid: boolean | null;
  gate2BecameAb: boolean;
  gate2BecameAbSession: string | null;
  extendedAvoidedBad5d: boolean | null;
};

export type PaperSignalRecord = {
  id: string;
  sessionDate: string;
  /** Bar data session the signal was evaluated on (usually equals sessionDate). */
  dataSession: string;
  symbol: string;
  source: PaperSignalSource;
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
  /** Trading sessions of forward data available after signal session. */
  daysAvailable: number;
  validationStatus: PaperValidationStatus;
  isResolved: boolean;
  resolvedAt: string | null;
  outcomes: PaperSignalOutcomes | null;
};

export type PaperSignalStore = {
  version: 2;
  lastUpdated: string;
  signals: PaperSignalRecord[];
};

export const PAPER_SIGNALS_PATH = "docs/trading/evidence/early-entry-paper-signals.json";

export const PAPER_RESOLVE_HORIZONS = { short: 5, mid: 10, full: 20 } as const;

export function paperSignalId(symbol: string, sessionDate: string): string {
  return `${symbol.toUpperCase()}|${sessionDate}`;
}

export function isPaperWorthySignal(state: EarlyEntryTradeState, score: number): boolean {
  if (state === "BLOCKED") return false;
  if (state === "EXTENDED_DO_NOT_CHASE") return true;
  if (state === "PILOT_BUY" || state === "ADD_ZONE" || state === "CONFIRMED_BUY") return true;
  return score >= 35;
}

export function computeValidationStatus(
  daysAvailable: number,
  outcomes: PaperSignalOutcomes | null
): PaperValidationStatus {
  if (daysAvailable >= PAPER_RESOLVE_HORIZONS.full && outcomes?.ret20d != null) {
    return "resolved";
  }
  if (
    daysAvailable >= PAPER_RESOLVE_HORIZONS.short &&
    (outcomes?.ret5d != null || outcomes?.ret10d != null)
  ) {
    return "partial";
  }
  return "open";
}

export function normalizePaperSignal(raw: PaperSignalRecord): PaperSignalRecord {
  const source = raw.source ?? "historical_seed";
  const dataSession = raw.dataSession ?? raw.sessionDate;
  const daysAvailable = raw.daysAvailable ?? 0;
  const validationStatus =
    raw.validationStatus ?? computeValidationStatus(daysAvailable, raw.outcomes);
  const isResolved = raw.isResolved ?? validationStatus === "resolved";
  return {
    ...raw,
    source,
    dataSession,
    daysAvailable,
    validationStatus,
    isResolved,
    resolvedAt: isResolved ? raw.resolvedAt ?? raw.outcomes?.updatedAt ?? null : null,
    outcomes: raw.outcomes,
  };
}

export function normalizePaperStore(store: {
  version?: number;
  lastUpdated?: string;
  signals: PaperSignalRecord[];
}): PaperSignalStore {
  return {
    version: 2,
    lastUpdated: store.lastUpdated ?? new Date().toISOString(),
    signals: store.signals.map((s) => normalizePaperSignal(s as PaperSignalRecord)),
  };
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
  source: PaperSignalSource;
  evaluation: EarlyEntryEvaluationResult;
  calibrationCtx: CalibrationContext;
  gate1RegimeLabel: string;
  gate2Quality: string;
  gate2TerminalCode: string | null;
  loggedAt?: string;
  daysAvailable?: number;
};

export function buildPaperSignal(params: BuildPaperSignalParams): PaperSignalRecord {
  const { evaluation: ev, calibrationCtx } = params;
  const calibration = buildPaperCalibrationMap(ev, calibrationCtx);
  const display = tradeStateDisplayLabel(ev.proposedTradeState);
  const sessionDate = params.sessionDate;

  return {
    id: paperSignalId(params.symbol, sessionDate),
    sessionDate,
    dataSession: sessionDate,
    symbol: params.symbol.toUpperCase(),
    source: params.source,
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
    daysAvailable: params.daysAvailable ?? 0,
    validationStatus: "open",
    isResolved: false,
    resolvedAt: null,
    outcomes: null,
  };
}

export type MergeSignalsResult = {
  store: PaperSignalStore;
  added: number;
  skipped: number;
};

/**
 * Idempotent merge — never duplicates symbol|sessionDate; preserves outcomes on existing rows.
 */
export function mergeSignalsIntoStore(
  store: PaperSignalStore,
  incoming: PaperSignalRecord[]
): MergeSignalsResult {
  const normalized = normalizePaperStore(store);
  const byId = new Map(normalized.signals.map((s) => [s.id, s]));
  let added = 0;
  let skipped = 0;

  for (const sig of incoming) {
    if (byId.has(sig.id)) {
      skipped++;
      continue;
    }
    byId.set(sig.id, sig);
    added++;
  }

  return {
    store: {
      version: 2,
      lastUpdated: new Date().toISOString(),
      signals: [...byId.values()].sort((a, b) =>
        a.sessionDate === b.sessionDate
          ? a.symbol.localeCompare(b.symbol)
          : a.sessionDate.localeCompare(b.sessionDate)
      ),
    },
    added,
    skipped,
  };
}

export function filterSignalsBySource(
  signals: readonly PaperSignalRecord[],
  source: PaperSignalSource | "combined"
): PaperSignalRecord[] {
  if (source === "combined") return [...signals];
  return signals.filter((s) => s.source === source);
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

export type LevelHitOrder = {
  invalidLevelHit: boolean;
  targetHit: boolean;
  invalidHitBeforeTarget: boolean | null;
  targetHitBeforeInvalid: boolean | null;
};

export function computeLevelHitOrder(
  bars: readonly Gate2BarInput[],
  sessionIdx: number,
  invalidLevel: number | null,
  targetPrice: number | null,
  maxDays = PAPER_RESOLVE_HORIZONS.full
): LevelHitOrder {
  let invalidDay: number | null = null;
  let targetDay: number | null = null;
  const end = Math.min(bars.length - 1, sessionIdx + maxDays);

  for (let i = sessionIdx + 1; i <= end; i++) {
    if (invalidLevel != null && invalidDay == null && bars[i]!.low < invalidLevel) {
      invalidDay = i - sessionIdx;
    }
    if (targetPrice != null && targetDay == null && bars[i]!.high >= targetPrice) {
      targetDay = i - sessionIdx;
    }
  }

  const invalidLevelHit = invalidDay != null;
  const targetHit = targetDay != null;
  let invalidHitBeforeTarget: boolean | null = null;
  let targetHitBeforeInvalid: boolean | null = null;

  if (invalidLevelHit && targetHit) {
    invalidHitBeforeTarget = invalidDay! < targetDay!;
    targetHitBeforeInvalid = targetDay! < invalidDay!;
  } else if (invalidLevelHit) {
    invalidHitBeforeTarget = true;
    targetHitBeforeInvalid = false;
  } else if (targetHit) {
    invalidHitBeforeTarget = false;
    targetHitBeforeInvalid = true;
  }

  return {
    invalidLevelHit,
    targetHit,
    invalidHitBeforeTarget,
    targetHitBeforeInvalid,
  };
}

export function detectGate2AbAfterSignal(
  bars: readonly Gate2BarInput[],
  sessionIdx: number,
  maxDays = PAPER_RESOLVE_HORIZONS.full
): { becameAb: boolean; session: string | null } {
  const end = Math.min(bars.length - 1, sessionIdx + maxDays);
  for (let i = sessionIdx + 1; i <= end; i++) {
    const ev = evaluateBreakoutPullbackCandidate(bars, bars[i]!.date);
    if (ev.quality === "A" || ev.quality === "B") {
      return {
        becameAb: true,
        session: bars[i]!.date.toISOString().slice(0, 10),
      };
    }
  }
  return { becameAb: false, session: null };
}

export type ResolvePaperSignalParams = {
  signal: PaperSignalRecord;
  bars: readonly Gate2BarInput[];
  sessionIdx: number;
  gate2BecameAb: boolean;
  gate2BecameAbSession: string | null;
};

export function resolvePaperSignalOutcomes(
  params: ResolvePaperSignalParams
): PaperSignalRecord {
  const { signal, bars, sessionIdx, gate2BecameAb, gate2BecameAbSession } = params;
  const daysAvailable = Math.max(0, bars.length - 1 - sessionIdx);
  const now = new Date().toISOString();

  const ret5d =
    daysAvailable >= PAPER_RESOLVE_HORIZONS.short
      ? forwardReturn(bars, sessionIdx, PAPER_RESOLVE_HORIZONS.short)
      : (signal.outcomes?.ret5d ?? null);
  const ret10d =
    daysAvailable >= PAPER_RESOLVE_HORIZONS.mid
      ? forwardReturn(bars, sessionIdx, PAPER_RESOLVE_HORIZONS.mid)
      : (signal.outcomes?.ret10d ?? null);
  const ret20d =
    daysAvailable >= PAPER_RESOLVE_HORIZONS.full
      ? forwardReturn(bars, sessionIdx, PAPER_RESOLVE_HORIZONS.full)
      : (signal.outcomes?.ret20d ?? null);

  const excursionDays = Math.min(daysAvailable, PAPER_RESOLVE_HORIZONS.mid);
  const { mae, mfe } =
    excursionDays > 0
      ? excursion(bars, sessionIdx, excursionDays)
      : { mae: signal.outcomes?.mae10d ?? null, mfe: signal.outcomes?.mfe10d ?? null };

  const stopDist = signal.stopDistancePct;
  const rMultiple =
    stopDist != null && stopDist > 0 && mfe != null ? mfe / stopDist : null;

  const levelHits =
    daysAvailable >= 1
      ? computeLevelHitOrder(
          bars,
          sessionIdx,
          signal.invalidLevel,
          signal.targetPrice,
          Math.min(daysAvailable, PAPER_RESOLVE_HORIZONS.full)
        )
      : {
          invalidLevelHit: signal.outcomes?.invalidLevelHit ?? false,
          targetHit: signal.outcomes?.targetHit ?? false,
          invalidHitBeforeTarget: signal.outcomes?.invalidHitBeforeTarget ?? null,
          targetHitBeforeInvalid: signal.outcomes?.targetHitBeforeInvalid ?? null,
        };

  const extendedAvoidedBad5d =
    signal.baselineState === "EXTENDED_DO_NOT_CHASE"
      ? ret5d != null
        ? ret5d < 0
        : null
      : null;

  const outcomes: PaperSignalOutcomes | null =
    daysAvailable >= PAPER_RESOLVE_HORIZONS.short || signal.outcomes
      ? {
          updatedAt: now,
          ret5d,
          ret10d,
          ret20d,
          mae10d: mae,
          mfe10d: mfe,
          rMultiple,
          invalidLevelHit: levelHits.invalidLevelHit,
          targetHit: levelHits.targetHit,
          invalidHitBeforeTarget: levelHits.invalidHitBeforeTarget,
          targetHitBeforeInvalid: levelHits.targetHitBeforeInvalid,
          gate2BecameAb,
          gate2BecameAbSession,
          extendedAvoidedBad5d,
        }
      : null;

  const validationStatus = computeValidationStatus(daysAvailable, outcomes);
  const isResolved = validationStatus === "resolved";

  return {
    ...signal,
    daysAvailable,
    outcomes,
    validationStatus,
    isResolved,
    resolvedAt: isResolved ? signal.resolvedAt ?? now : null,
  };
}

export type PaperAcceptanceResult = {
  ready: boolean;
  blockers: string[];
  checks: Record<string, boolean>;
};

export type PaperAcceptanceScope = "live_only" | "all";

export function evaluatePaperAcceptance(params: {
  variant: PaperCalibrationVariantId;
  resolvedPilots: PaperSignalRecord[];
  scope?: PaperAcceptanceScope;
}): PaperAcceptanceResult {
  const scope = params.scope ?? "live_only";
  const pilots = params.resolvedPilots.filter((s) => {
    if (!s.calibration[params.variant].pilotQualified) return false;
    if (!s.isResolved) return false;
    if (scope === "live_only" && s.source !== "live_paper") return false;
    return true;
  });

  const blockers: string[] = [];
  const checks: Record<string, boolean> = {};
  const scopeLabel = scope === "live_only" ? "live" : "all";

  checks.minSignals = pilots.length >= 20;
  if (!checks.minSignals) {
    blockers.push(`Need ≥20 ${scopeLabel} resolved pilots (have ${pilots.length})`);
  }

  if (pilots.length === 0) {
    checks.falsePilotRate = false;
    checks.avgRMultiplePositive = false;
    checks.medianReturnPositive = false;
    checks.maeAcceptable = true;
    checks.notOutlierDriven = false;
    checks.multiRegime = false;
    if (scope === "live_only") {
      blockers.push("No live resolved pilots yet");
    }
    return { ready: false, blockers: [...new Set(blockers)], checks };
  }

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
  const ret20 = pilots.map((p) => p.outcomes?.ret20d).filter((v): v is number => v != null);
  const sorted10 = [...ret10].sort((a, b) => a - b);
  const median10 =
    sorted10.length === 0
      ? null
      : sorted10.length % 2 === 0
        ? (sorted10[sorted10.length / 2 - 1]! + sorted10[sorted10.length / 2]!) / 2
        : sorted10[Math.floor(sorted10.length / 2)]!;
  const sorted20 = [...ret20].sort((a, b) => a - b);
  const median20 =
    sorted20.length === 0
      ? null
      : sorted20.length % 2 === 0
        ? (sorted20[sorted20.length / 2 - 1]! + sorted20[sorted20.length / 2]!) / 2
        : sorted20[Math.floor(sorted20.length / 2)]!;

  checks.medianReturnPositive =
    (median10 != null && median10 > 0) || (median20 != null && median20 > 0);
  if (!checks.medianReturnPositive) {
    blockers.push("Median 10d and 20d return not positive");
  }

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
  if (!checks.multiRegime) {
    blockers.push("Need signals across ≥2 market regimes (or require regime filter)");
  }

  const ready = Object.values(checks).every(Boolean);
  return { ready, blockers, checks };
}

export function emptyPaperStore(): PaperSignalStore {
  return { version: 2, lastUpdated: new Date().toISOString(), signals: [] };
}

export type PaperSafetySummary = {
  openSignals: number;
  openLiveSignals: number;
  resolvedLivePilots: Record<PaperCalibrationVariantId, number>;
  falseRateByVariant: Record<PaperCalibrationVariantId, number | null>;
  medianRet10dByVariant: Record<PaperCalibrationVariantId, number | null>;
  extendedAvoidanceRate5d: number | null;
  extendedTotal: number;
  acceptanceLive: Record<PaperCalibrationVariantId, PaperAcceptanceResult>;
  anyVariantReady: boolean;
};

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function buildPaperSafetySummary(store: PaperSignalStore): PaperSafetySummary {
  const signals = normalizePaperStore(store).signals;
  const live = filterSignalsBySource(signals, "live_paper");

  const resolvedLivePilots = {} as Record<PaperCalibrationVariantId, number>;
  const falseRateByVariant = {} as Record<PaperCalibrationVariantId, number | null>;
  const medianRet10dByVariant = {} as Record<PaperCalibrationVariantId, number | null>;
  const acceptanceLive = {} as Record<PaperCalibrationVariantId, PaperAcceptanceResult>;

  for (const variant of PAPER_CALIBRATION_VARIANTS) {
    const pilots = live.filter(
      (s) => s.calibration[variant].pilotQualified && s.isResolved
    );
    resolvedLivePilots[variant] = pilots.length;
    const ret10 = pilots.map((p) => p.outcomes?.ret10d).filter((v): v is number => v != null);
    const falseCount = pilots.filter((p) => (p.outcomes?.ret10d ?? 0) < 0).length;
    falseRateByVariant[variant] = pilots.length ? falseCount / pilots.length : null;
    medianRet10dByVariant[variant] = median(ret10);
    acceptanceLive[variant] = evaluatePaperAcceptance({
      variant,
      resolvedPilots: live,
      scope: "live_only",
    });
  }

  const extendedLive = live.filter((s) => s.baselineState === "EXTENDED_DO_NOT_CHASE");
  const extendedResolved = extendedLive.filter((s) => s.outcomes?.ret5d != null);
  const extendedAvoided = extendedResolved.filter((s) => s.outcomes?.extendedAvoidedBad5d);
  const extendedAvoidanceRate5d =
    extendedResolved.length > 0 ? extendedAvoided.length / extendedResolved.length : null;

  return {
    openSignals: signals.filter((s) => !s.isResolved).length,
    openLiveSignals: live.filter((s) => !s.isResolved).length,
    resolvedLivePilots,
    falseRateByVariant,
    medianRet10dByVariant,
    extendedAvoidanceRate5d,
    extendedTotal: extendedLive.length,
    acceptanceLive,
    anyVariantReady: PAPER_CALIBRATION_VARIANTS.some((v) => acceptanceLive[v].ready),
  };
}
