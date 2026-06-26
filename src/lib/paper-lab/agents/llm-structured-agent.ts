import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import type { PaperAgentRunner } from "@/lib/paper-lab/agents/mock-rule-agents";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";
import { isPaperLabLlmEnabled } from "@/lib/paper-lab/llm-config";
import { randomUUID } from "node:crypto";

/**
 * Optional LLM agent — only active when PAPER_LAB_LLM_ENABLED=true and a provider key is set.
 * Otherwise returns deterministic HOLD decisions with no external API calls.
 */
export function createLlmStructuredAgent(params: {
  agentId: string;
  promptVersion: string;
  systemPrompt: string;
}): PaperAgentRunner {
  return {
    id: params.agentId as PaperAgentRunner["id"],
    version: "1.0.0-llm",
    async run({ bundles, sessionDate }) {
      if (!isPaperLabLlmEnabled()) {
        return bundles.map((b) => fallbackHold(params, b, sessionDate));
      }

      const apiKey =
        process.env.ZENMUX_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        return bundles.map((b) => fallbackHold(params, b, sessionDate));
      }

      const out: AgentDecisionOutput[] = [];
      for (const bundle of bundles.slice(0, 5)) {
        try {
          const decision = await callOpenAiStructured(apiKey, params.systemPrompt, bundle, sessionDate, params);
          const parsed = AgentDecisionOutputSchema.safeParse(decision);
          if (parsed.success) out.push(parsed.data);
        } catch {
          out.push(fallbackHold(params, bundle, sessionDate));
        }
      }
      return out;
    },
  };
}

function fallbackHold(
  params: { agentId: string; promptVersion: string },
  bundle: MarketContextBundle,
  sessionDate: string
): AgentDecisionOutput {
  return {
    agent_id: params.agentId,
    agent_version: "1.0.0-llm-fallback",
    decision_id: randomUUID(),
    date: sessionDate,
    symbol: bundle.symbol,
    action: "HOLD",
    entry_price: null,
    stop_loss: null,
    take_profit: null,
    position_size_vnd: null,
    quantity: null,
    risk_amount_vnd: null,
    risk_reward_ratio: null,
    confidence: 0.5,
    time_horizon: "SWING_20D",
    reasoning: `LLM unavailable — default HOLD for ${bundle.symbol} pending structured inference.`,
    invalidation_conditions: null,
    supporting_signals: [],
    opposing_signals: ["llm_unavailable"],
    market_regime_assumption: bundle.marketRegime.gate1Level,
    metadata: { prompt_version: params.promptVersion, model: "fallback" },
  };
}

async function callOpenAiStructured(
  apiKey: string,
  systemPrompt: string,
  bundle: MarketContextBundle,
  sessionDate: string,
  params: { agentId: string; promptVersion: string }
): Promise<AgentDecisionOutput> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({ sessionDate, bundle }),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  const raw = JSON.parse(content) as AgentDecisionOutput;
  return {
    ...raw,
    agent_id: params.agentId,
    decision_id: raw.decision_id ?? randomUUID(),
    date: sessionDate,
    metadata: {
      ...raw.metadata,
      prompt_version: params.promptVersion,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
  };
}
