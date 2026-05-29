import type { ConfidenceBand } from "./decision-cockpit-dto";

export type V3DecisionMode = "TRADE" | "WAIT" | "PROTECT CAPITAL" | "WATCHLIST ONLY";

export type V3ConfidenceBand = ConfidenceBand;

export type V3RadarMapStatus = "qualified" | "near-miss";

/** Plotted on readiness/risk map — never used for rejected/blocked samples. */
export type V3RadarMapDot = {
  symbol: string;
  tier: string;
  readiness: number;
  risk: number;
  status: V3RadarMapStatus;
  reason: string;
};

export type V3RadarBandEntry = {
  symbol: string;
  reason: string;
};

/** Fixed-zone avoid sample — not positioned by readiness/risk data. */
export type V3RadarAvoidPlaceholder = {
  symbol: string;
  caption: string;
};

export type V3MarketPulse = {
  session: string;
  freshness: string;
  vnindex: string | null;
  regime: string;
  breadth: string | null;
  volatility: string | null;
  watchState: string;
};

export type V3DecisionHero = {
  mode: V3DecisionMode;
  /** Trader-facing stance headline (e.g. TRADE MODE vs persisted NORMAL). */
  stanceLabel: string;
  confidenceBand: V3ConfidenceBand;
  /** UX-only meter width (not a stored confidence %). */
  confidenceMeterWidth: number;
  primaryReason: string;
  highestQualitySetup: string | null;
  mainRisk: string | null;
  nextAction: string | null;
  riskPosture: string;
  capitalProtection: string | null;
};

export type V3SetupCard = {
  symbol: string;
  tier: string;
  setupType: string;
  entry: string;
  stop: string;
  riskToReward: string | null;
  confidenceLabel: string;
  health: "Healthy" | "Warning" | "Blocked";
  blocker: string | null;
  actionState: string;
};

export type V3RiskConsole = {
  exposurePercent: number | null;
  maxRiskPercent: number | null;
  openPositions: number;
  lossLimit: string | null;
  posture: string;
  blockers: string[];
  capitalProtectionState: string;
  utilizationPercent: number | null;
  utilizationTone: "normal" | "elevated" | "critical";
};

export type V3LedgerPulse = {
  outcomeChips: Array<"W" | "L">;
  openTrades: number;
  pnlPulse: string | null;
  pulseBarHeights: number[];
  reviewHref: string;
  reviewLabel: string;
};

export type V3EvidenceItem = {
  label: string;
  value: string;
  state: "ok" | "warn" | "danger";
};

export type V3SignalTrajectory = {
  points: number[];
  emptyMessage: string | null;
};

export type V3RsMetricTone = "strong" | "watch" | "blocker" | "context";

export type V3RsWatchlistMetric = {
  label: string;
  value: string;
  tone: V3RsMetricTone;
};

export type V3RsStateTone = "watch" | "not-ready" | "supportive" | "awaiting";

export type V3RsWatchlistCard = {
  symbol: string;
  stateBadge: string;
  stateTone: V3RsStateTone;
  strengthLabel: string | null;
  primaryInsight: string;
  metrics: V3RsWatchlistMetric[];
  blockerLabel: string;
  nextCondition: string;
  technicalEvidence: string[];
};

export type V3RsWatchlistPanel = {
  title: string;
  subtitle: string;
  contextNote: string;
  cards: V3RsWatchlistCard[];
  emptyReason: string | null;
};

export type DashboardV3ViewModel = {
  marketPulse: V3MarketPulse;
  decision: V3DecisionHero;
  signalTrajectory: V3SignalTrajectory;
  radar: {
    mapDots: V3RadarMapDot[];
    qualified: V3RadarBandEntry[];
    nearMiss: V3RadarBandEntry[];
    rejected: V3RadarBandEntry[];
    avoidPlaceholders: V3RadarAvoidPlaceholder[];
  };
  setupCards: V3SetupCard[];
  risk: V3RiskConsole;
  ledger: V3LedgerPulse;
  evidence: V3EvidenceItem[];
  /** Batch D2.3 — RS leaders that failed setup filters; V3 intelligence cards. */
  rsWatchlist: V3RsWatchlistPanel;
  partialError: string | null;
};
