import type { ReactNode } from "react";

export type TradeDirection = "LONG" | "SHORT";
export type TradeExecutionStatus = "PLANNED" | "OPEN" | "CLOSED" | "CANCELLED";

export type LatestCloseBarDto = {
  close: number;
  date: Date;
};

export type UnrealizedPnlDto = {
  pnlAmount: number | null;
  pnlPct: number | null;
};

export type TradeLedgerRowDerived = {
  latestBar: LatestCloseBarDto | null;
  unrealized: UnrealizedPnlDto | null;
  priceUnitMismatch: boolean;
  holdingDays: number | null;
  rMultiple: number | null;
  distanceToStop: number | null;
  distanceToTakeProfit: number | null;
};

export type ReviewDtoSurface =
  | "stop_violated"
  | "structure_weakening"
  | "under_pressure"
  | "stale_bar_review"
  | "review_needed"
  | "review_completed";

export type ReviewDtoClient = {
  surface: ReviewDtoSurface;
  stopBand: "breached" | "tight" | "comfortable" | "unknown";
  stopBandLabel: string;
  cushionPctDisplay: string | null;
  headline: string;
  primaryReviewLabel: string | null;
  plannedCapitalAtRisk: number | null;
  setupValidityLine: string | null;
  latestChecklist: {
    stopReviewed: boolean;
    structureReviewed: boolean;
    sizingReviewed: boolean;
    exitPlanReviewed: boolean;
  } | null;
};

export type TradeLedgerRow = {
  id: string;
  symbol: string;
  status: TradeExecutionStatus;
  direction: TradeDirection;
  playbook: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  entryDate: Date;
  exitDate: Date | null;
  realizedPnl: number | null;
  setupCandidate: {
    setupType: string;
    quality: string;
  } | null;
};

export type TradeLedgerDivider = { kind: "divider"; label: string };

export type TradeLedgerTableItem = TradeLedgerRow | TradeLedgerDivider;

export type TradeLedgerOpenRowPack = {
  derived: TradeLedgerRowDerived;
  reviewDto: ReviewDtoClient;
  priorityTier: string;
  memoryLines: string[];
  escalationCues: string[];
  postureExplainLines: string[];
  positionEvolution: string;
  positionEvolutionLine: string | null;
};

export type TradesTableProps = {
  ledgerTableItems: TradeLedgerTableItem[];
  openRowPackByTradeId: Map<string, TradeLedgerOpenRowPack>;
  latestCloseBySymbol: Map<string, LatestCloseBarDto>;
  expectedSessionDate: Date | null;
  checkedTodayTradeIds: Set<string>;
  now: Date;
  compactReview: boolean;
  reviewSessionActive: boolean;
  sessionFocusId: string | null;
  reviewSessionQueueLength: number;
};

export type ExpandableTradeHUDProps = {
  trade: TradeLedgerRow;
  openPack: TradeLedgerOpenRowPack;
  latestBar: LatestCloseBarDto | null;
  formatBarSessionDate: (d: Date) => string;
};

export type ReviewStatusDotsProps = {
  tradeId: string;
  priorityTier: string;
  reviewDto: ReviewDtoClient;
  reviewedToday: boolean;
  escalationCues: readonly string[];
  evolutionStateLabel?: string;
  evolutionExplainLine?: string | null;
  compact: boolean;
  sessionMode?: boolean;
  sessionFocused?: boolean;
};

export type FlashTextProps = {
  value: string | number;
  className?: string;
  children?: ReactNode;
};

export type PositionalTimelineProps = {
  direction: TradeDirection;
  entryPrice: number;
  markPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type FilterToolbarProps = {
  currentSearch: string;
  currentStatus: string;
  currentSort: string;
  currentCompactReview: boolean;
  currentReviewSession: boolean;
};

export type CheckpointCompletion = {
  reviewedCount: number;
  openCount: number;
};
