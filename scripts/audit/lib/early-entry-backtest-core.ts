import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import { evaluateMarketRegime } from "@/lib/playbook/gate1-market";
import type { Bar } from "@/lib/market/types";
import {
  applyCalibrationVariant,
  CALIBRATION_VARIANTS,
  type CalibrationContext,
  type CalibrationVariantId,
  type Gate1RegimeLevel,
} from "@/lib/scanner/early-entry/calibration";
import {
  evaluateEarlyEntrySession,
  tradeStateDisplayLabel,
  type EarlyEntryEvaluationResult,
  type EarlyEntryTradeState,
} from "@/lib/scanner/early-entry";

export type BacktestObservation = {
  symbol: string;
  sessionDate: string;
  sector: string;
  gate2Quality: string;
  baselineState: EarlyEntryTradeState;
  entryType: string | null;
  earlyScore: number;
  rr: number | null;
  stopDistancePct: number | null;
  distFromMa20Pct: number | null;
  volumeRatio: number | null;
  rsImproving: boolean;
  gate1Level: Gate1RegimeLevel | null;
  gate1Trend: string | null;
  indexRegimeLabel: string;
  liquidityBucket: string;
  reasonCodes: string[];
  ret5d: number | null;
  ret10d: number | null;
  ret20d: number | null;
  mae10d: number | null;
  mfe10d: number | null;
  rMultiple: number | null;
};

export type FailureHypothesis =
  | "market_regime_weak"
  | "rr_target_too_optimistic"
  | "stop_too_loose"
  | "volume_spike_failed"
  | "reclaim_too_extended"
  | "no_follow_through"
  | "liquidity_issue"
  | "resistance_too_near"
  | "sector_not_confirming"
  | "unknown";

export type FalsePilotRecord = {
  symbol: string;
  sessionDate: string;
  score: number;
  rr: number | null;
  reasonCodes: string[];
  gate1Level: Gate1RegimeLevel | null;
  sector: string;
  ret10d: number | null;
  mae10d: number | null;
  mfe10d: number | null;
  hypotheses: FailureHypothesis[];
};

export type BucketStats = {
  bucket: string;
  count: number;
  avgRet5d: number | null;
  avgRet10d: number | null;
  avgRet20d: number | null;
  medianRet5d: number | null;
  medianRet10d: number | null;
  medianRet20d: number | null;
  winRate10d: number | null;
  falsePilotRate: number | null;
  avgMae10d: number | null;
  avgMfe10d: number | null;
  avgRMultiple: number | null;
  bestExamples: Array<{ symbol: string; sessionDate: string; ret10d: number | null }>;
  worstExamples: Array<{ symbol: string; sessionDate: string; ret10d: number | null }>;
};

export type VariantSummary = {
  variant: CalibrationVariantId;
  pilotCount: number;
  falsePilotCount: number;
  falsePilotRate: number | null;
  avgRet5d: number | null;
  avgRet10d: number | null;
  avgRet20d: number | null;
  avgMae10d: number | null;
  avgMfe10d: number | null;
  extendedBlocked: number;
  extendedNegative5d: number;
};

export function toGate2Bar(row: {
  time?: number;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Gate2BarInput {
  const date =
    row.date != null
      ? new Date(`${row.date}T00:00:00.000Z`)
      : new Date(row.time!);
  return {
    date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
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

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function avg(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function gate1AtSession(
  indexBars: readonly Gate2BarInput[],
  session: Date
): { level: Gate1RegimeLevel | null; trend: string | null; label: string } {
  const idx = indexBars.findIndex((b) => b.date.getTime() === session.getTime());
  if (idx < 0) return { level: null, trend: null, label: "unknown" };
  const slice: Bar[] = indexBars.slice(0, idx + 1).map((b) => ({
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  const regime = evaluateMarketRegime(slice);
  let label = regime.level.toLowerCase();
  if (regime.trend === "bullish" && regime.momentum === "up") label = "uptrend";
  else if (regime.trend === "bearish" && regime.momentum === "down") label = "correction";
  else if (regime.level === "WARNING") label = "sideways";
  return { level: regime.level, trend: regime.trend ?? null, label };
}

function liquidityBucket(avgVolume: number): string {
  if (avgVolume >= 5_000_000) return "high";
  if (avgVolume >= 1_000_000) return "medium";
  return "low";
}

function scoreBucket(score: number): string {
  if (score >= 70) return "70+";
  if (score >= 55) return "55-69";
  if (score >= 35) return "35-54";
  return "<35";
}

function rrBucket(rr: number | null): string {
  if (rr == null) return "unknown";
  if (rr >= 2.5) return "2.5+";
  if (rr >= 2) return "2.0-2.49";
  if (rr >= 1.5) return "1.5-1.99";
  return "<1.5";
}

function stopBucket(pct: number | null): string {
  if (pct == null) return "unknown";
  if (pct <= 4) return "<=4%";
  if (pct <= 7) return "4-7%";
  return ">7%";
}

function extensionBucket(pct: number | null): string {
  if (pct == null) return "unknown";
  if (pct <= 2) return "<=2%";
  if (pct <= 4) return "2-4%";
  if (pct <= 6) return "4-6%";
  return ">6%";
}

export function diagnoseFalsePilot(row: BacktestObservation): FailureHypothesis[] {
  const out: FailureHypothesis[] = [];
  if (row.gate1Level === "FAIL" || row.gate1Level === "WARNING") {
    out.push("market_regime_weak");
  }
  if ((row.rr ?? 0) >= 2 && (row.ret10d ?? 0) < 0) {
    out.push("rr_target_too_optimistic");
  }
  if ((row.stopDistancePct ?? 0) > 7) {
    out.push("stop_too_loose");
  }
  if (row.volumeRatio != null && row.volumeRatio >= 1.3 && (row.ret10d ?? 0) < 0) {
    out.push("volume_spike_failed");
  }
  if ((row.distFromMa20Pct ?? 0) > 4) {
    out.push("reclaim_too_extended");
  }
  if ((row.mfe10d ?? 0) > 2 && (row.ret10d ?? 0) < 0) {
    out.push("no_follow_through");
  }
  if (row.liquidityBucket === "low") {
    out.push("liquidity_issue");
  }
  if ((row.rr ?? 0) < 2.2 && (row.rr ?? 0) >= 2) {
    out.push("resistance_too_near");
  }
  if (out.length === 0) out.push("unknown");
  return out;
}

export function buildBucketStats(
  rows: BacktestObservation[],
  keyFn: (r: BacktestObservation) => string
): BucketStats[] {
  const groups = new Map<string, BacktestObservation[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([bucket, items]) => {
      const pilots = items.filter((i) => i.baselineState === "PILOT_BUY");
      const ret10 = items.map((i) => i.ret10d).filter((v): v is number => v != null);
      const falsePilots = pilots.filter((p) => (p.ret10d ?? 0) < 0);
      const sorted = [...items].sort((a, b) => (b.ret10d ?? -999) - (a.ret10d ?? -999));
      return {
        bucket,
        count: items.length,
        avgRet5d: avg(items.map((i) => i.ret5d!).filter(Number.isFinite)),
        avgRet10d: avg(ret10),
        avgRet20d: avg(items.map((i) => i.ret20d!).filter(Number.isFinite)),
        medianRet5d: median(items.map((i) => i.ret5d!).filter(Number.isFinite)),
        medianRet10d: median(ret10),
        medianRet20d: median(items.map((i) => i.ret20d!).filter(Number.isFinite)),
        winRate10d: ret10.length ? ret10.filter((r) => r > 0).length / ret10.length : null,
        falsePilotRate: pilots.length ? falsePilots.length / pilots.length : null,
        avgMae10d: avg(items.map((i) => i.mae10d!).filter(Number.isFinite)),
        avgMfe10d: avg(items.map((i) => i.mfe10d!).filter(Number.isFinite)),
        avgRMultiple: avg(items.map((i) => i.rMultiple!).filter(Number.isFinite)),
        bestExamples: sorted.slice(0, 10).map((s) => ({
          symbol: s.symbol,
          sessionDate: s.sessionDate,
          ret10d: s.ret10d,
        })),
        worstExamples: sorted.slice(-10).reverse().map((s) => ({
          symbol: s.symbol,
          sessionDate: s.sessionDate,
          ret10d: s.ret10d,
        })),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function summarizeVariant(
  variant: CalibrationVariantId,
  rows: BacktestObservation[],
  evaluations: Map<string, EarlyEntryEvaluationResult>,
  contexts: Map<string, CalibrationContext>
): VariantSummary {
  const pilots: BacktestObservation[] = [];
  let extended = 0;
  let extendedNeg5d = 0;

  for (const row of rows) {
    const key = `${row.symbol}|${row.sessionDate}`;
    const ev = evaluations.get(key);
    const ctx = contexts.get(key);
    if (!ev || !ctx) continue;
    const calibrated = applyCalibrationVariant(ev, variant, ctx);
    if (calibrated.state === "PILOT_BUY") {
      pilots.push({ ...row, baselineState: "PILOT_BUY" });
    }
    if (row.baselineState === "EXTENDED_DO_NOT_CHASE") {
      extended++;
      if ((row.ret5d ?? 0) < 0) extendedNeg5d++;
    }
  }

  const falsePilots = pilots.filter((p) => (p.ret10d ?? 0) < 0);
  return {
    variant,
    pilotCount: pilots.length,
    falsePilotCount: falsePilots.length,
    falsePilotRate: pilots.length ? falsePilots.length / pilots.length : null,
    avgRet5d: avg(pilots.map((p) => p.ret5d!).filter(Number.isFinite)),
    avgRet10d: avg(pilots.map((p) => p.ret10d!).filter(Number.isFinite)),
    avgRet20d: avg(pilots.map((p) => p.ret20d!).filter(Number.isFinite)),
    avgMae10d: avg(pilots.map((p) => p.mae10d!).filter(Number.isFinite)),
    avgMfe10d: avg(pilots.map((p) => p.mfe10d!).filter(Number.isFinite)),
    extendedBlocked: extended,
    extendedNegative5d: extendedNeg5d,
  };
}

export type RunBacktestParams = {
  symbols: Map<string, Gate2BarInput[]>;
  symbolList: string[];
  indexBars: Gate2BarInput[];
  sectorFor: (symbol: string) => string;
  step?: number;
};

export type BacktestRunResult = {
  observations: BacktestObservation[];
  evaluations: Map<string, EarlyEntryEvaluationResult>;
  contexts: Map<string, CalibrationContext>;
  variantSummaries: VariantSummary[];
  buckets: {
    byState: BucketStats[];
    byEntryType: BucketStats[];
    byScore: BucketStats[];
    byRr: BucketStats[];
    byStop: BucketStats[];
    byExtension: BucketStats[];
    byVolume: BucketStats[];
    byRsImproving: BucketStats[];
    byGate1: BucketStats[];
    bySector: BucketStats[];
    byLiquidity: BucketStats[];
    byIndexRegime: BucketStats[];
  };
  falsePilots: FalsePilotRecord[];
};

export function runEarlyEntryBacktest(params: RunBacktestParams): BacktestRunResult {
  const step = params.step ?? 5;
  const observations: BacktestObservation[] = [];
  const evaluations = new Map<string, EarlyEntryEvaluationResult>();
  const contexts = new Map<string, CalibrationContext>();

  for (const symbol of params.symbolList) {
    const bars = params.symbols.get(symbol);
    if (!bars) continue;

    const avgVol =
      bars.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, bars.length);
    const liq = liquidityBucket(avgVol);

    for (let idx = 55; idx < bars.length - 21; idx += step) {
      const session = bars[idx]!.date;
      const gate2 = evaluateBreakoutPullbackCandidate(bars, session);
      const early = evaluateEarlyEntrySession({
        stockBars: bars,
        indexBars: params.indexBars,
        sessionDate: session,
        skipLookback: true,
      });
      if (!early) continue;

      const g1 = gate1AtSession(params.indexBars, session);
      const { mae, mfe } = excursion(bars, idx, 10);
      const stopDist = early.metrics.stopDistancePct;
      const rMultiple =
        stopDist != null && stopDist > 0 && mfe != null ? mfe / stopDist : null;

      const key = `${symbol}|${session.toISOString().slice(0, 10)}`;
      evaluations.set(key, early);
      contexts.set(key, {
        gate1Level: g1.level,
        gate1Trend: g1.trend,
        sector: params.sectorFor(symbol),
        nextBar: bars[idx + 1] ?? null,
        nextNextBar: bars[idx + 2] ?? null,
        indexRs20Positive: null,
      });

      observations.push({
        symbol,
        sessionDate: session.toISOString().slice(0, 10),
        sector: params.sectorFor(symbol),
        gate2Quality: gate2.quality,
        baselineState: early.proposedTradeState,
        entryType: early.entryType,
        earlyScore: early.earlyReversalScore,
        rr: early.estimatedRiskReward,
        stopDistancePct: early.metrics.stopDistancePct,
        distFromMa20Pct: early.metrics.distFromMa20Pct,
        volumeRatio: early.metrics.volumeRatio,
        rsImproving: early.reasonCodes.includes("RS_IMPROVING"),
        gate1Level: g1.level,
        gate1Trend: g1.trend,
        indexRegimeLabel: g1.label,
        liquidityBucket: liq,
        reasonCodes: [...early.reasonCodes],
        ret5d: forwardReturn(bars, idx, 5),
        ret10d: forwardReturn(bars, idx, 10),
        ret20d: forwardReturn(bars, idx, 20),
        mae10d: mae,
        mfe10d: mfe,
        rMultiple,
      });
    }
  }

  const falsePilots = observations
    .filter((o) => o.baselineState === "PILOT_BUY" && (o.ret10d ?? 0) < 0)
    .map((o) => ({
      symbol: o.symbol,
      sessionDate: o.sessionDate,
      score: o.earlyScore,
      rr: o.rr,
      reasonCodes: o.reasonCodes,
      gate1Level: o.gate1Level,
      sector: o.sector,
      ret10d: o.ret10d,
      mae10d: o.mae10d,
      mfe10d: o.mfe10d,
      hypotheses: diagnoseFalsePilot(o),
    }));

  const variantSummaries = CALIBRATION_VARIANTS.map((v) =>
    summarizeVariant(v, observations, evaluations, contexts)
  );

  return {
    observations,
    evaluations,
    contexts,
    variantSummaries,
    buckets: {
      byState: buildBucketStats(observations, (r) => tradeStateDisplayLabel(r.baselineState)),
      byEntryType: buildBucketStats(observations, (r) => r.entryType ?? "none"),
      byScore: buildBucketStats(observations, (r) => scoreBucket(r.earlyScore)),
      byRr: buildBucketStats(observations, (r) => rrBucket(r.rr)),
      byStop: buildBucketStats(observations, (r) => stopBucket(r.stopDistancePct)),
      byExtension: buildBucketStats(observations, (r) => extensionBucket(r.distFromMa20Pct)),
      byVolume: buildBucketStats(observations, (r) =>
        r.volumeRatio != null && r.volumeRatio >= 1.3 ? "expansion" : "normal"
      ),
      byRsImproving: buildBucketStats(observations, (r) =>
        r.rsImproving ? "rs_improving" : "rs_flat"
      ),
      byGate1: buildBucketStats(observations, (r) => r.gate1Level ?? "unknown"),
      bySector: buildBucketStats(observations, (r) => r.sector),
      byLiquidity: buildBucketStats(observations, (r) => r.liquidityBucket),
      byIndexRegime: buildBucketStats(observations, (r) => r.indexRegimeLabel),
    },
    falsePilots,
  };
}

export { CALIBRATION_VARIANTS };
