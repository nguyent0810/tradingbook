import type { ConfidenceBand, DataProvenance } from "./decision-cockpit-dto";

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
  /** When scan Gate 1 differs from live regime — show mismatch note in header. */
  gate1Mismatch: boolean;
  gate1MismatchNote: string | null;
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
  /** Where nextAction copy originated — drives watch-only labeling. */
  nextActionProvenance: DataProvenance;
  riskPosture: string;
  capitalProtection: string | null;
};

export type V3SetupCard = {
  symbol: string;
  tier: string;
  setupType: string;
  setupTypeProvenance: DataProvenance;
  entry: string;
  stop: string;
  riskToReward: string | null;
  confidenceLabel: string;
  health: "Healthy" | "Warning" | "Blocked";
  blocker: string | null;
  actionState: string;
};

export type V3TradeGateStatus = "blocked" | "waiting" | "setup_needed" | "ready";

export type V3TradeGateRow = {
  id: string;
  rule: string;
  status: V3TradeGateStatus;
  statusLabel: string;
  severity: "High" | "Med" | "Low";
  action: string;
  provenance: DataProvenance;
};

export type V3TradeGate = {
  subtitle: string;
  rows: V3TradeGateRow[];
  budgetStatus: "configured" | "unavailable" | "partial";
  budgetProvenance: DataProvenance;
};

export type V3RiskConsole = {
  exposurePercent: number | null;
  maxRiskPercent: number | null;
  openPositions: number;
  lossLimit: string | null;
  posture: string;
  capitalProtectionState: string;
  utilizationPercent: number | null;
  utilizationTone: "normal" | "elevated" | "critical";
  tradeGate: V3TradeGate;
};

export type V3SetupIntelligence = {
  emptyMessage: string;
  populatedSubtitle: string;
};

export type V3HeaderCta = {
  lead: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string | null;
  secondaryLabel: string | null;
  /** Demoted link on NO TRADE when open positions exist; null when hidden. */
  tertiaryHref: string | null;
  tertiaryLabel: string | null;
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
  provenance?: DataProvenance;
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

export type V3RsConfidence = "high" | "medium" | "low";

export type V3RsWatchlistCard = {
  symbol: string;
  rs20SpreadPct: number;
  rs50SpreadPct: number | null;
  stateBadge: string;
  stateTone: V3RsStateTone;
  /** Reason-first setup state (e.g. "Watch: breakout", "Blocked: zone"). */
  setupState: string;
  /** Terminal-specific reason shown in table. */
  setupReason: string;
  strengthLabel: string | null;
  primaryInsight: string;
  metrics: V3RsWatchlistMetric[];
  blockerLabel: string;
  nextCondition: string;
  technicalEvidence: string[];
  /** Populated when RS_SCORING_V1_ENABLED. */
  rsStrengthScore: number | null;
  setupReadinessScore: number | null;
  rsConfidence: V3RsConfidence | null;
  /** Terminal code for filter matching (display-only). */
  terminalCode: string | null;
  /** Display-only when EARLY_ENTRY_V1_ENABLED — separate early-entry lane. */
  earlyEntry: V3EarlyEntryDisplay | null;
};

export type V3EarlyEntryDisplay = {
  earlyReversalScore: number;
  proposedTradeState: string;
  entryType: string | null;
  reasonCodes: string[];
  transitionReasonCodes: string[];
  invalidLevel: number | null;
  invalidLevelReason: string | null;
  stopDistancePct: number | null;
  targetPrice: number | null;
  targetReason: string | null;
  estimatedRewardPct: number | null;
  estimatedRiskReward: number | null;
  suggestedPilotSizePct: number | null;
  sizingNote: string | null;
  whyNotPilotYet: string | null;
  rrRejectionReason: string | null;
  distFromMa20Pct: number | null;
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
  headerCta: V3HeaderCta;
  signalTrajectory: V3SignalTrajectory;
  radar: {
    mapDots: V3RadarMapDot[];
    qualified: V3RadarBandEntry[];
    nearMiss: V3RadarBandEntry[];
    rejected: V3RadarBandEntry[];
    avoidPlaceholders: V3RadarAvoidPlaceholder[];
    /** Tooltip sparklines are synthetic — not price series. */
    sparklineProvenance: DataProvenance;
  };
  setupCards: V3SetupCard[];
  setupIntelligence: V3SetupIntelligence;
  risk: V3RiskConsole;
  ledger: V3LedgerPulse;
  evidence: V3EvidenceItem[];
  /** Default expanded when true (NO TRADE / warn states). */
  evidenceDefaultOpen: boolean;
  /** Batch D2.3 — RS leaders that failed setup filters; V3 intelligence cards. */
  rsWatchlist: V3RsWatchlistPanel;
  partialError: string | null;
};
