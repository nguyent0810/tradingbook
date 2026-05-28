export type DecisionMode = "TRADE" | "WAIT" | "PROTECT CAPITAL" | "WATCHLIST ONLY";

export type MarketPulse = {
  session: string;
  freshness: string;
  vnindex: string;
  vnindexDelta: number;
  regime: string;
  breadth: number;
  volatility: string;
  watchState: string;
};

export type DecisionData = {
  mode: DecisionMode;
  confidence: number;
  primaryReason: string;
  highestQualitySetup: string;
  mainRisk: string;
  nextAction: string;
  riskPosture: string;
  capitalProtection: string;
};

export type RadarItem = {
  symbol: string;
  tier: "A+" | "A" | "B" | "WATCH" | "REJECT";
  readiness: number;
  risk: number;
  signal: number;
  status: "qualified" | "near-miss" | "rejected";
  reason: string;
};

export type SetupCardData = {
  symbol: string;
  tier: "A+" | "A" | "B" | "WATCH";
  setupType: string;
  entry: string;
  stop: string;
  riskToReward: string;
  confidence: number;
  health: "Healthy" | "Warning" | "Blocked";
  blocker: string;
  actionState: string;
};

export type RiskConsoleData = {
  currentExposure: number;
  maxRisk: number;
  openPositions: number;
  lossLimit: string;
  posture: string;
  blockers: string[];
  capitalProtectionState: string;
};

export type LedgerPulseData = {
  wins: number;
  losses: number;
  openTrades: number;
  pnlPulse: string;
  reviewQueue: number;
  disciplineScore: number;
};

export type EvidenceItem = {
  label: string;
  value: string;
  state: "ok" | "warn" | "danger";
};

export type V3PreviewData = {
  marketPulse: MarketPulse;
  decision: DecisionData;
  radarItems: RadarItem[];
  setupCards: SetupCardData[];
  risk: RiskConsoleData;
  ledger: LedgerPulseData;
  evidence: EvidenceItem[];
  pulseSeries: number[];
};
