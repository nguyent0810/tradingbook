import type { Gate1ScanLevel } from "@/generated/prisma/client";

export type TrendRegime =
  | "StrongBull"
  | "WeakBull"
  | "Sideways"
  | "WeakBear"
  | "StrongBear";

export type VolatilityRegime = "HighVol" | "LowVol" | "Expanding" | "Contracting";
export type LiquidityRegime = "HighLiquidity" | "LowLiquidity";
export type BreadthRegime = "RiskOn" | "RiskOff" | "Rotation";
export type StructureRegime = "Distribution" | "Capitulation" | "Recovery" | "Normal";
export type EventRegime = "EarningsSeason" | "Normal";

export type RegimeDimensions = {
  trendRegime: TrendRegime;
  volatilityRegime: VolatilityRegime;
  liquidityRegime: LiquidityRegime;
  breadthRegime: BreadthRegime;
  structureRegime: StructureRegime;
  eventRegime: EventRegime;
};

export type RegimeSnapshot = {
  sessionDate: string;
  gate1Level: Gate1ScanLevel | null;
  dimensions: RegimeDimensions;
  confidence: number;
  schemaVersion: string;
  labels: string[];
};

export type AgentMemoryRecall = {
  setupSignature: string;
  sampleSize: number;
  winRate: number;
  avgReturnPct: number;
  avgRMultiple: number;
  avgHoldingDays: number;
  failureRate: number;
  lastNOutcomes: Array<{
    sessionDate: string;
    symbol: string;
    action: string;
    outcome: string;
    rMultiple: number | null;
  }>;
  regimeBreakdown: Record<string, { winRate: number; avgR: number }>;
  confidenceCalibrationHint: number;
};

export type AgentDnaProfile = {
  agentId: string;
  asOfSession: string;
  loves: Array<{ signal: string; affinity: number }>;
  avoids: Array<{ signal: string; aversion: number }>;
  preferredHoldingDays: { p25: number; p50: number; p75: number };
  favoriteSectors: Array<{ sector: string; exposurePct: number; winRate: number }>;
  weaknessRegimes: Array<{ regime: string; underperformancePct: number }>;
  strengthRegimes: Array<{ regime: string; outperformancePct: number }>;
  tradeFrequency: number;
  avgConfidence: number;
  specializationScore: number;
};
