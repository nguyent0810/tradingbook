import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import type { DecisionExplanation } from "@/lib/paper-lab/ui/arena-copy";
import type { DailyTradingDecisionLevel } from "@/lib/scanner/trading-decision";

export type MarketPulseDto = {
  vnindexClose: number | null;
  vnindexChangePct: number | null;
  liquidityLabel: string;
  volatilityLabel: string;
  breadthLabel: string;
};

export type RecentBattleSummaryDto = {
  id: string;
  sessionDate: string;
  symbol: string;
  status: string;
  agentCount: number;
  consensusAction?: AgentAction;
  consensusConfidence?: number;
  voteCounts: { buy: number; hold: number; sell: number; reduce: number };
  insight: string;
};

export type ArenaOverviewDto = {
  totalAgents: number;
  totalVirtualCapitalVnd: number;
  /**
   * Phiên của hàng `agentPerformanceDaily` mới nhất (ISO `YYYY-MM-DD`) — tức
   * phiên mà MỌI chỉ số bảng xếp hạng bên dưới được đo. `null` = chưa có phiên
   * nào được chốt.
   *
   * Bắt buộc lộ ra: nếu phiên này cũ hơn phiên thị trường gần nhất thì bảng xếp
   * hạng là dữ liệu cũ, và bàn giao §6 yêu cầu nói rõ đang xem phiên nào.
   */
  performanceSessionDate: string | null;
  /** `returnPct: null` = chưa có tác tử nào được đo, KHÔNG phải "hoà vốn". */
  bestAgent: { id: string; name: string; returnPct: number | null };
  worstAgent: { id: string; name: string; returnPct: number | null };
  totalOpenPositions: number;
  marketRegime: {
    level: "PASS" | "WARNING" | "FAIL";
    label: string;
    dimensions?: Record<string, string>;
    labels?: string[];
    confidence?: number;
  };
  tradingDecision: {
    level: DailyTradingDecisionLevel;
    allocation: string;
    explanation: string;
    scanSessionDate: string | null;
    /** Today's scan funnel: how the universe narrowed down to zero (or more) valid setups. */
    funnel: { universe: number; tradable: number; setups: number };
  };
  marketPulse: MarketPulseDto;
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

/**
 * Một hàng bảng xếp hạng.
 *
 * Mọi chỉ số đo được đều `| null`: một tác tử đã có thứ hạng nhưng CHƯA có hàng
 * `agentPerformanceDaily` là chuyện bình thường (mới tạo, chưa chốt phiên nào).
 * Trước đây các trường này rơi về `0` — và `navVnd` rơi về nguyên vốn ban đầu
 * 500 triệu — nên bảng hiện một tác tử "có 500 triệu, thắng 0%, sụt 0%" y như số
 * đo thật. `null` để tầng trình bày in "—" đúng như quy ước gap của bản thiết kế.
 */
export type LeaderboardRowDto = {
  agentId: string;
  agentName: string;
  style: string;
  navVnd: number | null;
  pnlPct: number | null;
  realizedPnlVnd: number | null;
  unrealizedPnlVnd: number | null;
  winRate: number | null;
  maxDrawdownPct: number | null;
  sharpeLike: number | null;
  tradeCount: number | null;
  openPositions: number | null;
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
  pnlPct: number;
  winRate: number;
  maxDrawdownPct: number;
  navSparkline: number[];
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
  explanation: DecisionExplanation;
  jsonPayload: Record<string, unknown> | null;
  validationStatus: "VALID" | "INVALID" | "SKIPPED";
  linkedOrderId: string | null;
  linkedPositionId: string | null;
};

export type BattleReplayRowDto = {
  agentId: string;
  agentName: string;
  style: string;
  action: AgentAction;
  confidence: number;
  reasoning: string;
  explanation: DecisionExplanation;
  outcome: "WIN" | "LOSS" | "OPEN" | "N/A";
};

export type CioRecommendationDto = {
  symbol: string;
  finalAction: AgentAction;
  confidence: number;
  reasoning: string;
  risks: string[];
  consensusScore: number;
  consensusLabel: "Yếu" | "Trung bình" | "Mạnh";
  consensusScoreDisplay: string;
  regimeContext: string;
  decisionSummary: string;
  supportingReasons: string[];
  actionVotes: { buy: number; hold: number; sell: number; reduce: number; exit: number };
  dissentingAgents: Array<{ agentId: string; agentName: string; action: AgentAction; reason: string; humanReason: string }>;
};

export type CioPanelDto = {
  sessionDate: string;
  recommendations: CioRecommendationDto[];
};

export type PaperLabPageDto = {
  overview: ArenaOverviewDto;
  leaderboard: LeaderboardRowDto[];
  portfolios: PortfolioCardDto[];
  positions: OpenPositionRowDto[];
  decisions: DecisionLogRowDto[];
  cio: CioPanelDto;
  recentBattles: RecentBattleSummaryDto[];
  battleReplay: {
    sessionDate: string;
    symbol: string;
    insight: string;
    rows: BattleReplayRowDto[];
  };
};
