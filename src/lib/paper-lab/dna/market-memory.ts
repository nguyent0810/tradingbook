/**
 * Market Memory — deterministic, market-level per-style setup base rates.
 *
 * Pure functions. Answers "is this style working recently?" from historical
 * setups and their forward outcomes. Strict no-lookahead: a setup at session T
 * only contributes once its forward window (T+W) has closed, and a memory row
 * dated `asOf` includes only records with windowCloseDate <= asOf. The DNA
 * evaluator reads a row dated <= S-1, so future bars can never affect a past
 * decision. No LLM, no randomness.
 */
import { sma } from "@/lib/playbook/indicators";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { MarketMemoryDna } from "@/lib/paper-lab/dna/fund-manager-dna";

export type StyleTag =
  | "breakout" | "pullback" | "mean_reversion" | "trend" | "rs" | "early" | "allweather" | "defensive";

export const MEMORY_FORWARD_WINDOW = 5;
export const SUCCESS_THRESHOLD_PCT = 3;
export const FALSE_THRESHOLD_PCT = 3;

export type RegimeTag = "Bull" | "Bear" | "Sideways";

export interface SetupOutcomeRecord {
  sessionDate: string; // T (YYYY-MM-DD)
  windowCloseDate: string; // T + W
  styleTag: StyleTag;
  regimeTag: RegimeTag;
  forwardReturnPct: number;
  worked: boolean;
  failedFast: boolean;
}

export interface StyleRates {
  successRate20: number;
  successRate60: number;
  successRate120: number;
  falseBreakoutRate20: number;
  falseBreakoutRate60: number;
  avgForwardReturnPct: number;
  byRegime: Record<string, { successRate: number; n: number }>;
  sampleSize: number;
}

export interface MarketMemory {
  asOfSession: string;
  byStyle: Partial<Record<StyleTag, StyleRates>>;
  marketChurnScore: number;
  trendPersistence: number;
}

export const NEUTRAL_MEMORY: MarketMemory = { asOfSession: "", byStyle: {}, marketChurnScore: 0.5, trendPersistence: 0.5 };

function dateKey(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}
function num(x: number | undefined): number | null {
  return x != null && Number.isFinite(x) ? x : null;
}

/**
 * Derive per-style setup outcome records from a symbol's bar history.
 * Deterministic. Each record's outcome uses ONLY bars T..T+W; the record is
 * stamped with windowCloseDate = date(T+W) so callers can enforce no-lookahead.
 */
export function deriveSetupOutcomes(
  stockBars: readonly Gate2BarInput[],
  indexBars: readonly Gate2BarInput[],
  window = MEMORY_FORWARD_WINDOW
): SetupOutcomeRecord[] {
  const bars = [...stockBars].sort((a, b) => a.date.getTime() - b.date.getTime());
  const closes = bars.map((b) => b.close);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);

  const idx = [...indexBars].sort((a, b) => a.date.getTime() - b.date.getTime());
  const idxByKey = new Map(idx.map((b) => [dateKey(b.date), b] as const));
  const idxCloses = idx.map((b) => b.close);
  const idxMa50 = sma(idxCloses, 50);
  const idxMa50ByKey = new Map(idx.map((b, i) => [dateKey(b.date), idxMa50[i]] as const));

  const out: SetupOutcomeRecord[] = [];
  for (let t = 50; t + window < bars.length; t++) {
    const close = closes[t]!;
    const m20 = num(ma20[t]);
    const m50 = num(ma50[t]);
    if (m20 == null || m50 == null) continue;

    const fwd = ((closes[t + window]! / close) - 1) * 100;
    const worked = fwd > SUCCESS_THRESHOLD_PCT;
    const failedFast = fwd < -FALSE_THRESHOLD_PCT;

    // Market regime at T from the index (no lookahead — index bars up to T).
    const iBar = idxByKey.get(dateKey(bars[t]!.date));
    const iMa = idxMa50ByKey.get(dateKey(bars[t]!.date));
    let regimeTag: RegimeTag = "Sideways";
    if (iBar && iMa != null && Number.isFinite(iMa)) regimeTag = iBar.close > iMa * 1.01 ? "Bull" : iBar.close < iMa * 0.99 ? "Bear" : "Sideways";

    const priorHigh = Math.max(...bars.slice(t - 20, t).map((b) => b.high));
    const ma50Rising = num(ma50[t - 5]) != null && m50 > (ma50[t - 5] as number);
    const stockRet20 = ((close / closes[t - 20]!) - 1) * 100;
    const iPrev = idxByKey.get(dateKey(bars[t - 20]!.date));
    const idxRet20 = iBar && iPrev ? ((iBar.close / iPrev.close) - 1) * 100 : 0;

    const styles: StyleTag[] = [];
    if (close > priorHigh) { styles.push("breakout", "early", "allweather"); }
    if (close <= m20 * 1.02 && close >= m20 * 0.98 && close > m50) styles.push("pullback");
    if (close <= m20 * 0.95 && close > m50) styles.push("mean_reversion");
    if (close > m50 && ma50Rising) { styles.push("trend", "defensive"); }
    if (stockRet20 - idxRet20 > 3) styles.push("rs");

    const rec = { sessionDate: dateKey(bars[t]!.date), windowCloseDate: dateKey(bars[t + window]!.date), regimeTag, forwardReturnPct: fwd, worked, failedFast };
    for (const styleTag of styles) out.push({ ...rec, styleTag });
  }
  return out;
}

function rateOverRecentDates(records: SetupOutcomeRecord[], allDatesDesc: string[], n: number, pick: (r: SetupOutcomeRecord) => boolean): number {
  const cutoff = allDatesDesc[Math.min(n, allDatesDesc.length) - 1];
  if (cutoff === undefined) return 0;
  const win = records.filter((r) => r.sessionDate >= cutoff);
  return win.length === 0 ? 0 : win.filter(pick).length / win.length;
}

/**
 * Aggregate eligible records (windowCloseDate <= asOf) into a MarketMemory row.
 * `trendPersistence` is computed from index bars dated <= asOf.
 */
export function computeMarketMemory(
  records: readonly SetupOutcomeRecord[],
  asOfSession: string,
  indexBars: readonly Gate2BarInput[] = []
): MarketMemory {
  const eligible = records.filter((r) => r.windowCloseDate <= asOfSession);
  const byStyle: Partial<Record<StyleTag, StyleRates>> = {};

  const styles = [...new Set(eligible.map((r) => r.styleTag))];
  for (const style of styles) {
    const recs = eligible.filter((r) => r.styleTag === style);
    const datesDesc = [...new Set(recs.map((r) => r.sessionDate))].sort().reverse();
    const byRegime: Record<string, { successRate: number; n: number }> = {};
    for (const rt of ["Bull", "Bear", "Sideways"]) {
      const rr = recs.filter((r) => r.regimeTag === rt);
      if (rr.length) byRegime[rt] = { successRate: rr.filter((r) => r.worked).length / rr.length, n: rr.length };
    }
    byStyle[style] = {
      successRate20: rateOverRecentDates(recs, datesDesc, 20, (r) => r.worked),
      successRate60: rateOverRecentDates(recs, datesDesc, 60, (r) => r.worked),
      successRate120: rateOverRecentDates(recs, datesDesc, 120, (r) => r.worked),
      falseBreakoutRate20: rateOverRecentDates(recs, datesDesc, 20, (r) => r.failedFast),
      falseBreakoutRate60: rateOverRecentDates(recs, datesDesc, 60, (r) => r.failedFast),
      avgForwardReturnPct: recs.reduce((s, r) => s + r.forwardReturnPct, 0) / recs.length,
      byRegime,
      sampleSize: recs.length,
    };
  }

  const marketChurnScore = byStyle.breakout?.falseBreakoutRate60 ?? 0.5;

  // Trend persistence: fraction of the last 60 index sessions (<= asOf) above MA50.
  const idx = [...indexBars].sort((a, b) => a.date.getTime() - b.date.getTime()).filter((b) => dateKey(b.date) <= asOfSession);
  const idxMa50 = sma(idx.map((b) => b.close), 50);
  let above = 0, counted = 0;
  for (let i = Math.max(0, idx.length - 60); i < idx.length; i++) {
    const m = idxMa50[i];
    if (m != null && Number.isFinite(m)) { counted += 1; if (idx[i]!.close > m) above += 1; }
  }
  const trendPersistence = counted > 0 ? above / counted : 0.5;

  return { asOfSession, byStyle, marketChurnScore, trendPersistence };
}

export interface MemoryModulation {
  riskMult: number;
  confidenceAdj: number;
  confirmationDelta: number;
  active: boolean;
}
export const NEUTRAL_MODULATION: MemoryModulation = { riskMult: 1, confidenceAdj: 0, confirmationDelta: 0, active: false };

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Deterministic modulation of a manager's risk / confidence / confirmation
 * strictness from market memory, gated by the manager's DNA sensitivity. Neutral
 * when the style's sample size is below the manager's minSampleSize.
 */
export function computeMemoryModulation(memory: MarketMemory, dna: MarketMemoryDna): MemoryModulation {
  const rates = memory.byStyle[dna.styleTag as StyleTag];
  if (!rates || rates.sampleSize < dna.minSampleSize) return NEUTRAL_MODULATION;

  const s = dna.sensitivity;
  const falseRate = rates.falseBreakoutRate20 || memory.marketChurnScore;
  const successTerm = s.toOwnStyleSuccess * (rates.successRate60 - 0.5);
  const falseTerm = s.toFalseBreakoutRate * Math.max(0, falseRate - 0.3);
  const persistTerm = s.toTrendPersistence * (memory.trendPersistence - 0.5);

  const riskMult = clamp(1 + successTerm - falseTerm + persistTerm, 0.5, 1.3);
  const confidenceAdj = clamp(0.1 * (successTerm - falseTerm + persistTerm), -0.1, 0.1);
  const confirmationDelta = falseRate > 0.5 && s.toFalseBreakoutRate >= 0.5 ? 1 : 0;

  return { riskMult, confidenceAdj, confirmationDelta, active: true };
}
