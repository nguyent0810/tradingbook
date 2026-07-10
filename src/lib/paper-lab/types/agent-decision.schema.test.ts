import { describe, expect, it } from "vitest";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";

/**
 * Phase 0 backward-compatibility: `reason_codes` was added to the decision
 * output schema. Historical payloads persisted before it existed must still
 * parse as VALID (defaulting to an empty array), and new payloads carrying
 * reason codes must round-trip.
 */
const baseValidDecision = {
  agent_id: "swing_trader",
  agent_version: "1.0.0",
  decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  date: "2026-06-26",
  symbol: "FPT",
  action: "BUY" as const,
  entry_price: 98.5,
  stop_loss: 92,
  take_profit: 112,
  position_size_vnd: 49_250_000,
  quantity: 500,
  risk_amount_vnd: 3_250_000,
  risk_reward_ratio: 2,
  confidence: 0.7,
  time_horizon: "SWING_20D" as const,
  reasoning: "Valid decision used for schema backward-compatibility checks.",
  invalidation_conditions: ["stop hit"],
  supporting_signals: [],
  opposing_signals: [],
  market_regime_assumption: "PASS" as const,
  metadata: { prompt_version: "test" },
};

describe("AgentDecisionOutput reason_codes backward compatibility", () => {
  it("parses a legacy payload without reason_codes as VALID (field absent)", () => {
    const parsed = AgentDecisionOutputSchema.safeParse(baseValidDecision);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Optional: absent in legacy payloads; consumers coalesce to [].
      expect(parsed.data.reason_codes).toBeUndefined();
      expect(parsed.data.reason_codes ?? []).toEqual([]);
    }
  });

  it("parses and preserves a new payload that includes reason_codes", () => {
    const parsed = AgentDecisionOutputSchema.safeParse({
      ...baseValidDecision,
      reason_codes: ["BRK_A_VOL_CONFIRM", "BRK_RS_POS"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason_codes).toEqual(["BRK_A_VOL_CONFIRM", "BRK_RS_POS"]);
    }
  });

  it("keeps the field validated as a string array", () => {
    const parsed = AgentDecisionOutputSchema.safeParse({
      ...baseValidDecision,
      reason_codes: [123],
    });
    expect(parsed.success).toBe(false);
  });
});
