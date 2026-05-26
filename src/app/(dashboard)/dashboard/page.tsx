import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
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
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";
import { DashboardEvidenceCompact } from "@/components/dashboard/dashboard-evidence-compact";
import { DashboardExposurePanel } from "@/components/dashboard/dashboard-exposure-panel";
import { DashboardOpportunityPreview } from "@/components/dashboard/dashboard-opportunity-preview";
import { DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardBestSetupsPanel } from "@/components/dashboard/dashboard-best-setups-panel";
import { DashboardSetupQualityLadder } from "@/components/dashboard/dashboard-setup-quality-ladder";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import { DashboardTomorrowPlan } from "@/components/dashboard/dashboard-tomorrow-plan";
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

  const verdictUx = cockpitDto.verdict.uxLevel.value;

  return (
    <div className="page-container dash-cockpit dash-cockpit--action-first animate-in pb-10">
      <DashboardPageHeader />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          title="Partial dashboard data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/dashboard/page.tsx · one or more Prisma reads failed; sections below may be empty."
          data-testid="dashboard-db-load-error"
        />
      ) : null}

      {/* 1. Top strip — freshness + scan meta */}
      <div
        className="dash-cockpit__zone dash-cockpit__zone--status"
        data-testid="dashboard-cockpit-zone-status"
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip
          latestScan={latestScan}
          delayedBackdrop={scanDelayedBackdrop}
        />
      </div>

      {/* 2. Primary action — verdict + compact evidence | What next */}
      <section
        className={`dash-cockpit__zone dash-cockpit__zone--decision${verdictUx === "NO_TRADE" ? " dash-cockpit__zone--no-trade" : ""}`}
        data-testid="dashboard-cockpit-zone-decision"
        aria-label="Today's decision and next actions"
      >
        <div className="dash-cockpit__action-row">
          <div className="dash-cockpit__action-verdict">
            <DashboardDecisionHero
              verdict={cockpitDto.verdict}
              surfacedCount={surfacedCount}
              compact
            />
            <DashboardEvidenceCompact
              chips={cockpitDto.evidence}
              blockers={cockpitDto.blockers}
            />
          </div>
          <DashboardTomorrowPlan tomorrow={cockpitDto.tomorrow} promoted />
        </div>
      </section>

      {/* 3. Opportunity row */}
      <section
        className="dash-cockpit__zone dash-cockpit__zone--opportunity"
        data-testid="dashboard-cockpit-zone-opportunity"
        aria-label="Opportunity pipeline"
      >
        <div className="dash-cockpit__bento-row dash-cockpit__bento-row--opportunity-risk">
          <DashboardOpportunityPreview opportunity={cockpitDto.opportunity} />
          <div className="dash-cockpit__opportunity-side">
            <DashboardSetupQualityLadder ladder={cockpitDto.setupQualityLadder} />
            <DashboardExposurePanel
              risk={cockpitDto.risk}
              verdict={cockpitDto.verdict}
              riskBudgetHeadroom={cockpitDto.riskBudgetHeadroom}
              portfolioRiskConfigured={portfolioRiskConfigured}
            />
          </div>
        </div>
      </section>

      {/* 4. Secondary decision support */}
      <section
        className="dash-cockpit__zone dash-cockpit__zone--execution"
        data-testid="dashboard-cockpit-zone-execution"
        aria-label="Secondary decision support"
      >
        <div className="dash-cockpit__bento-row dash-cockpit__bento-row--secondary-support">
          <MomentumWatchSection />
          <DashboardActionableBlockers
            diagnostics={cockpitDto.actionableDiagnostics}
            compact
          />
        </div>
      </section>

      {/* 5. Low priority */}
      <section
        className="dash-cockpit__zone dash-cockpit__zone--secondary"
        data-testid="dashboard-cockpit-zone-next-session"
        aria-label="Low priority context"
      >
        <div className="dash-cockpit__bento-row dash-cockpit__bento-row--low-priority">
          <DashboardBestSetupsPanel
            topSetups={topSetups}
            presentation={bestSetupsPresentation}
          />
          <div className="dash-cockpit__low-priority-side">
            <DashboardWatchlistPanel
              items={activeWatchItems}
              latestCloseBySymbol={latestCloseBySymbol}
            />
            <div className="dash-cockpit__performance-slot">
              <DashboardPerformancePanel trades={trades} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
