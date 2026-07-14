import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { MarketRegimeFromDbResult } from "@/lib/playbook/get-market-regime";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import type { SetupLifecycleStatus } from "@/generated/prisma/client";
import type { SetupHealthLevelValue } from "@/lib/setup-health/types";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import { formatGate2RankSummary } from "@/lib/scanner/gate2/rank-components";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import type { PortfolioGuardrailsDto } from "./portfolio-guardrails";
import {
  type DecisionCockpitInput,
  type DecisionCockpitCandidateSnapshot,
  type DecisionCockpitOpenTradeSnapshot,
  type DecisionCockpitWatchSnapshot,
  type DecisionCockpitScanSnapshot,
} from "./decision-cockpit-dto";

export type DashboardWatchItemForCockpit = {
  symbol: { symbol: string };
  lifecycleStatus: SetupLifecycleStatus;
  healthLevel: SetupHealthLevelValue | null;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
};

export type BuildDashboardCockpitInputParams = {
  latestScan: LatestScanWithCandidates | null;
  scanNotes: DailyScanGate2Notes | null;
  regime: MarketRegimeFromDbResult;
  freshness: MarketFreshnessDto;
  candidatesWithHealth: SurfacedCandidateHealthView[];
  activeWatchItems: DashboardWatchItemForCockpit[];
  openExposureVnd: number;
  accountEquityVnd: number | null;
  portfolioRiskConfigured: boolean;
  now?: Date;
  rsDiagnosticsBySymbol?: Record<string, RsDiagnosticUi>;
  rsNearMissWatchlist?: RsNearMissWatchlistPanelDto;
  marketContext?: MarketContextUiDto | null;
  portfolioGuardrails?: PortfolioGuardrailsDto | null;
  /** Workstream B — OPEN trade rows for risk-to-stop / mark-to-market breakdowns. */
  openTrades?: DecisionCockpitOpenTradeSnapshot[];
  /** Workstream B — latest close per uppercase ticker for OPEN trade symbols. */
  latestCloseByTradeSymbol?: ReadonlyMap<string, number>;
};

function toScanSnapshot(
  latestScan: LatestScanWithCandidates | null
): DecisionCockpitScanSnapshot | null {
  if (!latestScan) return null;
  return {
    id: latestScan.id,
    runAt: latestScan.runAt,
    gate1Level: latestScan.gate1Level as Gate1Level,
    candidateCountA: latestScan.candidateCountA,
    candidateCountB: latestScan.candidateCountB,
    candidateCountSurfaced: latestScan.candidateCountSurfaced,
  };
}

function toCandidateSnapshots(
  rows: SurfacedCandidateHealthView[]
): DecisionCockpitCandidateSnapshot[] {
  return rows.map((c) => {
    const parsed = parseSetupCandidateReasons(c.reasons);
    const rankSummary =
      parsed.rankComponents != null
        ? formatGate2RankSummary(parsed.rankComponents)
        : null;
    return {
      id: c.id,
      symbolKey: c.symbolKey,
      quality: c.quality === "A" || c.quality === "B" ? c.quality : "B",
      lifecycleSortLabel: c.lifecycleSortLabel,
      healthLevel: c.healthLevel,
      healthScore: c.healthScore,
      healthScoreLabel: c.healthScoreLabel,
      healthFlags: c.healthFlags,
      healthSummary: c.healthSummary,
      reasons: parsed.lines,
      rankSummary,
      close: c.close,
      pullbackZoneLow: c.pullbackZoneLow,
      pullbackZoneHigh: c.pullbackZoneHigh,
      stopLevel: c.stopLevel,
      rankScore: c.rankScore,
    };
  });
}

function toWatchSnapshots(
  items: DashboardWatchItemForCockpit[]
): DecisionCockpitWatchSnapshot[] {
  return items.map((w) => ({
    symbol: w.symbol.symbol,
    lifecycleStatus: w.lifecycleStatus,
    healthLevel: w.healthLevel,
    pullbackZoneLow: w.pullbackZoneLow,
    pullbackZoneHigh: w.pullbackZoneHigh,
  }));
}

/**
 * Maps data already loaded by `dashboard/page.tsx` into `DecisionCockpitInput`.
 * S1: call from page in parallel; do not change visible UI until S2.
 */
export function buildDashboardCockpitInput(
  params: BuildDashboardCockpitInputParams
): DecisionCockpitInput {
  const latestScan = toScanSnapshot(params.latestScan);

  return {
    latestScan,
    scanNotes: params.scanNotes,
    liveRegime: {
      level: params.regime.level,
      symbol: params.regime.symbol,
      latestBar: params.regime.latestBar,
    },
    freshness: params.freshness,
    surfacedCandidates: toCandidateSnapshots(params.candidatesWithHealth),
    watchlist: toWatchSnapshots(params.activeWatchItems),
    openExposureVnd: params.openExposureVnd,
    accountEquityVnd: params.accountEquityVnd,
    portfolioRiskConfigured: params.portfolioRiskConfigured,
    now: params.now,
    rsDiagnosticsBySymbol: params.rsDiagnosticsBySymbol,
    rsNearMissWatchlist: params.rsNearMissWatchlist,
    marketContext: params.marketContext,
    portfolioGuardrails: params.portfolioGuardrails,
    openTrades: params.openTrades,
    latestCloseByTradeSymbol: params.latestCloseByTradeSymbol,
  };
}
