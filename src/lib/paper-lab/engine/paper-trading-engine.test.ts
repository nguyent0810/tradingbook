import { describe, expect, it } from "vitest";
import {
  detectLongExitOnBar,
  validateAgentDecisionForExecution,
} from "@/lib/paper-lab/engine/order-validator";
import { applyBoardLotToBuyDecision } from "@/lib/paper-lab/engine/board-lot";
import { computeRMultipleLong, isWithinLimitBand } from "@/lib/paper-lab/engine/units";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";

describe("paper-lab order validator", () => {
  it("rejects BUY without stop", () => {
    const decision = {
      agent_id: "swing_trader",
      agent_version: "1.0.0",
      decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      date: "2026-06-26",
      symbol: "FPT",
      action: "BUY" as const,
      entry_price: 98.5,
      stop_loss: null,
      take_profit: 112,
      position_size_vnd: 50_000_000,
      quantity: 507,
      risk_amount_vnd: 3_000_000,
      risk_reward_ratio: 2,
      confidence: 0.7,
      time_horizon: "SWING_20D" as const,
      reasoning: "Test decision with missing stop for validation check.",
      invalidation_conditions: ["stop hit"],
      supporting_signals: [],
      opposing_signals: [],
      market_regime_assumption: "PASS" as const,
      metadata: { prompt_version: "test" },
    };
    const parsed = AgentDecisionOutputSchema.safeParse(decision);
    expect(parsed.success).toBe(false);
  });

  it("validates exposure limits", () => {
    const decision = {
      agent_id: "swing_trader",
      agent_version: "1.0.0",
      decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      date: "2026-06-26",
      symbol: "FPT",
      action: "BUY" as const,
      entry_price: 98.5,
      stop_loss: 92,
      take_profit: 112,
      position_size_vnd: 400_000_000,
      quantity: 4000,
      risk_amount_vnd: 26_000_000,
      risk_reward_ratio: 2,
      confidence: 0.7,
      time_horizon: "SWING_20D" as const,
      reasoning: "Large position test for exposure limit validation rules.",
      invalidation_conditions: ["stop hit"],
      supporting_signals: [],
      opposing_signals: [],
      market_regime_assumption: "PASS" as const,
      metadata: { prompt_version: "test" },
    };
    const result = validateAgentDecisionForExecution(decision, {
      navVnd: 500_000_000,
      cashVnd: 500_000_000,
      currentExposureVnd: 0,
      openPositionCount: 0,
      newPositionsToday: 0,
      hasOpenPositionOnSymbol: false,
      tradable: true,
      prevCloseKVnd: 97,
      sessionCloseKVnd: 98.5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-board-lot quantity before execution", () => {
    const decision = {
      agent_id: "swing_trader",
      agent_version: "1.0.0",
      decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      date: "2026-06-26",
      symbol: "FPT",
      action: "BUY" as const,
      entry_price: 98.5,
      stop_loss: 92,
      take_profit: 112,
      position_size_vnd: 49_939_500,
      quantity: 507,
      risk_amount_vnd: 3_295_500,
      risk_reward_ratio: 2,
      confidence: 0.7,
      time_horizon: "SWING_20D" as const,
      reasoning: "Odd lot quantity should fail board lot validation.",
      invalidation_conditions: ["stop hit"],
      supporting_signals: [],
      opposing_signals: [],
      market_regime_assumption: "PASS" as const,
      metadata: { prompt_version: "test" },
    };
    const result = validateAgentDecisionForExecution(decision, {
      navVnd: 500_000_000,
      cashVnd: 500_000_000,
      currentExposureVnd: 0,
      openPositionCount: 0,
      newPositionsToday: 0,
      hasOpenPositionOnSymbol: false,
      tradable: true,
      prevCloseKVnd: 97,
      sessionCloseKVnd: 98.5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some((r) => r.includes("board lot"))).toBe(true);
    }
  });

  it("execution path normalizes 3906 to 3900 before validation fields", () => {
    const base = {
      agent_id: "swing_trader",
      agent_version: "1.0.0",
      decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      date: "2026-06-26",
      symbol: "CSM",
      action: "BUY" as const,
      entry_price: 18.2,
      stop_loss: 17.0,
      take_profit: 20.0,
      position_size_vnd: Math.round(3906 * 18.2 * 1000),
      quantity: 3906,
      risk_amount_vnd: Math.round((18.2 - 17.0) * 1000 * 3906),
      risk_reward_ratio: 1.5,
      confidence: 0.65,
      time_horizon: "SWING_20D" as const,
      reasoning: "Pre-round quantity should normalize at execution.",
      invalidation_conditions: ["stop hit"],
      supporting_signals: [],
      opposing_signals: [],
      market_regime_assumption: "WARNING" as const,
      metadata: { prompt_version: "test" },
    };
    const { decision } = applyBoardLotToBuyDecision(base);
    expect(decision.quantity).toBe(3900);
    expect(decision.position_size_vnd).toBe(Math.round(3900 * 18.2 * 1000));
  });
});

describe("paper-lab exit detection", () => {
  it("prioritizes stop loss over take profit on same bar", () => {
    expect(
      detectLongExitOnBar({
        stopKVnd: 90,
        takeProfitKVnd: 110,
        barLowKVnd: 89,
        barHighKVnd: 115,
      })
    ).toBe("STOP_LOSS_HIT");
  });
});

describe("paper-lab units", () => {
  it("computes R multiple for long", () => {
    expect(computeRMultipleLong(100, 106, 95)).toBeCloseTo(1.2);
  });

  it("checks VN limit band", () => {
    expect(isWithinLimitBand(107, 100, 0.07)).toBe(false);
    expect(isWithinLimitBand(106, 100, 0.07)).toBe(true);
  });
});
