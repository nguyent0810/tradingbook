import { describe, expect, it } from "vitest";
import {
  applyBoardLotToBuyDecision,
  roundDownToBoardLotShares,
  roundDownSellQuantity,
} from "@/lib/paper-lab/engine/board-lot";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";

function buyDecision(quantity: number): AgentDecisionOutput {
  return {
    agent_id: "swing_trader",
    agent_version: "1.0.0",
    decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    date: "2026-06-26",
    symbol: "CSM",
    action: "BUY",
    entry_price: 18.2,
    stop_loss: 17.0,
    take_profit: 20.0,
    position_size_vnd: Math.round(quantity * 18.2 * 1000),
    quantity,
    risk_amount_vnd: Math.round((18.2 - 17.0) * 1000 * quantity),
    risk_reward_ratio: 1.5,
    confidence: 0.65,
    time_horizon: "SWING_20D",
    reasoning: "Test decision for board lot normalization during execution.",
    invalidation_conditions: ["stop hit"],
    supporting_signals: ["gate2_quality_A"],
    opposing_signals: [],
    market_regime_assumption: "WARNING",
    metadata: { prompt_version: "test" },
  };
}

describe("board-lot rounding", () => {
  it("3906 → 3900", () => {
    const r = roundDownToBoardLotShares(3906);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBe(3900);
      expect(r.adjusted).toBe(true);
    }
  });

  it("99 → rejected below one lot", () => {
    const r = roundDownToBoardLotShares(99);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.quantity).toBe(0);
  });

  it("100 → valid", () => {
    const r = roundDownToBoardLotShares(100);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBe(100);
      expect(r.adjusted).toBe(false);
    }
  });

  it("199 → 100", () => {
    const r = roundDownToBoardLotShares(199);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBe(100);
      expect(r.adjusted).toBe(true);
    }
  });

  it("applyBoardLotToBuyDecision recalculates notional and risk from rounded qty", () => {
    const { decision, lot } = applyBoardLotToBuyDecision(buyDecision(3906));
    expect(lot.ok).toBe(true);
    if (!lot.ok) return;
    expect(decision.quantity).toBe(3900);
    expect(decision.position_size_vnd).toBe(Math.round(3900 * 18.2 * 1000));
    expect(decision.risk_amount_vnd).toBe(Math.round((18.2 - 17.0) * 1000 * 3900));
    expect(decision.position_size_vnd).not.toBe(Math.round(3906 * 18.2 * 1000));
  });

  it("applyBoardLotToBuyDecision rejects 99 shares", () => {
    const { lot } = applyBoardLotToBuyDecision(buyDecision(99));
    expect(lot.ok).toBe(false);
  });

  it("roundDownSellQuantity matches buy rounding", () => {
    expect(roundDownSellQuantity(507).ok).toBe(true);
    if (roundDownSellQuantity(507).ok) {
      expect(roundDownSellQuantity(507).quantity).toBe(500);
    }
  });
});
