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
import {
  buildDecisionCockpitDto,
  resolveBestSetupsPanelPresentation,
} from "@/lib/dashboard/decision-cockpit-dto";
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardEntrance } from "@/components/dashboard/dashboard-entrance";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardCommandPanel } from "@/components/dashboard/dashboard-command-panel";
import { DashboardHeroAside } from "@/components/dashboard/dashboard-hero-aside";
import { DashboardOpportunityBoard } from "@/components/dashboard/dashboard-opportunity-board";
import { DashboardSecondaryIntelligence } from "@/components/dashboard/dashboard-secondary-intelligence";
import { DashboardTradingDecisionSummary } from "@/components/dashboard/dashboard-trading-decision-summary";
import { DashboardObservationalBand } from "@/components/dashboard/dashboard-observational-band";
import { DashboardActionableSetupsZone } from "@/components/dashboard/dashboard-actionable-setups-zone";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import type { Trade } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Decision-first trading cockpit.",
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
  });
  const scanDelayedBackdrop =
    scanNotes?.benchmarkBackdrop?.delayedBackdrop ?? null;
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

  const watchSymbolIds = [...new Set(activeWatchItems.map((w) => w.symbolId))];
  let latestBars: { symbolId: string; close: number }[] = [];
  if (watchSymbolIds.length > 0) {
    try {
      latestBars = await prisma.stockDailyBar.findMany({
        where: { symbolId: { in: watchSymbolIds } },
        orderBy: [{ symbolId: "asc" }, { date: "desc" }],
        distinct: ["symbolId"],
        select: { symbolId: true, close: true },
      });
    } catch (e) {
      dbLoadError ??= "Database temporarily unavailable (latest closes).";
      console.error("[dashboard] latest bars query failed:", e);
      latestBars = [];
    }
  }
  const latestCloseBySymbol = new Map(latestBars.map((b) => [b.symbolId, b.close]));

  const accountEquityVnd = parseTradingAccountEquityVnd();
  const portfolioRiskConfigured = isTradingRiskBudgetConfigured();

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
    })
  );

  const surfacedCount = latestScan?.candidateCountSurfaced ?? 0;
  const bestSetupsPresentation = resolveBestSetupsPanelPresentation({
    setupRowCount: topSetups.length,
    opportunity: cockpitDto.opportunity,
    latestScan: latestScan
      ? {
          id: latestScan.id,
          runAt: latestScan.runAt,
          gate1Level: latestScan.gate1Level,
          candidateCountA: latestScan.candidateCountA,
          candidateCountB: latestScan.candidateCountB,
          candidateCountSurfaced: latestScan.candidateCountSurfaced,
        }
      : null,
  });

  return (
    <div className="page-container dash-cockpit dash-cockpit--v11 pb-10">
      <DashboardPageHeader />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          title="Partial dashboard data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/dashboard/page.tsx · one or more Prisma reads failed; sections below may be empty."
          data-testid="dashboard-db-load-error"
        />
      ) : null}

      <DashboardEntrance>
        {/* EOD 1–2: stance + exposure/performance (5/12 hero rail) */}
        <DashboardCommandPanel
          freshness={freshness}
          latestScan={latestScan}
          scanDelayedBackdrop={scanDelayedBackdrop}
          verdict={cockpitDto.verdict}
          surfacedCount={surfacedCount}
          tomorrow={cockpitDto.tomorrow}
          evidence={cockpitDto.evidence}
          blockers={cockpitDto.blockers}
          heroAside={
            <DashboardHeroAside
              risk={cockpitDto.risk}
              verdict={cockpitDto.verdict}
              riskBudgetHeadroom={cockpitDto.riskBudgetHeadroom}
              portfolioRiskConfigured={portfolioRiskConfigured}
              trades={trades}
            />
          }
        />

        <DashboardTradingDecisionSummary
          latestScan={latestScan}
          verdict={cockpitDto.verdict}
        />

        {/* Pipeline context before actionable table */}
        <DashboardOpportunityBoard
          opportunity={cockpitDto.opportunity}
          ladder={cockpitDto.setupQualityLadder}
        />

        {/* EOD 3: actionable setups */}
        <DashboardActionableSetupsZone
          topSetups={topSetups}
          bestSetupsPresentation={bestSetupsPresentation}
        />

        {/* Observational: near-miss + momentum */}
        <DashboardObservationalBand
          opportunity={cockpitDto.opportunity}
          freshness={freshness}
          scanRunId={cockpitDto.scanRunId}
        />

        {/* EOD 4: watchlist + collapsible diagnostics */}
        <DashboardSecondaryIntelligence
          diagnostics={cockpitDto.actionableDiagnostics}
          watchItems={activeWatchItems}
          latestCloseBySymbol={latestCloseBySymbol}
        />
      </DashboardEntrance>
    </div>
  );
}
