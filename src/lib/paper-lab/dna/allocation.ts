/**
 * Shadow Capital Allocation (v1) — deterministic, read-only.
 *
 * Answers "if capital were reviewed today, who should get more / less?" from
 * SKILL metrics (time-weighted return + risk-adjusted + attribution), never from
 * absolute NAV. Produces a proposal with a guaranteed floor and a cap that sums
 * to exactly 100%. This module MOVES NO CAPITAL — it only computes a scorecard.
 * Pure, versioned, no LLM, no randomness.
 */
import { REASON_CODES } from "@/lib/paper-lab/contracts/reason-codes";

// v1.1: added a return-hurdle "participation factor" — a near-flat / negative
// manager (cash-parker) can no longer outrank genuine performers on smoothness
// alone. Uses cumulative TWR (a return metric), NOT absolute NAV/P&L.
export const ALLOCATION_SCORING_VERSION = "alloc-scoring@1.1.0";
export const DEFAULT_TRAILING_WINDOW = 63;
export const MIN_TRACK_RECORD_SESSIONS = 20;
export const ALLOC_FLOOR_PCT = 0.05;
export const ALLOC_CAP_PCT = 0.25;
export const NO_CHANGE_TOLERANCE = 0.005; // 0.5 percentage points
/** Window-cumulative TWR at/above which a manager earns full participation. */
export const RETURN_HURDLE = 0.03;
const TRADING_DAYS = 252;

/** Category weights (sum to 1). TWR is deliberately modest to avoid raw-return dominance. */
export const ALLOCATION_WEIGHTS = {
  twr: 0.2,
  calmar: 0.25,
  sharpe: 0.15,
  consistency: 0.15,
  riskDiscipline: 0.15,
  attributionQuality: 0.1,
} as const;

const R = REASON_CODES;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

// ---------------------------------------------------------------- TWR ----------

export interface NavFlowPoint {
  navVnd: number;
  /** External capital flow applied at the START of this period (0 in v1). */
  flowVnd: number;
}
export interface TwrSeries {
  dailyTwrFactor: number[];
  cumulativeTwr: number;
  dailyReturns: number[];
}

/** Flow-neutral time-weighted return. factor[t] = nav[t] / (nav[t-1] + flow[t]). */
export function computeTwrSeries(points: NavFlowPoint[]): TwrSeries {
  const dailyTwrFactor: number[] = [];
  const dailyReturns: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]!.navVnd + points[i]!.flowVnd;
    const factor = start > 0 ? points[i]!.navVnd / start : 1;
    dailyTwrFactor.push(factor);
    dailyReturns.push(factor - 1);
  }
  const cumulativeTwr = dailyTwrFactor.reduce((p, f) => p * f, 1) - 1;
  return { dailyTwrFactor, cumulativeTwr, dailyReturns };
}

// ------------------------------------------------------------ Scorecard --------

export interface AttributionSummary {
  avgEntryQuality: number;
  avgHoldingQuality: number;
  avgExitQuality: number;
  avgSizingQuality: number;
  avgRegimeFit: number;
  avgRiskControl: number;
  cashDragVnd: number;
  navVnd: number;
}
export interface ScorecardInput {
  slug: string;
  navSeries: number[]; // oldest → newest, within trailing window
  flowSeries?: number[];
  attribution?: AttributionSummary | null;
  windowSessions?: number;
  minTrackRecord?: number;
}
export interface Scorecard {
  slug: string;
  sessions: number;
  eligible: boolean;
  cumulativeTwr: number;
  annualizedTwr: number;
  maxDrawdownPct: number; // 0..1
  calmar: number;
  sharpe: number;
  consistency: number;
  riskDiscipline: number;
  attributionQuality: number;
  dataQualityConfidence: number;
  // Informational only (capital effect) — NOT used in scoring:
  latestNavVnd: number;
}

function maxDrawdown(nav: number[]): number {
  let peak = nav[0] ?? 0;
  let maxDd = 0;
  for (const v of nav) {
    if (v > peak) peak = v;
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}
function consistencyScore(factors: number[]): number {
  if (factors.length === 0) return 0.5;
  const K = 21;
  if (factors.length < K) return factors.filter((f) => f > 1).length / factors.length;
  let pos = 0;
  let windows = 0;
  for (let i = 0; i + K <= factors.length; i++) {
    windows += 1;
    const prod = factors.slice(i, i + K).reduce((p, f) => p * f, 1);
    if (prod > 1) pos += 1;
  }
  return windows ? pos / windows : 0.5;
}

export function computeManagerScorecard(input: ScorecardInput): Scorecard {
  const window = input.windowSessions ?? DEFAULT_TRAILING_WINDOW;
  const minTrack = input.minTrackRecord ?? MIN_TRACK_RECORD_SESSIONS;
  const nav = input.navSeries;
  const n = nav.length;
  const eligible = n >= minTrack;

  const points: NavFlowPoint[] = nav.map((navVnd, i) => ({ navVnd, flowVnd: input.flowSeries?.[i] ?? 0 }));
  const twr = computeTwrSeries(points);
  const periods = twr.dailyTwrFactor.length;
  const annualizedTwr = eligible && periods > 0 ? Math.pow(1 + twr.cumulativeTwr, TRADING_DAYS / periods) - 1 : twr.cumulativeTwr;
  const maxDd = maxDrawdown(nav);
  // Calmar from the window's cumulative TWR (not annualized — short-window
  // annualization distorts it). A clean, near-zero-drawdown positive manager
  // earns top Calmar; a big-drawdown manager is penalized.
  const CALMAR_CAP = 5;
  const calmar = maxDd > 1e-6 ? clamp(twr.cumulativeTwr / maxDd, -CALMAR_CAP, CALMAR_CAP) : twr.cumulativeTwr > 0 ? CALMAR_CAP : 0;
  const vol = std(twr.dailyReturns);
  const sharpe = vol > 0 ? (mean(twr.dailyReturns) / vol) * Math.sqrt(TRADING_DAYS) : 0;
  const consistency = consistencyScore(twr.dailyTwrFactor);

  const ddProtection = clamp(1 - maxDd / 0.3, 0, 1);
  const a = input.attribution ?? null;
  const riskDiscipline = a ? clamp(0.6 * a.avgRiskControl + 0.4 * ddProtection, 0, 1) : ddProtection;
  const cashDragAdj = a ? (a.navVnd > 0 ? clamp(Number(a.cashDragVnd) / a.navVnd + 0.5, 0, 1) : 0.5) : 0.5;
  const attributionQuality = a
    ? clamp(0.25 * a.avgEntryQuality + 0.2 * a.avgHoldingQuality + 0.2 * a.avgExitQuality + 0.15 * a.avgSizingQuality + 0.1 * a.avgRegimeFit + 0.1 * cashDragAdj, 0, 1)
    : 0.5;

  return {
    slug: input.slug,
    sessions: n,
    eligible,
    cumulativeTwr: twr.cumulativeTwr,
    annualizedTwr,
    maxDrawdownPct: maxDd,
    calmar,
    sharpe,
    consistency,
    riskDiscipline,
    attributionQuality,
    dataQualityConfidence: clamp(n / window, 0, 1),
    latestNavVnd: nav[n - 1] ?? 0,
  };
}

// ----------------------------------------------------------- Allocation --------

export interface AllocationProposal {
  slug: string;
  rank: number;
  currentPct: number;
  proposedPct: number;
  changePct: number;
  classification: "increase" | "decrease" | "unchanged";
  eligible: boolean;
  allocScore: number;
  reasonCodes: string[];
  metrics: Record<string, number>;
}

function normalize(values: Map<string, number>): Map<string, number> {
  const vs = [...values.values()];
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const out = new Map<string, number>();
  for (const [k, v] of values) out.set(k, max - min < 1e-12 ? 0.5 : (v - min) / (max - min));
  return out;
}

export interface ProposalOptions {
  currentAllocation: Map<string, number>; // slug → current pct (sums to 1)
  floorPct?: number;
  capPct?: number;
}

export function computeAllocationProposal(scorecards: Scorecard[], options: ProposalOptions): AllocationProposal[] {
  const floor = options.floorPct ?? ALLOC_FLOOR_PCT;
  const cap = options.capPct ?? ALLOC_CAP_PCT;
  const sorted = [...scorecards].sort((a, b) => a.slug.localeCompare(b.slug)); // deterministic input order
  const eligible = sorted.filter((s) => s.eligible);

  // Normalize each scored metric across ELIGIBLE managers only.
  const metricKeys = ["twr", "calmar", "sharpe", "consistency", "riskDiscipline", "attributionQuality"] as const;
  const raw: Record<(typeof metricKeys)[number], Map<string, number>> = {
    twr: new Map(), calmar: new Map(), sharpe: new Map(), consistency: new Map(), riskDiscipline: new Map(), attributionQuality: new Map(),
  };
  for (const s of eligible) {
    raw.twr.set(s.slug, s.cumulativeTwr);
    raw.calmar.set(s.slug, s.calmar);
    raw.sharpe.set(s.slug, s.sharpe);
    raw.consistency.set(s.slug, s.consistency);
    raw.riskDiscipline.set(s.slug, s.riskDiscipline);
    raw.attributionQuality.set(s.slug, s.attributionQuality);
  }
  const norm = Object.fromEntries(metricKeys.map((k) => [k, normalize(raw[k])])) as Record<(typeof metricKeys)[number], Map<string, number>>;

  const allocScore = new Map<string, number>();
  for (const s of sorted) {
    if (!s.eligible) { allocScore.set(s.slug, 0); continue; }
    let sc = 0;
    for (const k of metricKeys) sc += ALLOCATION_WEIGHTS[k] * (norm[k].get(s.slug) ?? 0.5);
    // Participation: a manager must earn a meaningful positive return to be
    // scored on its risk-adjusted metrics — otherwise a near-flat "cash parker"
    // wins on smoothness alone. Deterministic; based on return, not NAV.
    const participation = clamp(s.cumulativeTwr / RETURN_HURDLE, 0, 1);
    allocScore.set(s.slug, sc * s.dataQualityConfidence * participation); // small-sample + participation
  }

  const proposed = distributeWithFloorCap(sorted.map((s) => s.slug), allocScore, floor, cap);

  // Rank by score desc, deterministic tie-break by slug asc.
  const ranking = [...sorted].sort((a, b) => (allocScore.get(b.slug)! - allocScore.get(a.slug)!) || a.slug.localeCompare(b.slug));
  const rankOf = new Map(ranking.map((s, i) => [s.slug, i + 1] as const));

  return sorted.map((s) => {
    const current = options.currentAllocation.get(s.slug) ?? 0;
    const p = proposed.get(s.slug)!;
    const change = p - current;
    const classification: AllocationProposal["classification"] =
      Math.abs(change) < NO_CHANGE_TOLERANCE ? "unchanged" : change > 0 ? "increase" : "decrease";
    const reasons: string[] = [];
    if (!s.eligible) reasons.push(R.ALLOC_INSUFFICIENT_TRACK_RECORD);
    else {
      if ((norm.twr.get(s.slug) ?? 0) >= 0.7) reasons.push(R.ALLOC_STRONG_TWR);
      if ((norm.calmar.get(s.slug) ?? 0) >= 0.7) reasons.push(R.ALLOC_STRONG_CALMAR);
      if (s.consistency >= 0.6) reasons.push(R.ALLOC_CONSISTENT);
      if (s.riskDiscipline >= 0.65) reasons.push(R.ALLOC_RISK_DISCIPLINED);
      if (s.attributionQuality >= 0.65) reasons.push(R.ALLOC_ATTRIBUTION_STRONG);
      if (s.maxDrawdownPct >= 0.2) reasons.push(R.ALLOC_DRAWDOWN_PENALTY);
      if (input_cashDragNegative(s)) reasons.push(R.ALLOC_CASH_DRAG_PENALTY);
    }
    if (Math.abs(p - floor) < 1e-9) reasons.push(R.ALLOC_FLOOR_APPLIED);
    if (Math.abs(p - cap) < 1e-9) reasons.push(R.ALLOC_CAP_APPLIED);
    if (classification === "unchanged") reasons.push(R.ALLOC_NO_CHANGE);

    return {
      slug: s.slug,
      rank: rankOf.get(s.slug)!,
      currentPct: current,
      proposedPct: p,
      changePct: change,
      classification,
      eligible: s.eligible,
      allocScore: allocScore.get(s.slug)!,
      reasonCodes: reasons,
      metrics: { cumulativeTwr: s.cumulativeTwr, annualizedTwr: s.annualizedTwr, maxDrawdownPct: s.maxDrawdownPct, calmar: s.calmar, sharpe: s.sharpe, consistency: s.consistency, riskDiscipline: s.riskDiscipline, attributionQuality: s.attributionQuality, dataQualityConfidence: s.dataQualityConfidence, latestNavVnd: s.latestNavVnd },
    };
  });
}

function input_cashDragNegative(s: Scorecard): boolean {
  // attributionQuality already folds cash drag; expose a penalty flag when drag is material.
  return s.attributionQuality < 0.4;
}

/** Deterministic floor/cap distribution that renormalizes to exactly 1. */
function distributeWithFloorCap(slugs: string[], score: Map<string, number>, floor: number, cap: number): Map<string, number> {
  const N = slugs.length;
  const ordered = [...slugs].sort();
  const totalScore = ordered.reduce((s, k) => s + (score.get(k) ?? 0), 0);
  const alloc = new Map<string, number>();

  if (totalScore <= 0) {
    for (const k of ordered) alloc.set(k, 1 / N);
  } else {
    const remaining = 1 - N * floor;
    for (const k of ordered) alloc.set(k, floor + remaining * ((score.get(k) ?? 0) / totalScore));
    // Apply cap iteratively; redistribute excess to uncapped ∝ score.
    for (let iter = 0; iter < 12; iter++) {
      const over = ordered.filter((k) => alloc.get(k)! > cap + 1e-12);
      if (over.length === 0) break;
      let excess = 0;
      for (const k of over) { excess += alloc.get(k)! - cap; alloc.set(k, cap); }
      const uncapped = ordered.filter((k) => alloc.get(k)! < cap - 1e-12 && (score.get(k) ?? 0) > 0);
      const denom = uncapped.reduce((s, k) => s + (score.get(k) ?? 0), 0);
      if (denom <= 0) { for (const k of uncapped) alloc.set(k, alloc.get(k)! + excess / uncapped.length); break; }
      for (const k of uncapped) alloc.set(k, alloc.get(k)! + excess * ((score.get(k) ?? 0) / denom));
    }
  }
  // Renormalize to exactly 1 (residual to the largest eligible, deterministic).
  const sum = ordered.reduce((s, k) => s + alloc.get(k)!, 0);
  const residual = 1 - sum;
  const top = [...ordered].sort((a, b) => (alloc.get(b)! - alloc.get(a)!) || a.localeCompare(b))[0]!;
  alloc.set(top, alloc.get(top)! + residual);
  return alloc;
}
