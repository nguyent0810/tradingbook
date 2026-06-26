import type { AgentAction, AgentDecisionOutput, CioRecommendation } from "@/lib/paper-lab/types/agent-decision.schema";
import { PAPER_AGENT_SEEDS } from "@/lib/paper-lab/constants";
import { consensusLabel, consensusScoreDisplay } from "./arena-format";

export type DecisionExplanation = {
  summary: string;
  supporting: string[];
  opposing: string[];
  styleLens: string;
  auditReasoning?: string;
};

export type CioPresentation = {
  decisionSummary: string;
  supportingReasons: string[];
  consensusLabel: "Weak" | "Medium" | "Strong";
  consensusScoreDisplay: string;
  regimeContext: string;
  actionVotes: { buy: number; hold: number; sell: number; reduce: number; exit: number };
  dissent: Array<{ agentName: string; action: AgentAction; humanReason: string }>;
};

const SIGNAL_LABELS: Record<string, string> = {
  gate2_quality_A: "Setup quality rated A (strong breakout-pullback pattern)",
  gate2_quality_B: "Setup quality rated B (acceptable pattern)",
  weak_regime: "Broader market regime is still weak (Gate 1 WARNING)",
  llm_unavailable: "LLM unavailable — rule fallback applied",
};

const STYLE_LENSES: Record<string, string> = {
  Defensive: "Requires strong market confirmation before committing capital.",
  Offensive: "Accepts weaker regime when setup quality is acceptable.",
  Trend: "Needs aligned intermediate and slow trend before entry.",
  Momentum: "Needs volume expansion and relative strength leadership.",
  Value: "Looks for attractive price relative to setup quality tier.",
  Swing: "Focuses on risk/reward of breakout-pullback setups.",
  MeanRev: "Prefers mean-reversion conditions over trend continuation.",
  Risk: "Prioritizes portfolio exposure limits and downside protection.",
  Contrarian: "Challenges consensus and flags asymmetric downside risk.",
};

function agentDisplayName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug.replace(/_/g, " ");
}

function agentStyle(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.style ?? "General";
}

export function humanizeSignal(code: string): string {
  return SIGNAL_LABELS[code] ?? code.replace(/_/g, " ");
}

export function getStyleLens(agentId: string): string {
  return STYLE_LENSES[agentStyle(agentId)] ?? "Evaluates setup against agent-specific rules.";
}

function buildAgentActionSummary(
  agentId: string,
  action: AgentAction,
  symbol: string,
  regime: string,
  setupQuality: string | null
): string {
  const style = agentStyle(agentId);
  const q = setupQuality ?? "none";

  if (action === "BUY" || action === "ADD") {
    switch (style) {
      case "Offensive":
        return `Setup on ${symbol} is valid; this agent accepts weaker regime conditions when quality is ${q}.`;
      case "Swing":
        return `Pullback setup on ${symbol} passed minimum risk/reward rules — agent opened a long position.`;
      case "Trend":
        return `Trend alignment supports a long entry on ${symbol} under current regime (${regime}).`;
      case "Momentum":
        return `Relative strength and momentum criteria support buying ${symbol}.`;
      case "Defensive":
        return `Strong setup and favorable regime — defensive agent approved a measured entry on ${symbol}.`;
      case "Value":
        return `Price and setup tier on ${symbol} meet value-entry criteria.`;
      default:
        return `Agent sees enough confirmation to ${action === "ADD" ? "add to" : "open"} ${symbol}.`;
    }
  }

  if (action === "REDUCE" || action === "EXIT" || action === "SELL") {
    return `Agent recommends reducing exposure on ${symbol} due to risk or exit rules.`;
  }

  switch (style) {
    case "Momentum":
      return `Volume expansion is insufficient for a momentum entry on ${symbol}.`;
    case "Value":
      return `Price is not attractive enough relative to intrinsic criteria for ${symbol}.`;
    case "Risk":
      return `Regime is ${regime} and portfolio risk limits favor waiting on ${symbol}.`;
    case "Contrarian":
      return `Setup may work, but downside asymmetry on ${symbol} is still concerning.`;
    case "Defensive":
      return `Trend confirmation is still weak — agent prefers to wait on ${symbol}.`;
    case "Offensive":
      return `Despite offensive posture, current signals on ${symbol} do not justify entry yet.`;
    case "Trend":
      return `Intermediate trend has not confirmed — waiting on ${symbol}.`;
    case "Swing":
      return `Pullback zone or R:R threshold not met for ${symbol} today.`;
    case "MeanRev":
      return `Mean-reversion conditions not present — no action on ${symbol}.`;
    default:
      return `Not enough confirmation to trade ${symbol} under current conditions.`;
  }
}

export function buildDecisionExplanation(input: {
  agentId: string;
  action: AgentAction;
  symbol: string;
  reasoningSummary?: string | null;
  payload?: Partial<AgentDecisionOutput> | null;
}): DecisionExplanation {
  const payload = input.payload;
  const regime = payload?.market_regime_assumption ?? "UNKNOWN";
  const setupQuality =
    payload?.supporting_signals?.includes("gate2_quality_A")
      ? "A"
      : payload?.supporting_signals?.includes("gate2_quality_B")
        ? "B"
        : null;

  const supporting = (payload?.supporting_signals ?? []).map(humanizeSignal);
  const opposing = (payload?.opposing_signals ?? []).map(humanizeSignal);

  if (supporting.length === 0 && setupQuality) {
    supporting.push(humanizeSignal(`gate2_quality_${setupQuality}`));
  }
  if (opposing.length === 0 && regime === "WARNING") {
    opposing.push(humanizeSignal("weak_regime"));
  }

  const summary = buildAgentActionSummary(
    input.agentId,
    input.action,
    input.symbol,
    regime,
    setupQuality
  );

  return {
    summary,
    supporting: supporting.slice(0, 3),
    opposing: opposing.slice(0, 3),
    styleLens: getStyleLens(input.agentId),
    auditReasoning: input.reasoningSummary ?? payload?.reasoning ?? undefined,
  };
}

/** Build human-readable reasoning string for agent persistence. */
export function buildAgentReasoningSummary(input: {
  agentId: string;
  action: AgentAction;
  symbol: string;
  payload: Pick<AgentDecisionOutput, "supporting_signals" | "opposing_signals" | "market_regime_assumption">;
}): string {
  return buildDecisionExplanation({
    agentId: input.agentId,
    action: input.action,
    symbol: input.symbol,
    payload: input.payload,
  }).summary;
}

export function buildCioPresentation(
  rec: CioRecommendation & { regime_context?: string },
  panelDecisions?: Array<{ action: AgentAction; agent_id?: string }>
): CioPresentation {
  const votes = { buy: 0, hold: 0, sell: 0, reduce: 0, exit: 0 };
  if (panelDecisions) {
    for (const d of panelDecisions) {
      const key = d.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
  } else {
    for (const s of rec.supporting_agents) {
      const key = s.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
    for (const d of rec.dissenting_agents) {
      const key = d.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
  }

  const label = consensusLabel(rec.consensus_score);
  const scoreDisplay = consensusScoreDisplay(rec.consensus_score);

  const supportingReasons: string[] = [];
  if (rec.final_action === "HOLD") {
    supportingReasons.push("Most agents do not see enough confirmation for a high-conviction trade.");
    supportingReasons.push("Broader market regime reduces collective confidence.");
  } else if (rec.final_action === "BUY" || rec.final_action === "ADD") {
    supportingReasons.push("Weighted agent consensus favors taking exposure.");
    if (rec.supporting_agents.length > 0) {
      supportingReasons.push(
        `${rec.supporting_agents.length} agent(s) support directional entry with positive weight.`
      );
    }
  } else {
    supportingReasons.push("Consensus favors reducing or exiting exposure.");
  }

  const regimeContext =
    (rec as { regime_context?: string }).regime_context ??
    rec.metadata?.regime ??
    "Unknown regime";

  let decisionSummary = rec.reasoning;
  if (rec.reasoning.includes("weighted consensus")) {
    decisionSummary =
      rec.final_action === "HOLD"
        ? "CIO recommends waiting — agent consensus is mixed and conviction is limited."
        : rec.final_action === "BUY"
          ? "CIO sees enough weighted support to favor entry, with caveats."
          : "CIO recommends defensive action based on weighted agent scores.";
  }

  const dissent = rec.dissenting_agents.map((d) => ({
    agentName: agentDisplayName(d.agent_id),
    action: d.action,
    humanReason: buildDissentReason(d.agent_id, d.action, d.reason),
  }));

  return {
    decisionSummary,
    supportingReasons,
    consensusLabel: label,
    consensusScoreDisplay: scoreDisplay,
    regimeContext,
    actionVotes: votes,
    dissent,
  };
}

function buildDissentReason(agentId: string, action: AgentAction, rawReason: string): string {
  if (rawReason.includes("rule evaluation")) {
    const style = agentStyle(agentId);
    if (action === "BUY" || action === "ADD") {
      if (style === "Offensive") {
        return "Prefers BUY because it accepts weaker regime when setup quality is acceptable.";
      }
      if (style === "Swing") {
        return "Prefers BUY because pullback setup meets minimum risk/reward rules.";
      }
      return "Sees valid setup and favors entry despite CIO caution.";
    }
    if (style === "Contrarian") {
      return "Flags downside asymmetry even when setup looks valid.";
    }
    return "Prefers to wait until market confirmation improves.";
  }
  return rawReason;
}

export const POSITION_GLOSSARY: Record<string, string> = {
  Entry: "Average entry price per share (thousand VND).",
  Stop: "Stop-loss level — exit if price closes below this level.",
  TP: "Take-profit target price for the position.",
  "Qty (Lot)": "Share quantity in board lots of 100 shares (VN market rule).",
  "Alloc %": "Position size as a percentage of agent portfolio NAV.",
  Risk: "Maximum capital at risk if stop-loss is hit.",
  UPNL: "Unrealized profit/loss in VND at latest mark.",
  "UPNL %": "Unrealized return on position cost.",
  R: "Current profit/loss expressed in units of initial risk (R-multiple).",
  Days: "Calendar days since position was opened.",
  Status: "OPEN = fully filled; PARTIAL = partially filled.",
};

export const CONSENSUS_TOOLTIP =
  "Weighted consensus combines each agent's action, confidence, and trust weight into a single score from -100 to +100. Scores near zero indicate mixed conviction.";

export function buildBattleInsight(
  rows: Array<{ action: AgentAction }>,
  symbol: string
): string {
  const buy = rows.filter((r) => r.action === "BUY" || r.action === "ADD").length;
  const hold = rows.filter((r) => r.action === "HOLD").length;
  const sell = rows.filter(
    (r) => r.action === "SELL" || r.action === "EXIT" || r.action === "REDUCE"
  ).length;

  if (buy > 0 && hold > buy) {
    return `Most agents stayed out of ${symbol} despite a valid setup — regime and style filters split the panel (${buy} BUY, ${hold} HOLD).`;
  }
  if (buy === 0 && hold > 0) {
    return `No agents committed to ${symbol}; the panel prefers to wait for stronger confirmation.`;
  }
  if (buy > hold) {
    return `Majority of agents favor entry on ${symbol} (${buy} BUY vs ${hold} HOLD).`;
  }
  return `Mixed panel on ${symbol}: ${buy} BUY, ${hold} HOLD, ${sell} reduce/exit.`;
}

const DIMENSION_LABELS: Record<string, string> = {
  WeakBull: "Weak bull trend",
  StrongBull: "Strong bull trend",
  Bear: "Bear trend",
  Sideways: "Sideways trend",
  Contracting: "Contracting volatility",
  Expanding: "Expanding volatility",
  Rotation: "Sector rotation",
  Broad: "Broad participation",
  Narrow: "Narrow leadership",
  HighLiquidity: "High liquidity",
  LowLiquidity: "Low liquidity",
};

export function formatRegimeDimension(value: string): string {
  return DIMENSION_LABELS[value] ?? value.replace(/([A-Z])/g, " $1").trim();
}

export function buildRegimeExplanation(input: {
  level: "PASS" | "WARNING" | "FAIL";
  label: string;
  confidence?: number;
  dimensions?: Record<string, string>;
}): string {
  const conf = input.confidence != null ? `${Math.round(input.confidence)}% model confidence` : "confidence pending";
  const trend = input.dimensions?.trendRegime
    ? formatRegimeDimension(input.dimensions.trendRegime)
    : "mixed trend";
  const vol = input.dimensions?.volatilityRegime
    ? formatRegimeDimension(input.dimensions.volatilityRegime)
    : "neutral volatility";
  const breadth = input.dimensions?.breadthRegime
    ? formatRegimeDimension(input.dimensions.breadthRegime)
    : "mixed breadth";

  const gate =
    input.level === "PASS"
      ? "Gate 1 market scan is supportive for selective risk-taking."
      : input.level === "WARNING"
        ? "Gate 1 is in WARNING — agents apply stricter filters before committing capital."
        : "Gate 1 is FAIL — most agents defer new entries until conditions improve.";

  return `${input.label} (${conf}). ${trend}, ${vol}, and ${breadth} shape today's panel. ${gate}`;
}
