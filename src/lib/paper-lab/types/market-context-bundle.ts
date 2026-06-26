import type { RelativeStrengthDiagnostic } from "@/lib/scanner/gate2/relative-strength";
import type { BreakoutPullbackEvaluation } from "@/lib/scanner/gate2/types";
import type { EarlyEntryEvaluationResult } from "@/lib/scanner/early-entry/types";
import type { TradabilityResult } from "@/lib/scanner/tradability-types";
import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import type { AgentMemoryRecall, RegimeDimensions } from "@/lib/lab/types/regime";
import { PAPER_CONTEXT_SCHEMA_VERSION } from "@/lib/paper-lab/constants";

export type MarketContextBundle = {
  schemaVersion: typeof PAPER_CONTEXT_SCHEMA_VERSION;
  generatedAt: string;
  sessionDate: string;
  symbol: string;

  symbolMeta: {
    exchange: string | null;
    name: string | null;
    sector: string | null;
    tradability: TradabilityResult;
  };

  price: {
    closeKVnd: number;
    openKVnd: number;
    highKVnd: number;
    lowKVnd: number;
    prevCloseKVnd: number | null;
    changePct: number | null;
    barsAvailable: number;
  };

  volume: {
    volume: number;
    volMa20: number | null;
    volRatioMa20: number | null;
    avgValueVnd20: number | null;
  };

  technicals: {
    ma20: number | null;
    ma50: number | null;
    atr14KVnd: number | null;
    range20dHigh: number | null;
    range20dLow: number | null;
  };

  relativeStrength: RelativeStrengthDiagnostic | null;
  earlyEntry: EarlyEntryEvaluationResult | null;
  gate2Setup: BreakoutPullbackEvaluation | null;

  marketRegime: {
    gate1Level: "PASS" | "WARNING" | "FAIL";
    reasons: string[];
    vnindexClose: number | null;
    foreignNetValue1d: number | null;
    regimeDimensions?: RegimeDimensions;
    regimeLabels?: string[];
    regimeConfidence?: number;
  };

  agentMemoryRecall?: AgentMemoryRecall | null;

  fundamentals: null | {
    pe: number | null;
    pb: number | null;
    roe: number | null;
    revenueGrowthYoY: number | null;
    source: "stub" | "future_api";
  };

  newsSentiment: null | {
    score: number;
    headlineCount7d: number;
    summary: string;
    source: "stub" | "future_api";
  };

  liquidity: {
    tradable: boolean;
    minAvgValueVnd20: number;
    actualAvgValueVnd20: number | null;
    priceFloorVnd: number;
  };

  riskContext: {
    dailyTradingDecision: DailyTradingDecision;
    maxPortfolioExposurePct: number;
    maxPerTradeExposurePct: number;
    baseRiskPerTradePct: number;
  };

  existingPosition: null | {
    positionId: string;
    quantity: number;
    entryPriceKVnd: number;
    stopLossKVnd: number;
    takeProfitKVnd: number;
    unrealizedPnlVnd: number;
    holdingDays: number;
    status: "OPEN" | "PARTIAL";
  };

  portfolioState: {
    agentId: string;
    cashVnd: number;
    navVnd: number;
    exposurePct: number;
    openPositionCount: number;
    sectorExposure: Record<string, number>;
  };
};
