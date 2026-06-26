import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";

export type ArenaOverviewDto = {
  totalAgents: number;
  totalVirtualCapitalVnd: number;
  bestAgent: { id: string; name: string; returnPct: number };
  worstAgent: { id: string; name: string; returnPct: number };
  totalOpenPositions: number;
  marketRegime: {
    level: "PASS" | "WARNING" | "FAIL";
    label: string;
    dimensions?: Record<string, string>;
    labels?: string[];
    confidence?: number;
  };
  executionMode?: {
    agentType: "rule" | "llm";
    llmEnabled: boolean;
    label: string;
    provider: "openai" | "zenmux" | null;
  };
  latestEvaluationAt: string | null;
  disclaimer: "PAPER_TRADING_ONLY";
  stale?: boolean;
};

export type LeaderboardRowDto = {
  agentId: string;
  agentName: string;
  style: string;
  navVnd: number;
  pnlPct: number;
  realizedPnlVnd: number;
  unrealizedPnlVnd: number;
  winRate: number;
  maxDrawdownPct: number;
  sharpeLike: number;
  tradeCount: number;
  openPositions: number;
  rank: number;
  rankChange: number;
};

export type PortfolioCardDto = {
  agentId: string;
  agentName: string;
  style: string;
  startingCapitalVnd: number;
  cashVnd: number;
  investedVnd: number;
  navVnd: number;
  exposurePct: number;
  sectorExposure: Record<string, number>;
  openRiskVnd: number;
  buyingPowerVnd: number;
};

export type OpenPositionRowDto = {
  id: string;
  agentId: string;
  agentName: string;
  symbol: string;
  entryPriceKVnd: number;
  currentPriceKVnd: number;
  stopLossKVnd: number;
  takeProfitKVnd: number;
  quantity: number;
  allocationPct: number;
  riskAmountVnd: number;
  unrealizedPnlVnd: number;
  unrealizedPnlPct: number;
  rMultiple: number;
  holdingDays: number;
  status: "OPEN" | "PARTIAL";
};

export type DecisionLogRowDto = {
  id: string;
  date: string;
  agentId: string;
  agentName: string;
  symbol: string;
  action: AgentAction;
  confidence: number;
  reasoningSummary: string;
  jsonPreview: string;
  validationStatus: "VALID" | "INVALID" | "SKIPPED";
  linkedOrderId: string | null;
  linkedPositionId: string | null;
};

export type BattleReplayRowDto = {
  agentId: string;
  agentName: string;
  action: AgentAction;
  confidence: number;
  reasoning: string;
  outcome: "WIN" | "LOSS" | "OPEN" | "N/A";
};

export type CioPanelDto = {
  sessionDate: string;
  recommendations: Array<{
    symbol: string;
    finalAction: AgentAction;
    confidence: number;
    reasoning: string;
    risks: string[];
    dissentingAgents: Array<{ agentId: string; reason: string }>;
  }>;
};

export type PaperLabPageDto = {
  overview: ArenaOverviewDto;
  leaderboard: LeaderboardRowDto[];
  portfolios: PortfolioCardDto[];
  positions: OpenPositionRowDto[];
  decisions: DecisionLogRowDto[];
  cio: CioPanelDto;
  battleReplay: {
    sessionDate: string;
    symbol: string;
    rows: BattleReplayRowDto[];
  };
};
