/**
 * Phase 2 — Deterministic Fund Manager evaluator.
 *
 * Pure function of (enriched bundle, DNA, manager state). Emits an
 * AgentDecisionOutput. Phase 2 generates only BUY and HOLD; PASS/SKIP is
 * represented as HOLD with SKIP reason codes (backward compatible). Position
 * management (ADD/REDUCE/TRAIL/rotation/lifecycle), market memory, allocation,
 * and attribution are deferred to later phases.
 *
 * No LLM, no randomness, no wall-clock: decision_id and inputSnapshotHash are
 * derived deterministically via sha256 of the inputs.
 */
import { createHash } from "node:crypto";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { REASON_CODES } from "@/lib/paper-lab/contracts/reason-codes";
import type { FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";
import type { ManagerStateSnapshot } from "@/lib/paper-lab/dna/manager-state";
import { computeConfidenceBasis } from "@/lib/paper-lab/dna/confidence";
import { computePsychologyModulation } from "@/lib/paper-lab/dna/psychology";
import { computeManagerPositionSize, type SizingBasis } from "@/lib/paper-lab/dna/sizing";
import {
  computeMemoryModulation,
  NEUTRAL_MODULATION,
  type MarketMemory,
} from "@/lib/paper-lab/dna/market-memory";
import { isProductionPilotAcceptable } from "@/lib/scanner/early-entry/calibration";

export const ENGINE_VERSION = "arena-evaluator@1.0.0";
export const RULE_VERSION = "rules@1.0.0";

const R = REASON_CODES;

const TREND_RANK: Record<string, number> = {
  StrongBull: 4,
  WeakBull: 3,
  Sideways: 2,
  WeakBear: 1,
  StrongBear: 0,
};

const ENTRY_CODES: Record<string, string[]> = {
  breakout_hunter: [R.BRK_A_VOL_CONFIRM, R.BRK_RS_POS],
  pullback_operator: [R.PB_ZONE_ENTRY, R.PB_DUAL_UPTREND],
  rs_rotator: [R.RS_LEADER_ENTRY, R.RS_ABOVE_MA50],
  trend_rider: [R.TR_BULL_ENTRY, R.TR_DUAL_UPTREND],
  swing_tactician: [R.SW_AB_ENTRY],
  mean_reversion_dip: [R.MR_OVERSOLD_MA20, R.MR_NEAR_20D_LOW],
  early_bird: [R.EB_EARLY_READY, R.EB_RS_POS],
  all_weather_allocator: [R.AW_A_RISKON],
  risk_warden: [R.RW_SELECTIVE_ENTRY],
};

export interface EvaluateManagerParams {
  bundle: MarketContextBundle;
  dna: FundManagerDna;
  state: ManagerStateSnapshot;
  /** Session date as YYYY-MM-DD. */
  sessionDate: string;
  /** Market memory row (dated <= S-1). Absent → neutral (no modulation). */
  memory?: MarketMemory;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic RFC-shaped UUID (v5-style) from a stable key. */
export function deterministicUuid(key: string): string {
  const h = sha256Hex(key).slice(0, 32);
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function rs(bundle: MarketContextBundle, lookback: number): number | null {
  return bundle.relativeStrength?.returns.find((r) => r.lookbackSessions === lookback)?.rsSpreadPct ?? null;
}

function regimeBlocksNew(bundle: MarketContextBundle, dna: FundManagerDna): boolean {
  const g = bundle.marketRegime.gate1Level;
  if (!dna.strategy.entry.allowedGate1.includes(g)) return true;
  if (g === "WARNING" && dna.portfolio.riskOnRiskOff.haltNewInWarning) return true;
  if (g === "FAIL" && dna.portfolio.riskOnRiskOff.haltNewInFail) return true;
  const tr = bundle.marketRegime.regimeDimensions?.trendRegime;
  if (tr && dna.identity.avoidedRegimes.includes(tr)) return true;
  return false;
}

function setupPasses(bundle: MarketContextBundle, dna: FundManagerDna): boolean {
  const e = dna.strategy.entry;
  if (e.minGate2Quality) {
    const q = bundle.gate2Setup?.quality;
    if (e.minGate2Quality === "A" && q !== "A") return false;
    if (e.minGate2Quality === "B" && !(q === "A" || q === "B")) return false;
  }
  if (e.customTrigger === "pullback_zone") {
    const s = bundle.gate2Setup;
    const c = bundle.price.closeKVnd;
    if (!s || !(c >= s.pullbackZoneLow && c <= s.pullbackZoneHigh)) return false;
  }
  if (e.customTrigger === "oversold_ma20") {
    const ma20 = bundle.technicals.ma20;
    if (ma20 == null || !(bundle.price.closeKVnd <= ma20 * 0.95)) return false;
  }
  if (e.customTrigger === "early_entry_ready") {
    if (!bundle.earlyEntry || !isProductionPilotAcceptable(bundle.earlyEntry)) return false;
  }
  if (e.requireDualUptrend && bundle.relativeStrength?.dualUptrendMa50 !== true) return false;
  if (e.requireStockAboveMa50 && bundle.relativeStrength?.stockAboveMa50 !== true) return false;
  if (e.minRs20 != null) {
    const v = rs(bundle, 20);
    if (v == null || v < e.minRs20) return false;
  }
  if (e.minRs50 != null) {
    const v = rs(bundle, 50);
    if (v == null || v < e.minRs50) return false;
  }
  if (e.minVolRatio != null) {
    const vr = bundle.volume.volRatioMa20;
    if (vr == null || vr < e.minVolRatio) return false;
  }
  return true;
}

function confirmationCount(bundle: MarketContextBundle, dna: FundManagerDna): number {
  const c = dna.strategy.confirmation;
  let n = 0;
  if (c.requireVolumeExpansion) {
    const vr = bundle.volume.volRatioMa20;
    if (vr != null && vr >= (dna.strategy.entry.minVolRatio ?? 1.2)) n += 1;
  }
  if (c.requireCloseAboveTrigger) {
    const s = bundle.gate2Setup;
    if (s && bundle.price.closeKVnd >= s.breakoutLevel) n += 1;
  }
  if (c.requireRegimeAlignment) {
    const tr = bundle.marketRegime.regimeDimensions?.trendRegime;
    const aligned = tr ? dna.identity.preferredRegimes.includes(tr) : bundle.marketRegime.gate1Level === "PASS";
    if (aligned) n += 1;
  }
  return n;
}

function tradeLevels(
  bundle: MarketContextBundle,
  dna: FundManagerDna
): { entry: number; stop: number; tp: number } | null {
  const entry = bundle.price.closeKVnd;
  if (!(entry > 0)) return null;

  const sm = dna.position.stop;
  let stop: number | null = null;
  switch (sm.model) {
    case "gate2_stop":
      stop = bundle.gate2Setup?.stopLevel ?? null;
      break;
    case "pct_below_entry":
      stop = entry * (1 - (sm.pctBelowEntry ?? 0.06));
      break;
    case "atr_mult": {
      const atr = bundle.technicals.atr14KVnd;
      stop = atr != null ? entry - (sm.atrMult ?? 2) * atr : null;
      break;
    }
    case "early_entry":
      stop = bundle.earlyEntry?.invalidLevel ?? bundle.earlyEntry?.metrics.stopLevel ?? null;
      break;
  }
  if (stop == null || !(stop > 0) || !(stop < entry)) return null;

  const perR = entry - stop;
  const tm = dna.position.target;
  let tp: number;
  switch (tm.model) {
    case "r_multiple":
      tp = entry + (tm.rMultiple ?? 2) * perR;
      break;
    case "ma20_touch": {
      const ma20 = bundle.technicals.ma20;
      tp = ma20 != null && ma20 > entry ? ma20 : entry + 1.5 * perR;
      break;
    }
    case "gate2_breakout_ext": {
      const b = bundle.gate2Setup?.breakoutLevel;
      tp = b != null ? b * 1.08 : entry + 2 * perR;
      break;
    }
    case "none":
    default:
      tp = entry + 4 * perR;
      break;
  }
  if (!(tp > entry)) return null;
  return { entry, stop, tp };
}

export function evaluateManager(params: EvaluateManagerParams): AgentDecisionOutput {
  const { bundle, dna, state, sessionDate, memory } = params;
  const confidenceBasis = computeConfidenceBasis(bundle, dna.confidence);
  // Market-memory modulation (neutral when absent or sample too small).
  const memMod = memory ? computeMemoryModulation(memory, dna.marketMemory) : NEUTRAL_MODULATION;
  const modConfidence = Math.max(
    dna.confidence.floor,
    Math.min(dna.confidence.ceil, confidenceBasis.confidence + memMod.confidenceAdj)
  );
  const inputSnapshotHash = sha256Hex(
    JSON.stringify({ bundle, state, dna: dna.versioning.dnaVersion, memory: memory?.asOfSession ?? null })
  );
  const decisionId = deterministicUuid(`${dna.slug}|${sessionDate}|${bundle.symbol}`);

  const build = (
    action: AgentDecisionOutput["action"],
    reasonCodes: string[],
    fields: Partial<AgentDecisionOutput>,
    sizingBasis: SizingBasis | null
  ): AgentDecisionOutput => {
    const reasoning =
      `${dna.identity.name} · ${action} ${bundle.symbol} · ${reasonCodes.join(", ") || "no qualifying setup"}`.padEnd(20, ".");
    const metadata = {
      prompt_version: `${dna.slug}_dna@1.0.0`,
      model: "dna-engine",
      dnaVersion: dna.versioning.dnaVersion,
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
      firedRuleCodes: reasonCodes,
      sizingBasis,
      confidenceBasis,
      psychologyState: state,
      memoryModulation: memMod,
      inputSnapshotHash,
    } as unknown as AgentDecisionOutput["metadata"];

    return {
      agent_id: dna.slug,
      agent_version: dna.versioning.dnaVersion,
      decision_id: decisionId,
      date: sessionDate,
      symbol: bundle.symbol,
      action,
      entry_price: null,
      stop_loss: null,
      take_profit: null,
      position_size_vnd: null,
      quantity: null,
      risk_amount_vnd: null,
      risk_reward_ratio: null,
      confidence: modConfidence,
      time_horizon: dna.timeHorizon,
      reasoning,
      invalidation_conditions: null,
      supporting_signals: action === "BUY" ? reasonCodes : [],
      opposing_signals: action === "HOLD" ? reasonCodes : [],
      reason_codes: reasonCodes,
      market_regime_assumption: bundle.marketRegime.gate1Level,
      metadata,
      ...fields,
    };
  };

  const hold = (codes: string[]) => build("HOLD", codes, {}, null);

  // Phase 4 — existing position management (inspected before any new BUY).
  const pos = bundle.existingPosition;
  if (pos) {
    const close = bundle.price.closeKVnd;
    const entry = pos.entryPriceKVnd;
    const perShareR =
      pos.initialRiskPerShareKvnd && pos.initialRiskPerShareKvnd > 0
        ? pos.initialRiskPerShareKvnd
        : Math.max(entry - pos.stopLossKVnd, 0);
    const gainR = perShareR > 0 ? (close - entry) / perShareR : 0;
    const trend = bundle.marketRegime.regimeDimensions?.trendRegime;
    const ex = dna.position.exit;

    // EXIT priority: regime → setup invalidation → time stop → dead-money.
    if (ex.regimeExitAtOrBelow && trend && TREND_RANK[trend]! <= TREND_RANK[ex.regimeExitAtOrBelow]!) {
      return build("EXIT", [R.EXIT_REGIME], {}, null);
    }
    if (ex.setupInvalidation && close < pos.stopLossKVnd) {
      return build("EXIT", [R.EXIT_SETUP_INVALIDATION], {}, null);
    }
    if (pos.holdingDays >= dna.position.timeStop.maxHoldingDays) {
      return build("EXIT", [R.EXIT_TIME_STOP], {}, null);
    }
    const dm = dna.position.deadMoney;
    if (dm.days != null && pos.holdingDays >= dm.days && gainR < (dm.minR ?? 0)) {
      return build("EXIT", [R.EXIT_DEAD_MONEY], {}, null);
    }

    // REDUCE — partial profit at target R (once).
    const rd = dna.position.reduce;
    if (rd.enabled && rd.partialAtR != null && gainR >= rd.partialAtR && (pos.partialsCount ?? 0) < 1) {
      const sellLot = Math.floor((pos.quantity * rd.reduceFraction) / 100) * 100;
      if (sellLot >= 100 && sellLot < pos.quantity) {
        return build("REDUCE", [R.REDUCE_PARTIAL_PROFIT], { quantity: sellLot }, null);
      }
    }

    // ADD — pyramid on a winner if DNA allows and the regime still qualifies.
    const ad = dna.position.add;
    if (ad.enabled && ad.triggerAtR != null && gainR >= ad.triggerAtR && (pos.addsCount ?? 0) < ad.maxAdds && !regimeBlocksNew(bundle, dna)) {
      const psychMod = computePsychologyModulation(state, dna.psychology).mod * memMod.riskMult;
      const addStop = pos.stopLossKVnd;
      const sizing = computeManagerPositionSize({
        navVnd: bundle.portfolioState.navVnd,
        cashVnd: bundle.portfolioState.cashVnd,
        entryKVnd: close,
        stopKVnd: addStop,
        dna,
        psychMod,
        riskPctOfNavOverride: ad.addRiskPctOfNav,
      });
      if (sizing && close > addStop) {
        const rr = (pos.takeProfitKVnd - close) / (close - addStop);
        return build(
          "ADD",
          [R.ADD_PYRAMID],
          {
            entry_price: close,
            stop_loss: addStop,
            take_profit: pos.takeProfitKVnd,
            position_size_vnd: sizing.positionSizeVnd,
            quantity: sizing.quantity,
            risk_amount_vnd: sizing.riskAmountVnd,
            risk_reward_ratio: rr > 0 ? rr : null,
          },
          sizing
        );
      }
    }

    return build("HOLD", [R.HOLD_MANAGED], {}, null);
  }

  // Regime gate.
  if (regimeBlocksNew(bundle, dna)) return hold([R.SKIP_REGIME_HALT]);

  // Drawdown circuit breaker.
  if (state.currentDdPct >= dna.psychology.drawdownResponse.haltNewAtDdPct) {
    return hold([R.SKIP_DRAWDOWN_HALT]);
  }

  // Capacity.
  if (bundle.portfolioState.openPositionCount >= dna.portfolio.maxConcurrentPositions) {
    return hold([R.SKIP_NO_CAPACITY]);
  }

  // Setup + confirmation gates (memory can tighten confirmation strictness).
  if (!setupPasses(bundle, dna)) return hold([R.SKIP_UNCONFIRMED]);
  if (confirmationCount(bundle, dna) < dna.strategy.confirmation.minConfirmations + memMod.confirmationDelta) {
    return hold([R.SKIP_UNCONFIRMED]);
  }

  // Trade geometry.
  const levels = tradeLevels(bundle, dna);
  if (!levels) return hold([R.SKIP_UNCONFIRMED]);

  // Sizing (risk-based, psychology- and market-memory-modulated).
  const psychMod = computePsychologyModulation(state, dna.psychology).mod * memMod.riskMult;
  const sizing = computeManagerPositionSize({
    navVnd: bundle.portfolioState.navVnd,
    cashVnd: bundle.portfolioState.cashVnd,
    entryKVnd: levels.entry,
    stopKVnd: levels.stop,
    dna,
    psychMod,
  });
  if (!sizing) return hold([R.SKIP_NO_CAPACITY]);

  const buyCodes = ENTRY_CODES[dna.archetype] ?? [];
  const rr = (levels.tp - levels.entry) / (levels.entry - levels.stop);

  return build(
    "BUY",
    buyCodes,
    {
      entry_price: levels.entry,
      stop_loss: levels.stop,
      take_profit: levels.tp,
      position_size_vnd: sizing.positionSizeVnd,
      quantity: sizing.quantity,
      risk_amount_vnd: sizing.riskAmountVnd,
      risk_reward_ratio: rr > 0 ? rr : null,
      invalidation_conditions: [`Daily close below ${levels.stop.toFixed(1)} kVND`, "Setup invalidation"],
    },
    sizing
  );
}
