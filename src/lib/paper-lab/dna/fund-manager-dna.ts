/**
 * Phase 1 — Fund Manager DNA type definitions.
 *
 * Pure types + versioning constants. No behavior, no evaluator, no persistence.
 * These describe a deterministic fund manager: identity + strategy + portfolio +
 * position + psychology + market-memory sensitivity + rotation behavior +
 * confidence model. A later phase reads these to produce decisions.
 */
import type { TrendRegime, VolatilityRegime, BreadthRegime } from "@/lib/lab/types/regime";

export const DNA_VERSION = "fund-manager-dna@1.0.0";

export const DNA_SUBVERSIONS = {
  identity: "1.0.0",
  strategy: "1.0.0",
  portfolio: "1.0.0",
  position: "1.0.0",
  psychology: "1.0.0",
  marketMemory: "1.0.0",
  rotation: "1.0.0",
} as const;

export interface DnaVersioning {
  identityVersion: string;
  strategyVersion: string;
  portfolioVersion: string;
  positionVersion: string;
  psychologyVersion: string;
  marketMemoryVersion: string;
  rotationVersion: string;
  /** Composite version stamped on every decision for reproducibility. */
  dnaVersion: string;
}

export type Gate1Level = "PASS" | "WARNING" | "FAIL";
export type Gate2QualityFloor = "A" | "B" | null;
export type TrendRegimeScale = Record<TrendRegime, number>;

export interface ManagerIdentity {
  name: string;
  philosophy: string;
  strengths: string[];
  weaknesses: string[];
  preferredRegimes: TrendRegime[];
  avoidedRegimes: TrendRegime[];
  preferredVolatility: VolatilityRegime[];
  preferredBreadth: BreadthRegime[];
}

export interface StrategyDna {
  entry: {
    minGate2Quality: Gate2QualityFloor;
    requireDualUptrend: boolean;
    requireStockAboveMa50: boolean;
    minRs20: number | null;
    minRs50: number | null;
    minVolRatio: number | null;
    customTrigger: "early_entry_ready" | "oversold_ma20" | "pullback_zone" | null;
    allowedGate1: Gate1Level[];
  };
  preferredSetups: string[];
  avoidedSetups: string[];
  confirmation: {
    requireVolumeExpansion: boolean;
    requireCloseAboveTrigger: boolean;
    requireRegimeAlignment: boolean;
    minConfirmations: number;
  };
  /** Canonical reason codes this manager may emit (see contracts/reason-codes). */
  reasonCodes: string[];
}

export interface PortfolioDna {
  baseCashReservePct: number;
  maxPortfolioExposurePct: number;
  maxConcurrentPositions: number;
  maxPerSymbolPct: number;
  maxNewEntriesPerDay: number;
  /** Null until sector data exists — never enforced/faked in v1. */
  maxSectorPct: number | null;
  capitalDeployment: "aggressive" | "measured" | "cautious";
  riskOnRiskOff: {
    exposureScaleByTrend: TrendRegimeScale;
    haltNewInWarning: boolean;
    haltNewInFail: boolean;
  };
}

export interface PositionDna {
  sizing: { model: "fixed_fractional_risk"; baseRiskPctOfNav: number };
  stop: {
    model: "gate2_stop" | "atr_mult" | "pct_below_entry" | "early_entry";
    atrMult?: number;
    pctBelowEntry?: number;
    hardMaxR?: number;
  };
  target: { model: "r_multiple" | "ma20_touch" | "gate2_breakout_ext" | "none"; rMultiple?: number };
  trailing: {
    enabled: boolean;
    breakevenAtR: number | null;
    ref: "prior_swing_low" | "ma20" | "atr_chandelier" | "none";
    atrMult?: number;
  };
  add: { enabled: boolean; triggerAtR: number | null; maxAdds: number; addRiskPctOfNav: number };
  reduce: { enabled: boolean; partialAtR: number | null; reduceFraction: number };
  exit: { setupInvalidation: boolean; regimeExitAtOrBelow: TrendRegime | null };
  timeStop: { maxHoldingDays: number };
  deadMoney: { days: number | null; minR: number | null };
}

export interface PsychologyDna {
  aggressiveness: number;
  patience: number;
  lossTolerance: number;
  drawdownResponse: { deRiskAtDdPct: number; riskCutFactor: number; haltNewAtDdPct: number };
  winStreak: { streakLen: number; riskBoostFactor: number; maxBoost: number };
  lossStreak: { streakLen: number; riskCutFactor: number; coolOffDays: number };
  confidenceScaling: { byWinRate: number; byCalibration: number };
}

export type MarketMemoryStyleTag =
  | "breakout"
  | "pullback"
  | "mean_reversion"
  | "trend"
  | "rs"
  | "early"
  | "allweather"
  | "defensive";

export interface MarketMemoryDna {
  styleTag: MarketMemoryStyleTag;
  sensitivity: {
    toOwnStyleSuccess: number;
    toFalseBreakoutRate: number;
    toTrendPersistence: number;
    toRegimeSetupSuccess: number;
  };
  minSampleSize: number;
}

export interface RotationDna {
  enabled: boolean;
  threshold: number;
  aggressiveness: number;
  maxRotationsPerDay: number;
  reduceVsExitBias: number;
  requireCleanRegime: boolean;
}

export interface ConfidenceDna {
  weights: { gate2: number; rs: number; volume: number; regime: number; dual: number };
  floor: number;
  ceil: number;
}

export interface FundManagerDna {
  slug: string;
  archetype: string;
  timeHorizon: "SWING_5D" | "SWING_20D" | "POSITION_60D";
  versioning: DnaVersioning;
  identity: ManagerIdentity;
  strategy: StrategyDna;
  portfolio: PortfolioDna;
  position: PositionDna;
  psychology: PsychologyDna;
  marketMemory: MarketMemoryDna;
  rotation: RotationDna;
  confidence: ConfidenceDna;
}

/** The 9 competing fund managers (existing slugs; excludes meta `cio`). */
export type ManagerSlug =
  | "aggressive_investor"
  | "value_investor"
  | "momentum_investor"
  | "trend_follower"
  | "swing_trader"
  | "mean_reversion_trader"
  | "devils_advocate"
  | "safe_investor"
  | "risk_manager";

export const MANAGER_SLUGS: readonly ManagerSlug[] = [
  "aggressive_investor",
  "value_investor",
  "momentum_investor",
  "trend_follower",
  "swing_trader",
  "mean_reversion_trader",
  "devils_advocate",
  "safe_investor",
  "risk_manager",
];

/** Shared v1 versioning block (same across managers until a section is revised). */
export const BASE_VERSIONING: DnaVersioning = {
  identityVersion: DNA_SUBVERSIONS.identity,
  strategyVersion: DNA_SUBVERSIONS.strategy,
  portfolioVersion: DNA_SUBVERSIONS.portfolio,
  positionVersion: DNA_SUBVERSIONS.position,
  psychologyVersion: DNA_SUBVERSIONS.psychology,
  marketMemoryVersion: DNA_SUBVERSIONS.marketMemory,
  rotationVersion: DNA_SUBVERSIONS.rotation,
  dnaVersion: DNA_VERSION,
};
