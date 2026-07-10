/**
 * Phase 1 — The 9 deterministic fund-manager DNA configs, keyed by existing
 * slug. Pure frozen data: no evaluator reads these yet, no behavior changes.
 *
 * Slug → manager:
 *   aggressive_investor   → Breakout Hunter
 *   value_investor        → Pullback Operator
 *   momentum_investor     → RS Rotator
 *   trend_follower        → Trend Rider
 *   swing_trader          → Swing Tactician
 *   mean_reversion_trader → Mean-Reversion Dip
 *   devils_advocate       → Early Bird
 *   safe_investor         → All-Weather Allocator
 *   risk_manager          → Risk Warden
 */
import {
  BASE_VERSIONING,
  MANAGER_SLUGS,
  type FundManagerDna,
  type ManagerSlug,
} from "@/lib/paper-lab/dna/fund-manager-dna";
import { REASON_CODES } from "@/lib/paper-lab/contracts/reason-codes";

const R = REASON_CODES;

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) deepFreeze(value);
    Object.freeze(obj);
  }
  return obj;
}

const CONFIGS: Record<ManagerSlug, FundManagerDna> = {
  // 1) Breakout Hunter -------------------------------------------------------
  aggressive_investor: {
    slug: "aggressive_investor",
    archetype: "breakout_hunter",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Breakout Hunter",
      philosophy: "Deploy aggressively into confirmed breakouts on expanding volume; pyramid winners and exit late on trails.",
      strengths: ["momentum capture", "risk-on deployment", "letting winners run"],
      weaknesses: ["choppy/sideways markets", "false breakouts", "higher drawdown"],
      preferredRegimes: ["StrongBull", "WeakBull"],
      avoidedRegimes: ["StrongBear"],
      preferredVolatility: ["Expanding", "HighVol"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: "A",
        requireDualUptrend: false,
        requireStockAboveMa50: false,
        minRs20: 0,
        minRs50: null,
        minVolRatio: 1.5,
        customTrigger: null,
        allowedGate1: ["PASS", "WARNING"],
      },
      preferredSetups: ["breakout_A_volume"],
      avoidedSetups: ["low_volume", "choppy_range"],
      confirmation: { requireVolumeExpansion: true, requireCloseAboveTrigger: true, requireRegimeAlignment: true, minConfirmations: 2 },
      reasonCodes: [R.BRK_A_VOL_CONFIRM, R.BRK_RS_POS, R.BRK_ADD_1R, R.BRK_PARTIAL_2R, R.BRK_STOP_STRUCT, R.BRK_TRAIL_BE, R.BRK_EXIT_REGIME, R.BRK_BLOCK_FAIL, R.ROTATE_INTO_LEADER, R.ROTATE_REDUCE_LAGGARD, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.05,
      maxPortfolioExposurePct: 0.7,
      maxConcurrentPositions: 6,
      maxPerSymbolPct: 0.2,
      maxNewEntriesPerDay: 3,
      maxSectorPct: null,
      capitalDeployment: "aggressive",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 1, Sideways: 0.5, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.01 },
      stop: { model: "gate2_stop", hardMaxR: 1.2 },
      target: { model: "r_multiple", rMultiple: 3 },
      trailing: { enabled: true, breakevenAtR: 1, ref: "prior_swing_low" },
      add: { enabled: true, triggerAtR: 1, maxAdds: 1, addRiskPctOfNav: 0.005 },
      reduce: { enabled: true, partialAtR: 2, reduceFraction: 0.5 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "StrongBear" },
      timeStop: { maxHoldingDays: 25 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.9,
      patience: 0.2,
      lossTolerance: 0.8,
      drawdownResponse: { deRiskAtDdPct: 18, riskCutFactor: 0.6, haltNewAtDdPct: 25 },
      winStreak: { streakLen: 3, riskBoostFactor: 1.3, maxBoost: 1.5 },
      lossStreak: { streakLen: 4, riskCutFactor: 0.7, coolOffDays: 1 },
      confidenceScaling: { byWinRate: 0.3, byCalibration: 0.2 },
    },
    marketMemory: {
      styleTag: "breakout",
      sensitivity: { toOwnStyleSuccess: 0.4, toFalseBreakoutRate: 0.8, toTrendPersistence: 0.2, toRegimeSetupSuccess: 0.4 },
      minSampleSize: 10,
    },
    rotation: { enabled: true, threshold: 0.2, aggressiveness: 0.6, maxRotationsPerDay: 2, reduceVsExitBias: 0.5, requireCleanRegime: false },
    confidence: { weights: { gate2: 0.3, rs: 0.2, volume: 0.3, regime: 0.15, dual: 0.05 }, floor: 0.35, ceil: 0.9 },
  },

  // 2) Pullback Operator -----------------------------------------------------
  value_investor: {
    slug: "value_investor",
    archetype: "pullback_operator",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Pullback Operator",
      philosophy: "Buy controlled pullbacks into support within confirmed uptrends; single-entry and disciplined.",
      strengths: ["buying strength on a dip", "entry discipline", "favorable entries"],
      weaknesses: ["missing straight-up breakouts", "requires an established trend"],
      preferredRegimes: ["StrongBull", "WeakBull"],
      avoidedRegimes: ["WeakBear", "StrongBear"],
      preferredVolatility: ["LowVol", "Contracting"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: null,
        requireDualUptrend: true,
        requireStockAboveMa50: true,
        minRs20: null,
        minRs50: 0,
        minVolRatio: null,
        customTrigger: "pullback_zone",
        allowedGate1: ["PASS"],
      },
      preferredSetups: ["pullback_to_support"],
      avoidedSetups: ["extended_from_ma20", "breakout_chase"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: false, requireRegimeAlignment: true, minConfirmations: 1 },
      reasonCodes: [R.PB_ZONE_ENTRY, R.PB_DUAL_UPTREND, R.PB_PARTIAL_1_5R, R.PB_STOP_ZONE, R.PB_EXIT_SUPPORT_BREAK, R.PB_BLOCK_NO_TREND, R.ROTATE_REDUCE_LAGGARD, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.1,
      maxPortfolioExposurePct: 0.65,
      maxConcurrentPositions: 5,
      maxPerSymbolPct: 0.18,
      maxNewEntriesPerDay: 2,
      maxSectorPct: null,
      capitalDeployment: "measured",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 0.8, Sideways: 0.3, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: true,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.01 },
      stop: { model: "pct_below_entry", pctBelowEntry: 0.04, hardMaxR: 1.2 },
      target: { model: "r_multiple", rMultiple: 2.5 },
      trailing: { enabled: true, breakevenAtR: 1, ref: "ma20" },
      add: { enabled: false, triggerAtR: null, maxAdds: 0, addRiskPctOfNav: 0 },
      reduce: { enabled: true, partialAtR: 1.5, reduceFraction: 0.33 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 20 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.5,
      patience: 0.7,
      lossTolerance: 0.5,
      drawdownResponse: { deRiskAtDdPct: 12, riskCutFactor: 0.6, haltNewAtDdPct: 18 },
      winStreak: { streakLen: 2, riskBoostFactor: 1.15, maxBoost: 1.3 },
      lossStreak: { streakLen: 3, riskCutFactor: 0.75, coolOffDays: 1 },
      confidenceScaling: { byWinRate: 0.25, byCalibration: 0.2 },
    },
    marketMemory: {
      styleTag: "pullback",
      sensitivity: { toOwnStyleSuccess: 0.5, toFalseBreakoutRate: 0.3, toTrendPersistence: 0.4, toRegimeSetupSuccess: 0.4 },
      minSampleSize: 10,
    },
    rotation: { enabled: true, threshold: 0.3, aggressiveness: 0.3, maxRotationsPerDay: 1, reduceVsExitBias: 0.3, requireCleanRegime: false },
    confidence: { weights: { gate2: 0.2, rs: 0.25, volume: 0.05, regime: 0.15, dual: 0.35 }, floor: 0.35, ceil: 0.85 },
  },

  // 3) RS Rotator ------------------------------------------------------------
  momentum_investor: {
    slug: "momentum_investor",
    archetype: "rs_rotator",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "RS Rotator",
      philosophy: "Own the strongest relative-strength leaders and rotate as leadership fades.",
      strengths: ["leadership capture", "rotation into strength", "momentum persistence"],
      weaknesses: ["sharp reversals", "leadership whipsaws"],
      preferredRegimes: ["StrongBull", "WeakBull", "Sideways"],
      avoidedRegimes: ["StrongBear"],
      preferredVolatility: ["Expanding"],
      preferredBreadth: ["RiskOn", "Rotation"],
    },
    strategy: {
      entry: {
        minGate2Quality: null,
        requireDualUptrend: false,
        requireStockAboveMa50: true,
        minRs20: 0,
        minRs50: 5,
        minVolRatio: null,
        customTrigger: null,
        allowedGate1: ["PASS", "WARNING"],
      },
      preferredSetups: ["rs_leadership"],
      avoidedSetups: ["rs_laggard", "below_ma50"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: false, requireRegimeAlignment: true, minConfirmations: 1 },
      reasonCodes: [R.RS_LEADER_ENTRY, R.RS_ABOVE_MA50, R.RS_ADD_MOMENTUM, R.RS_REDUCE_FADE, R.RS_EXIT_BELOW_MA50, R.RS_TRAIL_CHANDELIER, R.ROTATE_INTO_LEADER, R.ROTATE_EXIT_LAGGARD, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.05,
      maxPortfolioExposurePct: 0.7,
      maxConcurrentPositions: 5,
      maxPerSymbolPct: 0.2,
      maxNewEntriesPerDay: 3,
      maxSectorPct: null,
      capitalDeployment: "aggressive",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 1, Sideways: 0.5, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.012 },
      stop: { model: "pct_below_entry", pctBelowEntry: 0.06, hardMaxR: 1.2 },
      target: { model: "none" },
      trailing: { enabled: true, breakevenAtR: 1.5, ref: "atr_chandelier", atrMult: 3 },
      add: { enabled: true, triggerAtR: 1, maxAdds: 1, addRiskPctOfNav: 0.006 },
      reduce: { enabled: true, partialAtR: null, reduceFraction: 0.5 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "StrongBear" },
      timeStop: { maxHoldingDays: 30 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.75,
      patience: 0.4,
      lossTolerance: 0.7,
      drawdownResponse: { deRiskAtDdPct: 15, riskCutFactor: 0.6, haltNewAtDdPct: 22 },
      winStreak: { streakLen: 3, riskBoostFactor: 1.25, maxBoost: 1.5 },
      lossStreak: { streakLen: 3, riskCutFactor: 0.7, coolOffDays: 1 },
      confidenceScaling: { byWinRate: 0.3, byCalibration: 0.2 },
    },
    marketMemory: {
      styleTag: "rs",
      sensitivity: { toOwnStyleSuccess: 0.5, toFalseBreakoutRate: 0.2, toTrendPersistence: 0.5, toRegimeSetupSuccess: 0.3 },
      minSampleSize: 10,
    },
    rotation: { enabled: true, threshold: 0.15, aggressiveness: 0.8, maxRotationsPerDay: 2, reduceVsExitBias: 0.6, requireCleanRegime: false },
    confidence: { weights: { gate2: 0.1, rs: 0.45, volume: 0.05, regime: 0.2, dual: 0.2 }, floor: 0.35, ceil: 0.9 },
  },

  // 4) Trend Rider -----------------------------------------------------------
  trend_follower: {
    slug: "trend_follower",
    archetype: "trend_rider",
    timeHorizon: "POSITION_60D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Trend Rider",
      philosophy: "Long-horizon position trend-following; few trades, wide stops, let winners run.",
      strengths: ["capturing large trends", "patience", "low turnover"],
      weaknesses: ["sideways chop", "wide-stop giveback", "slow to react"],
      preferredRegimes: ["StrongBull", "WeakBull"],
      avoidedRegimes: ["Sideways", "WeakBear", "StrongBear"],
      preferredVolatility: ["LowVol"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: null,
        requireDualUptrend: true,
        requireStockAboveMa50: true,
        minRs20: null,
        minRs50: null,
        minVolRatio: null,
        customTrigger: null,
        allowedGate1: ["PASS"],
      },
      preferredSetups: ["trend_continuation"],
      avoidedSetups: ["counter_trend", "sideways"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: false, requireRegimeAlignment: true, minConfirmations: 1 },
      reasonCodes: [R.TR_BULL_ENTRY, R.TR_DUAL_UPTREND, R.TR_PYRAMID_2R, R.TR_TRAIL_MA20, R.TR_EXIT_REGIME_DOWNGRADE, R.TR_BLOCK_NOT_BULL, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.1,
      maxPortfolioExposurePct: 0.7,
      maxConcurrentPositions: 4,
      maxPerSymbolPct: 0.2,
      maxNewEntriesPerDay: 2,
      maxSectorPct: null,
      capitalDeployment: "measured",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 0.5, Sideways: 0, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.008 },
      stop: { model: "pct_below_entry", pctBelowEntry: 0.08, hardMaxR: 2 },
      target: { model: "none" },
      trailing: { enabled: true, breakevenAtR: 2, ref: "ma20" },
      add: { enabled: true, triggerAtR: 2, maxAdds: 2, addRiskPctOfNav: 0.004 },
      reduce: { enabled: false, partialAtR: null, reduceFraction: 0 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 60 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.7,
      patience: 0.6,
      lossTolerance: 0.9,
      drawdownResponse: { deRiskAtDdPct: 20, riskCutFactor: 0.6, haltNewAtDdPct: 28 },
      winStreak: { streakLen: 3, riskBoostFactor: 1.2, maxBoost: 1.4 },
      lossStreak: { streakLen: 4, riskCutFactor: 0.8, coolOffDays: 0 },
      confidenceScaling: { byWinRate: 0.2, byCalibration: 0.2 },
    },
    marketMemory: {
      styleTag: "trend",
      sensitivity: { toOwnStyleSuccess: 0.4, toFalseBreakoutRate: 0.1, toTrendPersistence: 0.8, toRegimeSetupSuccess: 0.3 },
      minSampleSize: 10,
    },
    rotation: { enabled: false, threshold: 0.5, aggressiveness: 0.1, maxRotationsPerDay: 0, reduceVsExitBias: 0.5, requireCleanRegime: true },
    confidence: { weights: { gate2: 0.1, rs: 0.2, volume: 0.05, regime: 0.35, dual: 0.3 }, floor: 0.4, ceil: 0.9 },
  },

  // 5) Swing Tactician -------------------------------------------------------
  swing_trader: {
    slug: "swing_trader",
    archetype: "swing_tactician",
    timeHorizon: "SWING_5D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Swing Tactician",
      philosophy: "Fast in/out on A/B setups; harvest the 3–10 day swing and never marry a position.",
      strengths: ["quick harvests", "capital recycling", "tight risk"],
      weaknesses: ["misses big trends", "fee/turnover drag", "whipsaw"],
      preferredRegimes: ["StrongBull", "WeakBull", "Sideways"],
      avoidedRegimes: ["StrongBear"],
      preferredVolatility: ["Expanding"],
      preferredBreadth: ["RiskOn", "Rotation"],
    },
    strategy: {
      entry: {
        minGate2Quality: "B",
        requireDualUptrend: false,
        requireStockAboveMa50: false,
        minRs20: null,
        minRs50: null,
        minVolRatio: 1.2,
        customTrigger: null,
        allowedGate1: ["PASS", "WARNING"],
      },
      preferredSetups: ["swing_A", "swing_B"],
      avoidedSetups: ["low_volume"],
      confirmation: { requireVolumeExpansion: true, requireCloseAboveTrigger: true, requireRegimeAlignment: false, minConfirmations: 1 },
      reasonCodes: [R.SW_AB_ENTRY, R.SW_PARTIAL_1R, R.SW_TIME_STOP_10D, R.SW_FLAT_STOP_5D, R.SW_STOP_STRUCT, R.SW_TP_2R, R.ROTATE_REDUCE_LAGGARD, R.SKIP_NO_CAPACITY],
    },
    portfolio: {
      baseCashReservePct: 0.05,
      maxPortfolioExposurePct: 0.7,
      maxConcurrentPositions: 6,
      maxPerSymbolPct: 0.15,
      maxNewEntriesPerDay: 3,
      maxSectorPct: null,
      capitalDeployment: "aggressive",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 1, Sideways: 0.7, WeakBear: 0.2, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.008 },
      stop: { model: "gate2_stop", hardMaxR: 1 },
      target: { model: "r_multiple", rMultiple: 2 },
      trailing: { enabled: true, breakevenAtR: 1, ref: "none" },
      add: { enabled: false, triggerAtR: null, maxAdds: 0, addRiskPctOfNav: 0 },
      reduce: { enabled: true, partialAtR: 1, reduceFraction: 0.5 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "StrongBear" },
      timeStop: { maxHoldingDays: 10 },
      deadMoney: { days: 5, minR: 0.2 },
    },
    psychology: {
      aggressiveness: 0.6,
      patience: 0.3,
      lossTolerance: 0.5,
      drawdownResponse: { deRiskAtDdPct: 12, riskCutFactor: 0.6, haltNewAtDdPct: 18 },
      winStreak: { streakLen: 3, riskBoostFactor: 1.15, maxBoost: 1.3 },
      lossStreak: { streakLen: 3, riskCutFactor: 0.7, coolOffDays: 2 },
      confidenceScaling: { byWinRate: 0.3, byCalibration: 0.2 },
    },
    marketMemory: {
      styleTag: "breakout",
      sensitivity: { toOwnStyleSuccess: 0.6, toFalseBreakoutRate: 0.5, toTrendPersistence: 0.2, toRegimeSetupSuccess: 0.3 },
      minSampleSize: 8,
    },
    rotation: { enabled: true, threshold: 0.25, aggressiveness: 0.5, maxRotationsPerDay: 2, reduceVsExitBias: 0.7, requireCleanRegime: false },
    confidence: { weights: { gate2: 0.4, rs: 0.15, volume: 0.25, regime: 0.15, dual: 0.05 }, floor: 0.35, ceil: 0.85 },
  },

  // 6) Mean-Reversion Dip ----------------------------------------------------
  mean_reversion_trader: {
    slug: "mean_reversion_trader",
    archetype: "mean_reversion_dip",
    timeHorizon: "SWING_5D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Mean-Reversion Dip",
      philosophy: "Patiently buy oversold dislocations within uptrends for a bounce to the mean; never chase, never average down.",
      strengths: ["sideways markets", "entry patience", "tight risk"],
      weaknesses: ["strong downtrends (falling knives)", "low average R"],
      preferredRegimes: ["Sideways", "WeakBull"],
      avoidedRegimes: ["WeakBear", "StrongBear"],
      preferredVolatility: ["HighVol"],
      preferredBreadth: ["Rotation"],
    },
    strategy: {
      entry: {
        minGate2Quality: null,
        requireDualUptrend: false,
        requireStockAboveMa50: true,
        minRs20: null,
        minRs50: null,
        minVolRatio: null,
        customTrigger: "oversold_ma20",
        allowedGate1: ["PASS", "WARNING"],
      },
      preferredSetups: ["oversold_bounce"],
      avoidedSetups: ["falling_knife", "downtrend"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: false, requireRegimeAlignment: true, minConfirmations: 1 },
      reasonCodes: [R.MR_OVERSOLD_MA20, R.MR_NEAR_20D_LOW, R.MR_TARGET_MA20, R.MR_STOP_LOW_BREAK, R.MR_TIME_STOP_8D, R.MR_BLOCK_BEAR, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.15,
      maxPortfolioExposurePct: 0.4,
      maxConcurrentPositions: 3,
      maxPerSymbolPct: 0.12,
      maxNewEntriesPerDay: 2,
      maxSectorPct: null,
      capitalDeployment: "cautious",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 0.8, WeakBull: 0.8, Sideways: 1, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.005 },
      stop: { model: "pct_below_entry", pctBelowEntry: 0.04, hardMaxR: 1 },
      target: { model: "ma20_touch" },
      trailing: { enabled: false, breakevenAtR: null, ref: "none" },
      add: { enabled: false, triggerAtR: null, maxAdds: 0, addRiskPctOfNav: 0 },
      reduce: { enabled: true, partialAtR: 1, reduceFraction: 0.5 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 8 },
      deadMoney: { days: 4, minR: 0.1 },
    },
    psychology: {
      aggressiveness: 0.35,
      patience: 0.9,
      lossTolerance: 0.35,
      drawdownResponse: { deRiskAtDdPct: 8, riskCutFactor: 0.5, haltNewAtDdPct: 12 },
      winStreak: { streakLen: 5, riskBoostFactor: 1, maxBoost: 1 },
      lossStreak: { streakLen: 2, riskCutFactor: 0.6, coolOffDays: 2 },
      confidenceScaling: { byWinRate: 0.2, byCalibration: 0.3 },
    },
    marketMemory: {
      styleTag: "mean_reversion",
      sensitivity: { toOwnStyleSuccess: 0.7, toFalseBreakoutRate: 0.2, toTrendPersistence: 0.3, toRegimeSetupSuccess: 0.5 },
      minSampleSize: 12,
    },
    rotation: { enabled: false, threshold: 0.5, aggressiveness: 0.1, maxRotationsPerDay: 0, reduceVsExitBias: 0.2, requireCleanRegime: true },
    confidence: { weights: { gate2: 0.1, rs: 0.25, volume: 0.1, regime: 0.3, dual: 0.25 }, floor: 0.3, ceil: 0.8 },
  },

  // 7) Early Bird ------------------------------------------------------------
  devils_advocate: {
    slug: "devils_advocate",
    archetype: "early_bird",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Early Bird",
      philosophy: "Take anticipatory pilot entries a step ahead of confirmation, then scale in as the setup confirms.",
      strengths: ["better average entry price", "early positioning"],
      weaknesses: ["more noise/false starts", "needs disciplined invalidation"],
      preferredRegimes: ["StrongBull", "WeakBull"],
      avoidedRegimes: ["WeakBear", "StrongBear"],
      preferredVolatility: ["Contracting", "Expanding"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: null,
        requireDualUptrend: false,
        requireStockAboveMa50: false,
        minRs20: 0,
        minRs50: null,
        minVolRatio: null,
        customTrigger: "early_entry_ready",
        allowedGate1: ["PASS"],
      },
      preferredSetups: ["early_pilot", "compression_breakout"],
      avoidedSetups: ["extended", "weak_rr"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: false, requireRegimeAlignment: true, minConfirmations: 1 },
      reasonCodes: [R.EB_EARLY_READY, R.EB_RS_POS, R.EB_ADD_ON_CONFIRM, R.EB_PARTIAL_1_5R, R.EB_STOP_RR, R.EB_INVALIDATE, R.SKIP_REGIME_HALT, R.SKIP_UNCONFIRMED],
    },
    portfolio: {
      baseCashReservePct: 0.1,
      maxPortfolioExposurePct: 0.6,
      maxConcurrentPositions: 5,
      maxPerSymbolPct: 0.15,
      maxNewEntriesPerDay: 3,
      maxSectorPct: null,
      capitalDeployment: "measured",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 0.7, Sideways: 0.4, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: true,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.007 },
      stop: { model: "early_entry", hardMaxR: 1.2 },
      target: { model: "r_multiple", rMultiple: 2.5 },
      trailing: { enabled: true, breakevenAtR: 1, ref: "prior_swing_low" },
      add: { enabled: true, triggerAtR: null, maxAdds: 1, addRiskPctOfNav: 0.004 },
      reduce: { enabled: true, partialAtR: 1.5, reduceFraction: 0.33 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 15 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.55,
      patience: 0.5,
      lossTolerance: 0.6,
      drawdownResponse: { deRiskAtDdPct: 14, riskCutFactor: 0.6, haltNewAtDdPct: 20 },
      winStreak: { streakLen: 3, riskBoostFactor: 1.2, maxBoost: 1.4 },
      lossStreak: { streakLen: 3, riskCutFactor: 0.7, coolOffDays: 1 },
      confidenceScaling: { byWinRate: 0.25, byCalibration: 0.25 },
    },
    marketMemory: {
      styleTag: "early",
      sensitivity: { toOwnStyleSuccess: 0.5, toFalseBreakoutRate: 0.4, toTrendPersistence: 0.3, toRegimeSetupSuccess: 0.4 },
      minSampleSize: 10,
    },
    rotation: { enabled: false, threshold: 0.4, aggressiveness: 0.2, maxRotationsPerDay: 1, reduceVsExitBias: 0.4, requireCleanRegime: false },
    confidence: { weights: { gate2: 0.2, rs: 0.25, volume: 0.15, regime: 0.3, dual: 0.1 }, floor: 0.35, ceil: 0.85 },
  },

  // 8) All-Weather Allocator -------------------------------------------------
  safe_investor: {
    slug: "safe_investor",
    archetype: "all_weather_allocator",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "All-Weather Allocator",
      philosophy: "Conservative, regime-adaptive allocation; only top-quality setups, scaling exposure with the environment and raising cash into weakness.",
      strengths: ["capital preservation", "regime adaptation", "steady compounding"],
      weaknesses: ["lags in explosive rallies", "cash drag"],
      preferredRegimes: ["StrongBull", "WeakBull", "Sideways"],
      avoidedRegimes: ["StrongBear"],
      preferredVolatility: ["LowVol", "Contracting"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: "A",
        requireDualUptrend: false,
        requireStockAboveMa50: true,
        minRs20: null,
        minRs50: null,
        minVolRatio: null,
        customTrigger: null,
        allowedGate1: ["PASS"],
      },
      preferredSetups: ["quality_A_riskon"],
      avoidedSetups: ["highvol", "riskoff", "B_or_invalid"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: true, requireRegimeAlignment: true, minConfirmations: 2 },
      reasonCodes: [R.AW_A_RISKON, R.AW_REGIME_SCALE, R.AW_REDUCE_DOWNGRADE, R.AW_STOP_STRUCT, R.AW_CASH_UP_BEAR, R.AW_BLOCK_HIGHVOL, R.ROTATE_REDUCE_LAGGARD, R.SKIP_DRAWDOWN_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.1,
      maxPortfolioExposurePct: 0.7,
      maxConcurrentPositions: 5,
      maxPerSymbolPct: 0.15,
      maxNewEntriesPerDay: 2,
      maxSectorPct: null,
      capitalDeployment: "cautious",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 0.7, Sideways: 0.4, WeakBear: 0.15, StrongBear: 0 },
        haltNewInWarning: false,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.006 },
      stop: { model: "gate2_stop", hardMaxR: 1 },
      target: { model: "r_multiple", rMultiple: 3 },
      trailing: { enabled: true, breakevenAtR: 1.5, ref: "prior_swing_low" },
      add: { enabled: false, triggerAtR: null, maxAdds: 0, addRiskPctOfNav: 0 },
      reduce: { enabled: true, partialAtR: null, reduceFraction: 0.33 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 30 },
      deadMoney: { days: null, minR: null },
    },
    psychology: {
      aggressiveness: 0.4,
      patience: 0.8,
      lossTolerance: 0.4,
      drawdownResponse: { deRiskAtDdPct: 10, riskCutFactor: 0.5, haltNewAtDdPct: 15 },
      winStreak: { streakLen: 4, riskBoostFactor: 1, maxBoost: 1 },
      lossStreak: { streakLen: 4, riskCutFactor: 0.7, coolOffDays: 1 },
      confidenceScaling: { byWinRate: 0.2, byCalibration: 0.3 },
    },
    marketMemory: {
      styleTag: "allweather",
      sensitivity: { toOwnStyleSuccess: 0.4, toFalseBreakoutRate: 0.3, toTrendPersistence: 0.5, toRegimeSetupSuccess: 0.6 },
      minSampleSize: 10,
    },
    rotation: { enabled: true, threshold: 0.4, aggressiveness: 0.2, maxRotationsPerDay: 1, reduceVsExitBias: 0.3, requireCleanRegime: true },
    confidence: { weights: { gate2: 0.3, rs: 0.15, volume: 0.05, regime: 0.4, dual: 0.1 }, floor: 0.35, ceil: 0.85 },
  },

  // 9) Risk Warden -----------------------------------------------------------
  risk_manager: {
    slug: "risk_manager",
    archetype: "risk_warden",
    timeHorizon: "SWING_20D",
    versioning: BASE_VERSIONING,
    identity: {
      name: "Risk Warden",
      philosophy: "Defensive overlay: keep high cash, cap exposure, cut losers early, refuse weak regimes; protect drawdown at the cost of bull-run upside.",
      strengths: ["drawdown protection", "discipline", "loss avoidance"],
      weaknesses: ["cash drag in bull runs", "underperforms in strong rallies"],
      preferredRegimes: ["StrongBull", "WeakBull"],
      avoidedRegimes: ["Sideways", "WeakBear", "StrongBear"],
      preferredVolatility: ["LowVol"],
      preferredBreadth: ["RiskOn"],
    },
    strategy: {
      entry: {
        minGate2Quality: "A",
        requireDualUptrend: false,
        requireStockAboveMa50: true,
        minRs20: null,
        minRs50: null,
        minVolRatio: null,
        customTrigger: null,
        allowedGate1: ["PASS"],
      },
      preferredSetups: ["quality_A_clean"],
      avoidedSetups: ["warning_regime", "fail_regime", "high_exposure"],
      confirmation: { requireVolumeExpansion: false, requireCloseAboveTrigger: true, requireRegimeAlignment: true, minConfirmations: 2 },
      reasonCodes: [R.RW_SELECTIVE_ENTRY, R.RW_TRIM_EXPOSURE, R.RW_CUT_LOSER_EARLY, R.RW_DEADMONEY_TIMESTOP, R.RW_DERISK_BEAR, R.RW_HALT_NOT_PASS, R.SKIP_DRAWDOWN_HALT, R.SKIP_REGIME_HALT],
    },
    portfolio: {
      baseCashReservePct: 0.2,
      maxPortfolioExposurePct: 0.5,
      maxConcurrentPositions: 4,
      maxPerSymbolPct: 0.12,
      maxNewEntriesPerDay: 1,
      maxSectorPct: null,
      capitalDeployment: "cautious",
      riskOnRiskOff: {
        exposureScaleByTrend: { StrongBull: 1, WeakBull: 0.6, Sideways: 0.2, WeakBear: 0, StrongBear: 0 },
        haltNewInWarning: true,
        haltNewInFail: true,
      },
    },
    position: {
      sizing: { model: "fixed_fractional_risk", baseRiskPctOfNav: 0.005 },
      stop: { model: "gate2_stop", hardMaxR: 1 },
      target: { model: "r_multiple", rMultiple: 2 },
      trailing: { enabled: true, breakevenAtR: 0.8, ref: "prior_swing_low" },
      add: { enabled: false, triggerAtR: null, maxAdds: 0, addRiskPctOfNav: 0 },
      reduce: { enabled: true, partialAtR: null, reduceFraction: 0.33 },
      exit: { setupInvalidation: true, regimeExitAtOrBelow: "WeakBear" },
      timeStop: { maxHoldingDays: 20 },
      deadMoney: { days: 10, minR: 0.5 },
    },
    psychology: {
      aggressiveness: 0.25,
      patience: 0.9,
      lossTolerance: 0.25,
      drawdownResponse: { deRiskAtDdPct: 6, riskCutFactor: 0.5, haltNewAtDdPct: 10 },
      winStreak: { streakLen: 5, riskBoostFactor: 1, maxBoost: 1 },
      lossStreak: { streakLen: 2, riskCutFactor: 0.5, coolOffDays: 3 },
      confidenceScaling: { byWinRate: 0.2, byCalibration: 0.3 },
    },
    marketMemory: {
      styleTag: "defensive",
      sensitivity: { toOwnStyleSuccess: 0.3, toFalseBreakoutRate: 0.5, toTrendPersistence: 0.4, toRegimeSetupSuccess: 0.6 },
      minSampleSize: 10,
    },
    rotation: { enabled: false, threshold: 0.6, aggressiveness: 0.05, maxRotationsPerDay: 0, reduceVsExitBias: 0.6, requireCleanRegime: true },
    confidence: { weights: { gate2: 0.3, rs: 0.2, volume: 0.05, regime: 0.35, dual: 0.1 }, floor: 0.35, ceil: 0.85 },
  },
};

/** Frozen registry of the 9 fund-manager DNA configs, keyed by existing slug. */
export const AGENT_DNA: Readonly<Record<ManagerSlug, FundManagerDna>> = deepFreeze(CONFIGS);

/** Lookup by any slug string; returns undefined for non-manager slugs (e.g. cio). */
export function getManagerDna(slug: string): FundManagerDna | undefined {
  return (AGENT_DNA as Record<string, FundManagerDna>)[slug];
}

export function hasManagerDna(slug: string): boolean {
  return getManagerDna(slug) !== undefined;
}

export { MANAGER_SLUGS };
export type { ManagerSlug };
