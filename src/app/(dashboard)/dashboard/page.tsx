import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatEquityThousandVndPerShare, formatBarDataDateUtcLong } from "@/lib/formatters";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import {
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";
import {
  computeDailyTradingDecision,
} from "@/lib/scanner/trading-decision";
import {
  prepareSurfacedCandidatesHealthView,
  type SurfacedCandidateHealthView,
} from "@/lib/setup-health";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import { isTradingRiskBudgetConfigured } from "@/lib/trading-account-risk-config";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { buildDecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";
import { DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardBestSetupsPanel } from "@/components/dashboard/dashboard-best-setups-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardDiagnosticsStack } from "@/components/dashboard/dashboard-diagnostics-stack";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import type { Trade } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Decision-first trading cockpit.",
};

function pctFromRangeText(input: string): number | null {
  const m = input.match(/(\d+)\s*-\s*(\d+)%/);
  if (m) return Number(m[2]) / 100;
  const single = input.match(/(\d+)%/);
  return single ? Number(single[1]) / 100 : null;
}

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

  const decision =
    scanNotes?.decision ??
    (latestScan
      ? computeDailyTradingDecision({
          gate1Level: regime.level,
          candidateCountA: latestScan.candidateCountA,
          candidateCountB: latestScan.candidateCountB,
        })
      : {
          level: "NO_TRADE" as const,
          allocation: "0%",
          explanation: "No scan run found yet.",
        });

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const currentExposure = openTrades.reduce(
    (sum, t) => sum + t.entryPrice * t.quantity,
    0
  );
  const maxPortfolioPct = pctFromRangeText(decision.allocation);
  const perTradeGuidance = decision.level === "PROBE" ? "10-15%" : "10-20%";

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

  const rejectionBuckets = Object.entries(scanNotes?.topRejectionCategories ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const vnindexLine = regime.latestBar
    ? `VNINDEX ${formatEquityThousandVndPerShare(regime.latestBar.close)} · ${formatBarDataDateUtcLong(regime.latestBar.date)}`
    : "VNINDEX latest bar unavailable.";

  // S1: compute Decision Cockpit DTO in parallel for validation before S2 UI (no render yet).
  const cockpitDto = buildDecisionCockpitDto(
    buildDashboardCockpitInput({
      latestScan,
      scanNotes,
      regime,
      freshness,
      candidatesWithHealth,
      activeWatchItems,
      openExposureVnd: currentExposure,
      portfolioRiskConfigured: isTradingRiskBudgetConfigured(),
    })
  );
  void cockpitDto;

  return (
    <div className="page-container dash-cockpit animate-in pb-10">
      <DashboardPageHeader />

      <DashboardMarketStatusBar freshness={freshness} />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          title="Partial dashboard data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/dashboard/page.tsx · one or more Prisma reads failed; sections below may be empty."
          data-testid="dashboard-db-load-error"
        />
      ) : null}

      <div className="dash-cockpit__hero-row">
        <DashboardDecisionHero
          decision={decision}
          gate1Level={regime.level}
          surfacedCount={latestScan?.candidateCountSurfaced ?? 0}
          vnindexLine={vnindexLine}
        />
        <DashboardExposurePanel
          decision={decision}
          currentExposure={currentExposure}
          perTradeGuidance={perTradeGuidance}
          maxPortfolioPct={maxPortfolioPct}
          portfolioRiskConfigured={isTradingRiskBudgetConfigured()}
        />
      </div>

      <div className="dash-cockpit__secondary-row">
        <DashboardScanMetaStrip
          latestScan={latestScan}
          delayedBackdrop={scanDelayedBackdrop}
        />
        <DashboardPerformancePanel trades={trades} />
      </div>

      <DashboardBestSetupsPanel topSetups={topSetups} latestScan={latestScan} />

      <MomentumWatchSection />

      <DashboardWatchlistPanel
        items={activeWatchItems}
        latestCloseBySymbol={latestCloseBySymbol}
      />

      <DashboardDiagnosticsStack
        rejectionBuckets={rejectionBuckets}
        scanNotes={scanNotes}
        latestScan={latestScan}
      />
    </div>
  );
}
