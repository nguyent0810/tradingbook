import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import {
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";
import {
  prepareSurfacedCandidatesHealthView,
  type SurfacedCandidateHealthView,
} from "@/lib/setup-health";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import {
  isTradingRiskBudgetConfigured,
  parseTradingAccountEquityVnd,
} from "@/lib/trading-account-risk-config";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { fetchMarketContextUi } from "@/lib/market/fetch-market-context-ui";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import { buildDecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { loadRsDiagnosticUiForSymbols } from "@/lib/scanner/gate2/load-rs-diagnostics";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import {
  buildRsNearMissWatchlistPanel,
  computeRsNearMissWatchlistFromDb,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import { mapDashboardV3ViewModel } from "@/lib/dashboard/map-dashboard-v3-view-model";
import { CommandDeckDashboard } from "@/components/command-deck";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import type { Trade } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Trading OS decision cockpit.",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let dbLoadError: string | null = null;

  let trades: Trade[] = [];
  try {
    trades = await prisma.trade.findMany({
      where: { userId: session.userId },
      orderBy: { entryDate: "asc" },
    });
  } catch (e) {
    dbLoadError = "Database temporarily unavailable (trade history).";
    console.error("[dashboard] trades query failed:", e);
    trades = [];
  }

  const [regime, marketSnapshot] = await Promise.all([
    getMarketRegimeFromDb("VNINDEX"),
    fetchMarketSessionSnapshot(prisma),
  ]);
  const alignmentAnalysis = analyzeMarketDataAlignment(marketSnapshot);

  let latestScan = null as Awaited<ReturnType<typeof getLatestDailyScanRun>>;
  try {
    latestScan = await getLatestDailyScanRun();
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (latest scan).";
    console.error("[dashboard] latest scan query failed:", e);
    latestScan = null;
  }

  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
  const freshness = buildMarketFreshnessDto({
    snapshot: marketSnapshot,
    alignment: alignmentAnalysis,
    delayedBackdropFromScanNotes:
      scanNotes?.benchmarkBackdrop?.delayedBackdrop === true,
    scanSessionCoverage: scanNotes?.sessionCoverage ?? null,
  });

  let marketContext: MarketContextUiDto | null = null;
  if (freshness.benchmarkDate) {
    try {
      const rsSymbolsForContext = [
        ...new Set([
          ...toCandidateRows(latestScan).map((c) => c.symbolKey),
          ...(scanNotes?.closestToValidSymbols ?? [])
            .slice(0, 12)
            .map((r) => r.symbol),
        ]),
      ];
      marketContext = await fetchMarketContextUi(
        prisma,
        freshness.benchmarkDate,
        { symbols: rsSymbolsForContext }
      );
    } catch (e) {
      console.error("[dashboard] market context load failed:", e);
    }
  }

  const rawCandidates = toCandidateRows(latestScan);
  const evalDate =
    rawCandidates.length > 0
      ? rawCandidates.reduce(
          (latestDate, c) => (c.barDate > latestDate ? c.barDate : latestDate),
          rawCandidates[0]!.barDate
        )
      : latestScan?.runAt ?? new Date();
  let candidatesWithHealth: SurfacedCandidateHealthView[] = [];
  try {
    candidatesWithHealth =
      rawCandidates.length > 0
        ? await prepareSurfacedCandidatesHealthView(
            prisma,
            rawCandidates,
            evalDate
          )
        : [];
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (candidate health).";
    console.error("[dashboard] candidate health query failed:", e);
    candidatesWithHealth = [];
  }
  const topSetups = candidatesWithHealth.slice(0, 5);

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const currentExposure = openTrades.reduce(
    (sum, t) => sum + t.entryPrice * t.quantity,
    0
  );
  let activeWatchItems: DashboardWatchlistItem[] = [];
  try {
    activeWatchItems = await prisma.setupWatchItem.findMany({
      where: {
        lifecycleStatus: {
          in: [
            SetupLifecycleStatus.NEW,
            SetupLifecycleStatus.WATCHING,
            SetupLifecycleStatus.READY,
          ],
        },
      },
      orderBy: [{ lifecycleStatus: "asc" }, { updatedAt: "desc" }],
      take: 20,
      include: {
        symbol: { select: { symbol: true } },
      },
    });
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (watchlist).";
    console.error("[dashboard] watch items query failed:", e);
    activeWatchItems = [];
  }

  const accountEquityVnd = parseTradingAccountEquityVnd();
  const portfolioRiskConfigured = isTradingRiskBudgetConfigured();

  const rsSession =
    marketSnapshot.benchmarkSessionDate ??
    (rawCandidates.length > 0 ? evalDate : null);
  let rsDiagnosticsBySymbol: Record<string, RsDiagnosticUi> | undefined;
  if (rsSession) {
    const rsSymbols = [
      ...new Set([
        ...candidatesWithHealth.map((c) => c.symbolKey),
        ...(scanNotes?.closestToValidSymbols ?? [])
          .slice(0, 12)
          .map((r) => r.symbol),
      ]),
    ];
    if (rsSymbols.length > 0) {
      try {
        const rsMap = await loadRsDiagnosticUiForSymbols(
          prisma,
          rsSymbols,
          rsSession
        );
        rsDiagnosticsBySymbol = {};
        for (const [sym, ui] of rsMap) {
          if (ui) rsDiagnosticsBySymbol[sym] = ui;
        }
      } catch (e) {
        console.error("[dashboard] RS diagnostic load failed:", e);
      }
    }
  }

  let rsNearMissWatchlist = buildRsNearMissWatchlistPanel([]);
  if (rsSession) {
    try {
      const excludeSymbols = candidatesWithHealth.map((c) => c.symbolKey);
      const { rows } = await computeRsNearMissWatchlistFromDb(prisma, {
        limit: 12,
        excludeSymbols,
      });
      const rsMap = await loadRsDiagnosticUiForSymbols(
        prisma,
        rows.map((r) => r.symbol),
        rsSession
      );
      rsNearMissWatchlist = buildRsNearMissWatchlistPanel(rows, rsMap);
    } catch (e) {
      console.error("[dashboard] RS near-miss watchlist failed:", e);
    }
  }

  const cockpitDto = buildDecisionCockpitDto(
    buildDashboardCockpitInput({
      latestScan,
      scanNotes,
      regime,
      freshness,
      candidatesWithHealth,
      activeWatchItems,
      openExposureVnd: currentExposure,
      accountEquityVnd,
      portfolioRiskConfigured,
      rsDiagnosticsBySymbol,
      rsNearMissWatchlist,
      marketContext,
    })
  );

  const viewModel = mapDashboardV3ViewModel({
    cockpitDto,
    freshness,
    regime,
    latestScan,
    topSetups,
    trades,
    watchItemCount: activeWatchItems.length,
    openPositionCount: openTrades.length,
    marketContext,
    dbLoadError,
  });
  return (
    <CommandDeckDashboard
      viewModel={viewModel}
      header={
        <div className="mb-6">
          <DashboardPageHeader cta={viewModel.headerCta} />
        </div>
      }
    />
  );
}
