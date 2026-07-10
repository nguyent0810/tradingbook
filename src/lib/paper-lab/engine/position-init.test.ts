import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { executeValidatedDecision } from "@/lib/paper-lab/engine/paper-trading-engine";

/**
 * Phase 0: opening a new position must initialize the additive
 * position-management state columns. Trailing/add/partial EXECUTION is NOT
 * implemented yet — this only checks the seed values written on open.
 *
 * Driven with a minimal fake Prisma that captures the `paperPosition.create`
 * payload; no database is required.
 */

const decision: AgentDecisionOutput = {
  agent_id: "swing_trader",
  agent_version: "1.0.0",
  decision_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  date: "2026-07-08",
  symbol: "FPT",
  action: "BUY",
  entry_price: 18.2,
  stop_loss: 17.0,
  take_profit: 20.0,
  position_size_vnd: 18_200_000,
  quantity: 1000,
  risk_amount_vnd: 1_200_000,
  risk_reward_ratio: 1.5,
  confidence: 0.7,
  time_horizon: "SWING_20D",
  reasoning: "Open position initialization test for Phase 0 position state.",
  invalidation_conditions: ["stop hit"],
  supporting_signals: [],
  opposing_signals: [],
  reason_codes: [],
  market_regime_assumption: "PASS",
  metadata: { prompt_version: "test" },
};

function buildFakePrisma(capture: { data: Record<string, unknown> | null }): PrismaClient {
  return {
    paperOrder: {
      findFirst: async () => null,
      create: async () => ({ id: "order-1" }),
    },
    paperPortfolio: {
      findUniqueOrThrow: async () => ({ id: "pf-1", cashVnd: 500_000_000n }),
      update: async () => ({}),
    },
    paperPosition: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        capture.data = args.data;
        return { id: "pos-1" };
      },
    },
    agentDecision: {
      update: async () => ({}),
    },
  } as unknown as PrismaClient;
}

describe("openOrAddPosition — Phase 0 position state initialization", () => {
  it("initializes trailing/add/partial/MFE/MAE state on a new BUY", async () => {
    const capture: { data: Record<string, unknown> | null } = { data: null };
    const prisma = buildFakePrisma(capture);

    const result = await executeValidatedDecision(prisma, {
      portfolioId: "pf-1",
      agentDbId: "agent-1",
      decisionDbId: "dec-1",
      decision,
      sessionDate: new Date(Date.UTC(2026, 6, 8)),
      bar: { low: 17.5, high: 18.5, close: 18.2 },
      validationCtx: {
        navVnd: 500_000_000,
        cashVnd: 500_000_000,
        currentExposureVnd: 0,
        openPositionCount: 0,
        newPositionsToday: 0,
        hasOpenPositionOnSymbol: false,
        tradable: true,
        prevCloseKVnd: 18.0,
        sessionCloseKVnd: 18.2,
      },
    });

    expect(result.rejected).toBe(false);
    expect(result.positionId).toBe("pos-1");

    const data = capture.data;
    expect(data).not.toBeNull();
    // Phase 0.5: lifecycle contract initialized to OPEN (never transitioned).
    expect(data!.lifecycle).toBe("OPEN");
    // Fill resolves to the order price (18.2) since it sits inside the bar range.
    expect(data!.highWaterMarkKvnd).toBe(18.2);
    expect(data!.trailingStopKvnd).toBe(17.0);
    expect(data!.initialRiskPerShareKvnd).toBeCloseTo(1.2);
    expect(data!.addsCount).toBe(0);
    expect(data!.partialsCount).toBe(0);
    expect(data!.maxFavorableExcursionKvnd).toBe(0);
    expect(data!.maxAdverseExcursionKvnd).toBe(0);
  });
});
