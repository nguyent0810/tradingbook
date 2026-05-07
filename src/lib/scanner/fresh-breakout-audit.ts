import type { TradabilityResult } from "./tradability-types";
import { sortAndDedupeBarsByDate } from "./tradability";
import type { TradabilityBarInput } from "./tradability-types";

export const FRESH_BREAKOUT_AUDIT_DISCLAIMER =
  "Fresh breakout audit is observational only and does not represent validated core setups.";

export type FreshBreakoutLabel =
  | "FRESH_BREAKOUT"
  | "MOMENTUM_IGNITION"
  | "RECLAIM_THRUST"
  | "EXTENDED_NO_PULLBACK"
  | "FAILED_BREAKOUT_RISK";

export type FreshBreakoutRiskAnnotation =
  | "EXTENDED"
  | "STOP_FAR"
  | "LOW_LIQUIDITY"
  | "BELOW_MA50"
  | "NO_PULLBACK"
  | "STALE_DATA";

export type FreshBreakoutMetrics = {
  close: number;
  volume: number;
  latestBarDate: Date;
  staleSession: boolean;
  ma20: number | null;
  ma50: number | null;
  aboveMa20: boolean;
  aboveMa50: boolean;
  priorNDayHigh: number | null;
  closeAbovePriorNDayHigh: boolean;
  volumeAvg20: number | null;
  volumeRatio20: number | null;
  breakoutExtensionPct: number | null;
  distanceFromMa20Pct: number | null;
  distanceFromMa50Pct: number | null;
};

export type FreshBreakoutClassification = {
  labels: FreshBreakoutLabel[];
  riskAnnotations: FreshBreakoutRiskAnnotation[];
  notes: string[];
};

export type FreshBreakoutAuditGroup =
  | "ACTIONABLE_WATCH"
  | "EXTENDED_WATCH_ONLY"
  | "AVOID_RISK"
  | "COVERAGE_TRADABILITY_BLOCKED";

export type FreshBreakoutRowLike = {
  symbol: string;
  tradabilityPassed: boolean;
  staleSession: boolean;
  labels: string[];
  riskAnnotations: string[];
  volumeRatio20: number | null;
  breakoutExtensionPct: number | null;
};

const LABEL_PRIORITY: Record<FreshBreakoutLabel, number> = {
  FRESH_BREAKOUT: 0,
  MOMENTUM_IGNITION: 1,
  RECLAIM_THRUST: 2,
  EXTENDED_NO_PULLBACK: 3,
  FAILED_BREAKOUT_RISK: 4,
};

function mean(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function smaAtEnd(values: readonly number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  const avg = mean(slice);
  return avg != null ? Number(avg) : null;
}

function pctDelta(base: number | null, current: number): number | null {
  if (base == null || !Number.isFinite(base) || base <= 0) return null;
  return ((current - base) / base) * 100;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hadRecentCloseBelowLevel(
  closes: readonly number[],
  levelSeries: readonly (number | null)[],
  lookback: number
): boolean {
  const start = Math.max(0, closes.length - lookback);
  for (let i = start; i < closes.length; i++) {
    const lv = levelSeries[i];
    if (lv != null && closes[i] != null && closes[i]! < lv) return true;
  }
  return false;
}

export function computeFreshBreakoutMetrics(params: {
  bars: ReadonlyArray<TradabilityBarInput>;
  expectedLatestSession: Date;
  breakoutLookbackDays?: number;
}): FreshBreakoutMetrics | null {
  const breakoutLookbackDays = params.breakoutLookbackDays ?? 20;
  const bars = sortAndDedupeBarsByDate(params.bars);
  if (bars.length === 0) return null;

  const last = bars[bars.length - 1]!;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const ma20 = smaAtEnd(closes, 20);
  const ma50 = smaAtEnd(closes, 50);

  const prevSlice = bars.slice(Math.max(0, bars.length - 1 - breakoutLookbackDays), bars.length - 1);
  const priorNDayHigh =
    prevSlice.length > 0
      ? prevSlice.reduce((m, b) => (b.close > m ? b.close : m), prevSlice[0]!.close)
      : null;

  const volBaseSlice = volumes.slice(Math.max(0, volumes.length - 21), volumes.length - 1);
  const volumeAvg20 = volBaseSlice.length > 0 ? mean(volBaseSlice) : null;
  const volumeRatio20 =
    volumeAvg20 != null && volumeAvg20 > 0
      ? last.volume / volumeAvg20
      : null;

  const expectedDay = isoDay(params.expectedLatestSession);
  const latestDay = isoDay(last.date);
  const staleSession = latestDay !== expectedDay;

  const closeAbovePriorNDayHigh =
    priorNDayHigh != null ? last.close > priorNDayHigh : false;

  return {
    close: last.close,
    volume: last.volume,
    latestBarDate: last.date,
    staleSession,
    ma20,
    ma50,
    aboveMa20: ma20 != null ? last.close >= ma20 : false,
    aboveMa50: ma50 != null ? last.close >= ma50 : false,
    priorNDayHigh,
    closeAbovePriorNDayHigh,
    volumeAvg20,
    volumeRatio20,
    breakoutExtensionPct: closeAbovePriorNDayHigh ? pctDelta(priorNDayHigh, last.close) : null,
    distanceFromMa20Pct: pctDelta(ma20, last.close),
    distanceFromMa50Pct: pctDelta(ma50, last.close),
  };
}

export function classifyFreshBreakout(params: {
  metrics: FreshBreakoutMetrics;
  tradability: TradabilityResult;
  recentBars: ReadonlyArray<TradabilityBarInput>;
}): FreshBreakoutClassification {
  const { metrics, tradability, recentBars } = params;
  const labels = new Set<FreshBreakoutLabel>();
  const risks = new Set<FreshBreakoutRiskAnnotation>();
  const notes: string[] = [];

  if (metrics.closeAbovePriorNDayHigh) {
    labels.add("FRESH_BREAKOUT");
    notes.push("Latest close is above prior lookback range high.");
  }

  if (
    metrics.closeAbovePriorNDayHigh &&
    (metrics.volumeRatio20 ?? 0) >= 1.5 &&
    metrics.aboveMa20 &&
    metrics.aboveMa50
  ) {
    labels.add("MOMENTUM_IGNITION");
    notes.push("Breakout with strong participation and supportive MA structure.");
  }

  const closes = recentBars.map((b) => b.close);
  const ma50Series = recentBars.map((_, i) =>
    i + 1 >= 50 ? mean(closes.slice(i + 1 - 50, i + 1)) : null
  );
  const reclaimContext = hadRecentCloseBelowLevel(closes, ma50Series, 10);
  if (
    !metrics.closeAbovePriorNDayHigh &&
    metrics.aboveMa20 &&
    metrics.aboveMa50 &&
    reclaimContext &&
    (metrics.volumeRatio20 ?? 0) >= 1.2
  ) {
    labels.add("RECLAIM_THRUST");
    notes.push("Recent thrust reclaimed trend support after prior weakness.");
  }

  const ext = metrics.breakoutExtensionPct ?? 0;
  if ((metrics.closeAbovePriorNDayHigh && ext >= 5) || (metrics.distanceFromMa20Pct ?? 0) >= 8) {
    labels.add("EXTENDED_NO_PULLBACK");
    notes.push("Price is extended versus breakout/MA20 without a clean pullback.");
  }

  if (!metrics.aboveMa50) {
    risks.add("BELOW_MA50");
  }
  if (metrics.staleSession) {
    risks.add("STALE_DATA");
  }
  if (!tradability.passed) {
    risks.add("LOW_LIQUIDITY");
  }
  if ((metrics.breakoutExtensionPct ?? 0) >= 5 || (metrics.distanceFromMa20Pct ?? 0) >= 8) {
    risks.add("EXTENDED");
  }
  if ((metrics.distanceFromMa20Pct ?? 0) >= 6 || (metrics.distanceFromMa50Pct ?? 0) >= 12) {
    risks.add("STOP_FAR");
  }
  if (metrics.closeAbovePriorNDayHigh && (metrics.breakoutExtensionPct ?? 0) >= 3) {
    risks.add("NO_PULLBACK");
  }

  if (recentBars.length >= 2) {
    const current = recentBars[recentBars.length - 1]!;
    const prev = recentBars[recentBars.length - 2]!;
    if (
      prev.close > current.close &&
      metrics.priorNDayHigh != null &&
      current.close < metrics.priorNDayHigh
    ) {
      labels.add("FAILED_BREAKOUT_RISK");
      notes.push("Recent pullback lost hold above breakout reference.");
    }
  }

  return {
    labels: [...labels],
    riskAnnotations: [...risks],
    notes,
  };
}

export function primaryLabelPriority(labels: readonly string[]): number {
  let best = 9;
  for (const label of labels) {
    const pr = LABEL_PRIORITY[label as FreshBreakoutLabel];
    if (pr != null && pr < best) best = pr;
  }
  return best;
}

function extensionPenalty(extPct: number | null): number {
  if (extPct == null) return 1;
  if (extPct >= 0 && extPct <= 6) return 0;
  if (extPct > 6 && extPct <= 10) return 1;
  return 2;
}

export function determineFreshBreakoutGroup(
  row: Pick<FreshBreakoutRowLike, "tradabilityPassed" | "staleSession" | "labels">
): FreshBreakoutAuditGroup {
  if (!row.tradabilityPassed || row.staleSession) {
    return "COVERAGE_TRADABILITY_BLOCKED";
  }
  if (row.labels.includes("FRESH_BREAKOUT") || row.labels.includes("MOMENTUM_IGNITION") || row.labels.includes("RECLAIM_THRUST")) {
    return "ACTIONABLE_WATCH";
  }
  if (row.labels.includes("EXTENDED_NO_PULLBACK")) {
    return "EXTENDED_WATCH_ONLY";
  }
  return "AVOID_RISK";
}

export function shouldIncludeFreshBreakoutRow(
  row: Pick<FreshBreakoutRowLike, "labels" | "tradabilityPassed" | "staleSession">,
  opts?: { includeFailedRisk?: boolean; tradableOnly?: boolean }
): boolean {
  const includeFailedRisk = opts?.includeFailedRisk ?? false;
  const tradableOnly = opts?.tradableOnly ?? false;
  if (tradableOnly && !row.tradabilityPassed) return false;
  if (row.staleSession && !includeFailedRisk) return false;
  if (row.labels.length === 0) return false;
  if (!includeFailedRisk && row.labels.every((l) => l === "FAILED_BREAKOUT_RISK")) {
    return false;
  }
  return true;
}

function groupOrder(group: FreshBreakoutAuditGroup): number {
  switch (group) {
    case "ACTIONABLE_WATCH":
      return 0;
    case "EXTENDED_WATCH_ONLY":
      return 1;
    case "AVOID_RISK":
      return 2;
    case "COVERAGE_TRADABILITY_BLOCKED":
      return 3;
  }
}

export function compareFreshBreakoutRows(a: FreshBreakoutRowLike, b: FreshBreakoutRowLike): number {
  const ga = groupOrder(determineFreshBreakoutGroup(a));
  const gb = groupOrder(determineFreshBreakoutGroup(b));
  if (ga !== gb) return ga - gb;

  if (a.tradabilityPassed !== b.tradabilityPassed) return a.tradabilityPassed ? -1 : 1;

  const la = primaryLabelPriority(a.labels);
  const lb = primaryLabelPriority(b.labels);
  if (la !== lb) return la - lb;

  if (a.riskAnnotations.length !== b.riskAnnotations.length) {
    return a.riskAnnotations.length - b.riskAnnotations.length;
  }

  const va = a.volumeRatio20 ?? -1;
  const vb = b.volumeRatio20 ?? -1;
  if (va !== vb) return vb - va;

  const ea = extensionPenalty(a.breakoutExtensionPct);
  const eb = extensionPenalty(b.breakoutExtensionPct);
  if (ea !== eb) return ea - eb;

  return a.symbol.localeCompare(b.symbol);
}
