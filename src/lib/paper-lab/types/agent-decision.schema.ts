import { z } from "zod";

export const AgentActionSchema = z.enum([
  "BUY",
  "SELL",
  "HOLD",
  "EXIT",
  "REDUCE",
  "ADD",
]);

export const AgentDecisionOutputSchema = z
  .object({
    agent_id: z.string(),
    agent_version: z.string(),
    decision_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    symbol: z.string().min(1),

    action: AgentActionSchema,

    entry_price: z.number().positive().nullable(),
    stop_loss: z.number().positive().nullable(),
    take_profit: z.number().positive().nullable(),

    position_size_vnd: z.number().nonnegative().nullable(),
    quantity: z.number().int().positive().nullable(),

    risk_amount_vnd: z.number().nonnegative().nullable(),
    risk_reward_ratio: z.number().positive().nullable(),

    confidence: z.number().min(0).max(1),
    time_horizon: z.enum(["INTRADAY", "SWING_5D", "SWING_20D", "POSITION_60D"]),

    reasoning: z.string().min(20).max(4000),

    invalidation_conditions: z.array(z.string()).nullable(),

    supporting_signals: z.array(z.string()),
    opposing_signals: z.array(z.string()),

    market_regime_assumption: z.enum(["PASS", "WARNING", "FAIL", "UNKNOWN"]),

    metadata: z.object({
      model: z.string().optional(),
      prompt_version: z.string(),
      latency_ms: z.number().optional(),
      token_usage: z.number().optional(),
    }),
  })
  .superRefine((val, ctx) => {
    if (["BUY", "ADD"].includes(val.action)) {
      if (val.entry_price == null) {
        ctx.addIssue({ code: "custom", message: "entry_price required for BUY/ADD" });
      }
      if (val.stop_loss == null) {
        ctx.addIssue({ code: "custom", message: "stop_loss required for BUY/ADD" });
      }
      if (val.take_profit == null) {
        ctx.addIssue({ code: "custom", message: "take_profit required for BUY/ADD" });
      }
      if (val.quantity == null && val.position_size_vnd == null) {
        ctx.addIssue({
          code: "custom",
          message: "quantity or position_size_vnd required for BUY/ADD",
        });
      }
    }
  });

export type AgentDecisionOutput = z.infer<typeof AgentDecisionOutputSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const CioRecommendationSchema = z.object({
  recommendation_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  symbol: z.string(),
  final_action: AgentActionSchema,
  confidence: z.number().min(0).max(1),
  consensus_score: z.number(),
  entry_price: z.number().positive().nullable(),
  stop_loss: z.number().positive().nullable(),
  take_profit: z.number().positive().nullable(),
  suggested_position_size_vnd: z.number().nonnegative().nullable(),
  reasoning: z.string(),
  supporting_agents: z.array(
    z.object({
      agent_id: z.string(),
      action: AgentActionSchema,
      weight: z.number(),
      confidence: z.number(),
    })
  ),
  dissenting_agents: z.array(
    z.object({
      agent_id: z.string(),
      action: AgentActionSchema,
      reason: z.string(),
    })
  ),
  risks: z.array(z.string()),
  agent_weights_used: z.record(z.string(), z.number()),
  metadata: z.object({
    cio_version: z.string(),
    regime: z.enum(["PASS", "WARNING", "FAIL", "UNKNOWN"]),
  }),
});

export type CioRecommendation = z.infer<typeof CioRecommendationSchema>;
