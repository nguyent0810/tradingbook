import { randomUUID } from "node:crypto";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import type { PaperAgentSlug } from "@/lib/paper-lab/constants";

export interface PaperAgentRunner {
  id: PaperAgentSlug;
  version: string;
  run(input: {
    bundles: MarketContextBundle[];
    sessionDate: string;
  }): Promise<AgentDecisionOutput[]>;
}

function baseDecision(
  agentId: PaperAgentSlug,
  bundle: MarketContextBundle,
  sessionDate: string,
  action: AgentDecisionOutput["action"],
  overrides: Partial<AgentDecisionOutput> = {}
): AgentDecisionOutput {
  const setup = bundle.gate2Setup;
  const entry = setup?.close ?? bundle.price.closeKVnd;
  const stop = setup?.stopLevel ?? entry * 0.94;
  const tp = setup?.breakoutLevel ? setup.breakoutLevel * 1.08 : entry * 1.12;
  const qty = action === "BUY" || action === "ADD" ? Math.max(100, Math.floor(50_000_000 / (entry * 1000))) : null;

  return {
    agent_id: agentId,
    agent_version: "1.0.0",
    decision_id: randomUUID(),
    date: sessionDate,
    symbol: bundle.symbol,
    action,
    entry_price: action === "BUY" || action === "ADD" ? entry : null,
    stop_loss: action === "BUY" || action === "ADD" ? stop : null,
    take_profit: action === "BUY" || action === "ADD" ? tp : null,
    position_size_vnd: qty != null ? Math.round(qty * entry * 1000) : null,
    quantity: qty,
    risk_amount_vnd:
      qty != null ? Math.round((entry - stop) * 1000 * qty) : null,
    risk_reward_ratio: entry > stop ? (tp - entry) / (entry - stop) : null,
    confidence: 0.65,
    time_horizon: "SWING_20D",
    reasoning: `${agentId} rule evaluation on ${bundle.symbol}: regime ${bundle.marketRegime.gate1Level}, gate2 ${setup?.quality ?? "none"}.`,
    invalidation_conditions:
      action === "BUY" || action === "ADD"
        ? [`Daily close below ${stop.toFixed(1)} k VND`, "Gate1 FAIL"]
        : null,
    supporting_signals: setup?.quality === "A" ? ["gate2_quality_A"] : [],
    opposing_signals: bundle.marketRegime.gate1Level === "WARNING" ? ["weak_regime"] : [],
    market_regime_assumption: bundle.marketRegime.gate1Level,
    metadata: { prompt_version: `${agentId}_v1`, model: "mock-rule-agent" },
    ...overrides,
  };
}

function createRuleAgent(
  id: PaperAgentSlug,
  decide: (bundle: MarketContextBundle) => AgentDecisionOutput["action"] | null
): PaperAgentRunner {
  return {
    id,
    version: "1.0.0",
    async run({ bundles, sessionDate }) {
      const out: AgentDecisionOutput[] = [];
      for (const bundle of bundles) {
        const action = decide(bundle);
        if (!action) continue;
        out.push(baseDecision(id, bundle, sessionDate, action));
      }
      return out;
    },
  };
}

export const MOCK_AGENTS: PaperAgentRunner[] = [
  createRuleAgent("safe_investor", (b) =>
    b.gate2Setup?.quality === "A" && b.marketRegime.gate1Level === "PASS" ? "BUY" : "HOLD"
  ),
  createRuleAgent("aggressive_investor", (b) =>
    b.gate2Setup?.quality && b.marketRegime.gate1Level !== "FAIL" ? "BUY" : "HOLD"
  ),
  createRuleAgent("trend_follower", (b) =>
    b.relativeStrength?.dualUptrendMa50 && b.marketRegime.gate1Level === "PASS" ? "BUY" : "HOLD"
  ),
  createRuleAgent("momentum_investor", (b) => {
    const rs = b.relativeStrength?.returns.find((r) => r.lookbackSessions === 20);
    return rs && rs.rsSpreadPct > 2 ? "BUY" : "HOLD";
  }),
  createRuleAgent("value_investor", (b) =>
    b.gate2Setup?.quality === "B" && b.marketRegime.gate1Level !== "FAIL" ? "BUY" : "HOLD"
  ),
  createRuleAgent("swing_trader", (b) =>
    b.gate2Setup?.quality === "A" || b.gate2Setup?.quality === "B" ? "BUY" : "HOLD"
  ),
  createRuleAgent("mean_reversion_trader", (b) =>
    b.marketRegime.gate1Level === "WARNING" ? "HOLD" : null
  ),
  createRuleAgent("risk_manager", (b) =>
    b.portfolioState.exposurePct > 65 ? "REDUCE" : "HOLD"
  ),
  createRuleAgent("devils_advocate", (b) =>
    b.gate2Setup?.quality === "A" ? "HOLD" : null
  ),
];

export function getMockAgent(slug: string): PaperAgentRunner | undefined {
  return MOCK_AGENTS.find((a) => a.id === slug);
}
