export type StatusTone = "danger" | "warning" | "success" | "neutral" | "info";

export type RadarNodeClassification = "actionable" | "watch" | "avoid";

export type CommandBarStat = {
  label: string;
  value: string;
  subValue?: string;
  tone?: StatusTone;
};

export type CommandBarData = {
  session: string;
  vnindex: string;
  freshness: string;
  regime: string;
  regimeNote?: string;
  breadth?: string | null;
  volatility: string;
  watchState: string;
  stats: CommandBarStat[];
};

export type DecisionCoreData = {
  stance: string;
  stanceTone: StatusTone;
  confidenceLabel: string;
  primaryReason: string;
  mainRisk: string;
  mainRiskPercent: number;
  capital: string;
  capitalPercent: number;
  nextAction: string;
};

export type RadarNode = {
  symbol: string;
  readiness: number;
  risk: number;
  classification: RadarNodeClassification;
  tier: string;
  reason: string;
  sparkline: number[];
};

export type RelativeStrengthRow = {
  symbol: string;
  rs20: number;
  rs50: number | null;
  rsStrength: string;
  setupState: string;
  reason: string;
  /** @deprecated Use setupState */
  status: "watch" | "blocked" | "aligned";
  rsStrengthScore: number | null;
  setupReadinessScore: number | null;
  terminalCode: string | null;
  sectorLabel: string;
  actionLabel: string;
  /** Display-only early-entry lane when EARLY_ENTRY_V1_ENABLED */
  earlyEntry?: import("@/lib/dashboard/dashboard-v3-view-model").V3EarlyEntryDisplay | null;
};

export type EvidenceItem = {
  label: string;
  value: string;
  tone: StatusTone;
};

export type SetupIntelligenceRow = {
  symbol: string;
  trigger: string;
  risk: string;
  action: string;
  sparkline: number[];
};

export type TradeGateRow = {
  id: string;
  rule: string;
  statusLabel: string;
  severity: string;
  action: string;
  tone: StatusTone;
};

export type CommandDeckData = {
  commandBar: CommandBarData;
  decision: DecisionCoreData;
  radar: RadarNode[];
  relativeStrength: RelativeStrengthRow[];
  setupIntelligence: SetupIntelligenceRow[];
  evidence: EvidenceItem[];
  rsContextNote: string;
  setupEmptyMessage: string;
  setupSubtitle: string;
};

/** @deprecated Use CommandDeckData */
export type CommandDeckMockData = CommandDeckData;
