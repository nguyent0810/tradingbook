import { describe, expect, it } from "vitest";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import type { EarlyEntryEvaluationResult, EarlyEntryTradeState } from "@/lib/scanner/early-entry/types";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { neutralManagerState } from "@/lib/paper-lab/dna/manager-state";
import { evaluateManager, ENGINE_VERSION } from "@/lib/paper-lab/dna/evaluate-manager";

interface Knobs {
  gate1?: "PASS" | "WARNING" | "FAIL";
  trend?: string;
  quality?: "A" | "B" | "INVALID" | null;
  rs20?: number;
  rs50?: number;
  dual?: boolean;
  aboveMa50?: boolean;
  volRatio?: number;
  ma20?: number | null;
  existing?: boolean;
  openPositions?: number;
  nav?: number;
  cash?: number;
  earlyEntry?: MarketContextBundle["earlyEntry"];
}

/** Minimal but type-complete EarlyEntryEvaluationResult stub for the "devils_advocate" gate tests. */
function makeEarlyEntry(
  proposedTradeState: EarlyEntryTradeState,
  riskRewardRatio: number
): EarlyEntryEvaluationResult {
  return {
    earlyReversalScore: 60,
    proposedTradeState,
    entryType: "Early Reclaim",
    reasonCodes: [],
    transitionReasonCodes: [],
    invalidLevel: 18,
    invalidLevelReason: "swing_low",
    stopDistancePct: 4,
    targetPrice: 24,
    targetReason: "prior_60d_high",
    estimatedRewardPct: 10,
    estimatedRiskReward: riskRewardRatio,
    suggestedPilotSizePct: 25,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: 2,
    metrics: {
      sessionDate: "2026-07-08",
      close: 20,
      ma20: 19,
      ma50: 18,
      volume: 1_500_000,
      volumeMa20: 1_000_000,
      volumeRatio: 1.5,
      rs20SpreadPct: 5,
      rs20Delta3d: 1,
      bodyPct: 0.02,
      atr14: 0.5,
      closeNearHighPct: 0.8,
      distFromMa20Pct: 2,
      distFromMa50Pct: 8,
      stopLevel: 18,
      stopDistancePct: 4,
      rewardTarget: 24,
      targetPrice: 24,
      targetReason: "prior_60d_high",
      invalidLevelReason: "swing_low",
      riskRewardRatio,
      estimatedRewardPct: 10,
      priorCompression: true,
      reclaimMa20: true,
      reclaimMa50: false,
    },
    extensionRiskScore: 10,
    riskRewardScore: 80,
  };
}

function makeBundle(k: Knobs = {}): MarketContextBundle {
  const close = 20;
  return {
    symbol: "TST",
    price: { closeKVnd: close, openKVnd: close, highKVnd: 20.5, lowKVnd: 19.5, prevCloseKVnd: 20, changePct: 0, barsAvailable: 200 },
    volume: { volume: 1_000_000, volMa20: 500_000, volRatioMa20: k.volRatio ?? 2, avgValueVnd20: 1e10 },
    technicals: { ma20: k.ma20 === undefined ? 19 : k.ma20, ma50: 18, atr14KVnd: 0.5, range20dHigh: 21, range20dLow: 18 },
    relativeStrength: {
      returns: [
        { lookbackSessions: 20, rsSpreadPct: k.rs20 ?? 5 },
        { lookbackSessions: 50, rsSpreadPct: k.rs50 ?? 6 },
      ],
      dualUptrendMa50: k.dual ?? true,
      stockAboveMa50: k.aboveMa50 ?? true,
    },
    earlyEntry: k.earlyEntry ?? null,
    gate2Setup:
      k.quality === null
        ? null
        : { quality: k.quality ?? "A", breakoutLevel: 20, pullbackZoneLow: 18.5, pullbackZoneHigh: 20.5, stopLevel: 18.5, close },
    marketRegime: {
      gate1Level: k.gate1 ?? "PASS",
      reasons: [],
      regimeDimensions: { trendRegime: k.trend ?? "StrongBull" },
      regimeConfidence: 0.8,
    },
    agentMemoryRecall: null,
    existingPosition: k.existing
      ? { positionId: "p1", quantity: 100, entryPriceKVnd: 20, stopLossKVnd: 18, takeProfitKVnd: 24, unrealizedPnlVnd: 0, holdingDays: 3, status: "OPEN" }
      : null,
    portfolioState: { agentId: "a", cashVnd: k.cash ?? 500_000_000, navVnd: k.nav ?? 500_000_000, exposurePct: 0, openPositionCount: k.openPositions ?? 0, sectorExposure: {} },
  } as unknown as MarketContextBundle;
}

const state = neutralManagerState("a", 500_000_000);
const SESSION = "2026-07-08";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function evalFor(slug: string, k: Knobs = {}) {
  const dna = getManagerDna(slug)!;
  return evaluateManager({ bundle: makeBundle(k), dna, state, sessionDate: SESSION });
}

describe("evaluateManager BUY cases (3 archetypes)", () => {
  it("Breakout Hunter buys a confirmed A breakout", () => {
    const d = evalFor("aggressive_investor");
    expect(d.action).toBe("BUY");
    expect(d.reason_codes).toContain("BRK_A_VOL_CONFIRM");
    expect(d.entry_price).toBe(20);
    expect(d.stop_loss).toBe(18.5);
    expect(d.take_profit).toBeGreaterThan(20);
    expect(d.quantity && d.quantity % 100).toBe(0);
  });

  it("RS Rotator buys a leader above MA50 with strong RS", () => {
    const d = evalFor("momentum_investor", { rs50: 8 });
    expect(d.action).toBe("BUY");
    expect(d.reason_codes).toContain("RS_LEADER_ENTRY");
  });

  it("Trend Rider buys a dual-uptrend name in a bull regime", () => {
    const d = evalFor("trend_follower");
    expect(d.action).toBe("BUY");
    expect(d.reason_codes).toContain("TR_BULL_ENTRY");
  });
});

describe("evaluateManager — devils_advocate (Early Bird) early-entry gate", () => {
  it("does not trigger when early-entry is null (flag off, or evaluator declined)", () => {
    const d = evalFor("devils_advocate", { earlyEntry: null });
    expect(d.action).toBe("HOLD");
  });

  it("triggers on PILOT_BUY with acceptable risk/reward", () => {
    const d = evalFor("devils_advocate", { earlyEntry: makeEarlyEntry("PILOT_BUY", 2.5) });
    expect(d.action).toBe("BUY");
    expect(d.stop_loss).toBe(18);
  });

  it("triggers on CONFIRMED_BUY with acceptable risk/reward (defense-in-depth scope covers both states)", () => {
    const d = evalFor("devils_advocate", { earlyEntry: makeEarlyEntry("CONFIRMED_BUY", 2.5) });
    expect(d.action).toBe("BUY");
    expect(d.stop_loss).toBe(18);
  });

  it("is blocked when risk/reward is below RR_ACCEPTABLE even with a valid trade state", () => {
    const d = evalFor("devils_advocate", { earlyEntry: makeEarlyEntry("PILOT_BUY", 1.0) });
    expect(d.action).toBe("HOLD");
  });
});

describe("evaluateManager HOLD / PASS cases", () => {
  it("holds (SKIP_REGIME_HALT) when the regime is disallowed", () => {
    const d = evalFor("aggressive_investor", { gate1: "FAIL" });
    expect(d.action).toBe("HOLD");
    expect(d.reason_codes).toContain("SKIP_REGIME_HALT");
    expect(d.quantity).toBeNull();
  });

  it("holds when a setup does not qualify", () => {
    const d = evalFor("aggressive_investor", { quality: null, volRatio: 1 });
    expect(d.action).toBe("HOLD");
    expect(d.reason_codes).toContain("SKIP_UNCONFIRMED");
  });

  it("holds an existing position with nothing to do (managed)", () => {
    const d = evalFor("aggressive_investor", { existing: true });
    expect(d.action).toBe("HOLD");
    expect(d.reason_codes).toEqual(["HOLD_MANAGED"]);
  });
});

describe("evaluateManager metadata & determinism", () => {
  it("stamps reproducibility metadata", () => {
    const d = evalFor("aggressive_investor");
    const m = d.metadata as unknown as Record<string, unknown>;
    expect(m.dnaVersion).toBe("fund-manager-dna@1.0.0");
    expect(m.engineVersion).toBe(ENGINE_VERSION);
    expect(m.ruleVersion).toBe("rules@1.0.0");
    expect(typeof m.inputSnapshotHash).toBe("string");
    expect(Array.isArray(m.firedRuleCodes)).toBe(true);
    expect(m.sizingBasis).toBeTruthy();
    expect(m.confidenceBasis).toBeTruthy();
    expect(m.psychologyState).toBeTruthy();
  });

  it("produces a deterministic, valid UUID decision_id with no randomness", () => {
    const a = evalFor("aggressive_investor");
    const b = evalFor("aggressive_investor");
    expect(a.decision_id).toMatch(UUID_RE);
    expect(a).toEqual(b); // identical output for identical input
  });

  it("does not emit the legacy constant 0.65 confidence", () => {
    const d = evalFor("aggressive_investor");
    expect(d.confidence).not.toBe(0.65);
    expect(d.confidence).toBeGreaterThan(0.65); // strong inputs → above legacy constant
  });
});
