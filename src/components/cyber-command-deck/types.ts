import type { ReactNode } from "react";
import type {
  DashboardV3ViewModel,
  V3DecisionHero,
  V3DecisionMode,
  V3EarlyEntryDisplay,
  V3EvidenceItem,
  V3LedgerPulse,
  V3MarketPulse,
  V3RadarMapDot,
  V3RiskConsole,
  V3RsWatchlistCard,
  V3RsWatchlistPanel,
  V3SetupCard,
} from "@/lib/dashboard/dashboard-v3-view-model";

export type {
  DashboardV3ViewModel,
  V3DecisionHero,
  V3DecisionMode,
  V3EvidenceItem,
  V3LedgerPulse,
  V3MarketPulse,
  V3RadarMapDot,
  V3RiskConsole,
  V3RsWatchlistCard,
  V3RsWatchlistPanel,
  V3SetupCard,
};

export type NodeClassification = "actionable" | "watch" | "avoid";

export type FlashDirection = "up" | "down" | "neutral";

export type FlashMap = Record<string, FlashDirection>;

export type PanelAnchorId = "decision" | "radar" | "risk" | "rs";

export type WireAnchor = {
  id: PanelAnchorId;
  x: number;
  y: number;
};

export type TechTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  render: (row: T, index: number) => ReactNode;
};

export type RiskTableRow = {
  id: string;
  rule: string;
  status: "pass" | "caution" | "blocked";
  statusLabel: string;
  severity: string;
  action: string;
};

export type RsTableRow = {
  id: string;
  symbol: string;
  rs20: string;
  rs50: string;
  setupState: string;
  strengthLabel: string | null;
  reason: string;
  rsStrengthScore: number | null;
  stateTone: V3RsWatchlistCard["stateTone"];
  earlyEntry: V3EarlyEntryDisplay | null;
};

export type SetupTableRow = {
  id: string;
  symbol: string;
  tier: string;
  setupType: string;
  entry: string;
  stop: string;
  actionState: string;
  health: V3SetupCard["health"];
};

export type CyberCommandDeckProps = {
  viewModel: DashboardV3ViewModel;
};
