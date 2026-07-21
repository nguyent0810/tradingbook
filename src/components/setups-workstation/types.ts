import type { ReactNode } from "react";
import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate2ClosestSymbolRow } from "@/lib/scanner/gate2-scan-diagnostics";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  SetupsCandidateBundle,
  SetupsPositionSizingDefaults,
} from "@/components/setups/setups-candidates-master-detail";

export type PipelineStageTone = "neutral" | "success" | "warning" | "danger";

export type PipelineStage = {
  id: string;
  label: string;
  value: string | number;
  hint: string;
  tone: PipelineStageTone;
  active: boolean;
};

export type PipelineMetricsProps = {
  latestScan: LatestScanWithCandidates | null;
  nearMissCount: number;
  gate1Label?: string;
};

export type CandidateScannerProps = {
  candidates: SetupsCandidateBundle[];
  emptyReason?: string;
  scanMeta?: { gate1: string; tradabilityCount: number; scanId: string };
  partialBanner?: ReactNode;
  positionSizingDefaults?: SetupsPositionSizingDefaults;
};

export type IntelligenceSidebarProps = {
  tradingDecision: DailyTradingDecision | null;
  latestScan: LatestScanWithCandidates;
  nearMissCount: number;
  rejectionBuckets: Array<[string, number]>;
  scanNotes: DailyScanGate2Notes | null;
};

export type NearMissWatchlistGridProps = {
  closestRows: Gate2ClosestSymbolRow[];
  rsBySymbol: Map<string, RsDiagnosticUi | null> | Record<string, RsDiagnosticUi | null>;
  rsPanel: RsNearMissWatchlistPanelDto | null;
};

export type TerminalFilterLogProps = {
  breakdown: Record<string, number>;
  defaultOpen?: boolean;
};

export type WorkstationShellProps = {
  header: ReactNode;
  pipeline?: ReactNode;
  overview?: ReactNode;
  main: ReactNode;
  aside: ReactNode;
  tail?: ReactNode;
  momentum?: ReactNode;
};
