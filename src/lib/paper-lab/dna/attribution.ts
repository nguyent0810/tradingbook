/**
 * Performance Attribution (v1) — deterministic, pure.
 *
 * Explains WHY a trade won or lost via heuristic scores in [0,1] (entry /
 * holding / exit / sizing / regime-fit / risk-control) PLUS a monetary
 * decomposition that reconciles to realized P&L: gross price move − fees ==
 * realized. Scores are explicitly separated from money — no invented causal
 * precision. No LLM, no randomness. Post-exit "left on table" is computed only
 * when the forward window is complete (no lookahead).
 */
import { createHash } from "node:crypto";
import type { FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";

export const ATTRIBUTION_SCHEMA_VERSION = "1.0.0";
export const ATTRIBUTION_ENGINE_VERSION = "arena-attribution@1.0.0";
export const POST_EXIT_WINDOW = 5;

const HORIZON_DAYS: Record<string, number> = { SWING_5D: 5, SWING_20D: 20, POSITION_60D: 60 };

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface AttributionTradeInput {
  id: string;
  entryKvnd: number;
  exitKvnd: number;
  quantity: number;
  realizedPnlVnd: number;
  rMultiple: number | null;
  holdingDays: number;
  exitReason: string;
}
export interface AttributionPositionInput {
  id: string;
  avgEntryKvnd: number;
  stopLossKvnd: number;
  initialRiskPerShareKvnd: number | null;
  maxFavorableExcursionKvnd: number;
  maxAdverseExcursionKvnd: number;
  highWaterMarkKvnd: number | null;
}
export interface AttributionEntryDecisionInput {
  id?: string | null;
  confidence?: number;
  reasonCodes?: string[];
  setupQuality?: "A" | "B" | null;
  regimeAtEntry?: string | null;
  riskMult?: number; // memory modulation captured from decision metadata
  dnaVersion?: string | null;
}
export interface ComputeAttributionInput {
  trade: AttributionTradeInput;
  position: AttributionPositionInput;
  agentId: string;
  dna?: FundManagerDna;
  entryDecision?: AttributionEntryDecisionInput;
  exitDecisionId?: string | null;
  regimeAtExit?: string | null;
  entrySessionRange?: { low: number; high: number } | null;
  /** Bars strictly AFTER the exit session; leftOnTable only when >= POST_EXIT_WINDOW. */
  postExitBars?: { high: number; low: number; close: number }[];
}

export interface AttributionResult {
  attributionSchemaVersion: string;
  engineVersion: string;
  dnaVersion: string | null;
  setupType: string;
  exitReason: string;
  regimeAtEntry: string | null;
  regimeAtExit: string | null;
  mfeR: number | null;
  maeR: number | null;
  entryQualityScore: number;
  holdingQualityScore: number;
  exitQualityScore: number;
  sizingQualityScore: number;
  regimeFitScore: number;
  riskControlScore: number;
  grossPriceMoveVnd: number;
  feesVnd: number;
  realizedPnlVnd: number;
  leftOnTablePct: number | null;
  reasonCodes: string[];
  contributions: Record<string, unknown>;
  inputHash: string;
}

const EXIT_REASON_BASE: Record<string, number> = {
  TAKE_PROFIT_HIT: 0.9,
  AGENT_EXIT: 0.65,
  INVALIDATION_EXIT: 0.55,
  TIME_EXIT: 0.5,
  MANUAL_SIM: 0.5,
  STOP_LOSS_HIT: 0.4,
};

export function computeTradeAttribution(input: ComputeAttributionInput): AttributionResult {
  const { trade: t, position: p, dna, entryDecision: ed } = input;

  const R = p.initialRiskPerShareKvnd && p.initialRiskPerShareKvnd > 0
    ? p.initialRiskPerShareKvnd
    : Math.max(p.avgEntryKvnd - p.stopLossKvnd, 0);
  const mfeR = R > 0 ? p.maxFavorableExcursionKvnd / R : null;
  const maeR = R > 0 ? p.maxAdverseExcursionKvnd / R : null;
  const realizedR = t.rMultiple != null ? t.rMultiple : R > 0 ? (t.exitKvnd - t.entryKvnd) / R : 0;

  // Monetary decomposition (reconciles exactly: gross - fees == realized).
  const grossPriceMoveVnd = Math.round((t.exitKvnd - t.entryKvnd) * 1000 * t.quantity);
  const realizedPnlVnd = Math.round(t.realizedPnlVnd);
  const feesVnd = grossPriceMoveVnd - realizedPnlVnd;

  // Entry quality: setup grade + low adverse excursion + entry location in range.
  const setupScore = ed?.setupQuality === "A" ? 1 : ed?.setupQuality === "B" ? 0.6 : 0.4;
  const maeScore = maeR != null ? clamp(1 - clamp(maeR, 0, 1.5) / 1.5, 0, 1) : 0.5;
  let entryLoc = 0.5;
  if (input.entrySessionRange && input.entrySessionRange.high > input.entrySessionRange.low) {
    entryLoc = clamp(1 - (t.entryKvnd - input.entrySessionRange.low) / (input.entrySessionRange.high - input.entrySessionRange.low), 0, 1);
  }
  const entryQualityScore = clamp(0.4 * setupScore + 0.3 * maeScore + 0.3 * entryLoc, 0, 1);

  // Holding quality: MFE capture + holding duration vs horizon.
  const captureRatio = mfeR && mfeR > 0 ? clamp(realizedR / mfeR, 0, 1) : realizedR > 0 ? 1 : 0;
  const horizon = HORIZON_DAYS[dna?.timeHorizon ?? "SWING_20D"] ?? 20;
  const durationFit = clamp(1 - Math.abs(t.holdingDays - horizon) / horizon, 0, 1);
  const holdingQualityScore = clamp(0.7 * captureRatio + 0.3 * durationFit, 0, 1);

  // Exit quality: reason baseline − giveback from high-water − left on table.
  const givebackPct = p.highWaterMarkKvnd && p.highWaterMarkKvnd > p.avgEntryKvnd
    ? clamp((p.highWaterMarkKvnd - t.exitKvnd) / (p.highWaterMarkKvnd - p.avgEntryKvnd), 0, 1)
    : 0;
  let leftOnTablePct: number | null = null;
  if (input.postExitBars && input.postExitBars.length >= POST_EXIT_WINDOW) {
    const maxHigh = Math.max(...input.postExitBars.slice(0, POST_EXIT_WINDOW).map((b) => b.high));
    leftOnTablePct = t.exitKvnd > 0 ? clamp((maxHigh - t.exitKvnd) / t.exitKvnd, 0, 1) : 0;
  }
  const base = EXIT_REASON_BASE[t.exitReason] ?? 0.5;
  const stopDisciplineBonus = t.exitReason === "STOP_LOSS_HIT" && realizedR >= -1.05 ? 0.15 : 0;
  const exitQualityScore = clamp(base + stopDisciplineBonus - 0.5 * givebackPct - 0.5 * (leftOnTablePct ?? 0), 0, 1);

  // Sizing quality: did size/modulation align with confidence and outcome?
  const confidence = ed?.confidence ?? 0.5;
  const riskMult = ed?.riskMult ?? 1;
  const outcomeSign = Math.sign(realizedR);
  const sizingQualityScore = clamp(0.5 + (confidence - 0.5) * outcomeSign + 0.3 * (riskMult - 1) * outcomeSign, 0, 1);

  // Regime fit: entry regime vs the manager's preferred / avoided list.
  const regimeAtEntry = ed?.regimeAtEntry ?? null;
  const preferred = (dna?.identity.preferredRegimes ?? []) as string[];
  const avoided = (dna?.identity.avoidedRegimes ?? []) as string[];
  const regimeFitScore = regimeAtEntry
    ? preferred.includes(regimeAtEntry) ? 1 : avoided.includes(regimeAtEntry) ? 0 : 0.5
    : 0.5;

  // Risk control: loss kept within the planned 1R.
  const riskControlScore = clamp(1 - Math.max(0, -realizedR - 1), 0, 1);

  const setupType = dna?.archetype ?? "unknown";
  const reasonCodes = ed?.reasonCodes ?? [];

  const contributions = {
    monetary: { grossPriceMoveVnd, feesVnd, realizedPnlVnd },
    scores: { entryQualityScore, holdingQualityScore, exitQualityScore, sizingQualityScore, regimeFitScore, riskControlScore },
    meta: { realizedR, mfeR, maeR, captureRatio, givebackPct, leftOnTablePct, durationFit, horizon },
  };
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ t, p, ed: ed ?? null, regimeAtExit: input.regimeAtExit ?? null, post: input.postExitBars?.length ?? 0 }))
    .digest("hex")
    .slice(0, 32);

  return {
    attributionSchemaVersion: ATTRIBUTION_SCHEMA_VERSION,
    engineVersion: ATTRIBUTION_ENGINE_VERSION,
    dnaVersion: ed?.dnaVersion ?? dna?.versioning.dnaVersion ?? null,
    setupType,
    exitReason: t.exitReason,
    regimeAtEntry,
    regimeAtExit: input.regimeAtExit ?? null,
    mfeR,
    maeR,
    entryQualityScore,
    holdingQualityScore,
    exitQualityScore,
    sizingQualityScore,
    regimeFitScore,
    riskControlScore,
    grossPriceMoveVnd,
    feesVnd,
    realizedPnlVnd,
    leftOnTablePct,
    reasonCodes,
    contributions,
    inputHash,
  };
}

/** Deterministic cash-drag estimate: negative in rising markets (drag), positive in falling (protection), zero flat. */
export function computeCashDragVnd(avgCashPct: number, benchmarkReturnPct: number, navVnd: number): number {
  return Math.round(-avgCashPct * (benchmarkReturnPct / 100) * navVnd) + 0; // +0 normalizes -0
}
