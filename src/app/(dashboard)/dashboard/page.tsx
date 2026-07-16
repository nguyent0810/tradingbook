import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { after } from "next/server";
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
import { fetchVnindexHistoryCached } from "@/lib/market/fetch-vnindex-history";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { fetchMarketContextUi } from "@/lib/market/fetch-market-context-ui";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import { buildDecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { loadRsDiagnosticUiForSymbols } from "@/lib/scanner/gate2/load-rs-diagnostics";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import {
  buildRsNearMissWatchlistPanel,
  getCachedRsNearMissWatchlist,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import {
  isRsWatchlistSnapshotEnabled,
  persistRsWatchlistSnapshot,
} from "@/lib/scanner/gate2/rs-watchlist-snapshot";
import { mapDashboardV3ViewModel } from "@/lib/dashboard/map-dashboard-v3-view-model";
import { computePortfolioGuardrails } from "@/lib/dashboard/portfolio-guardrails";
import { buildLatestCloseBySymbol } from "@/lib/dashboard/latest-close-by-symbol";
import { fetchLatestCloseByTradeSymbols } from "@/lib/trades/unrealized-from-close";
import type { DecisionCockpitOpenTradeSnapshot } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardDecisionCockpit } from "@/components/dashboard/dashboard-decision-cockpit";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import type { Trade } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Trading OS decision cockpit.",
};

type Fallible<T> = { data: T; error: string | null };

async function loadTrades(userId: string): Promise<Fallible<Trade[]>> {
  try {
    const data = await prisma.trade.findMany({
      where: { userId },
      orderBy: { entryDate: "asc" },
    });
    return { data, error: null };
  } catch (e) {
    console.error("[dashboard] trades query failed:", e);
    return { data: [], error: "Database temporarily unavailable (trade history)." };
  }
}

async function loadLatestScan(): Promise<
  Fallible<Awaited<ReturnType<typeof getLatestDailyScanRun>>>
> {
  try {
    const data = await getLatestDailyScanRun();
    return { data, error: null };
  } catch (e) {
    console.error("[dashboard] latest scan query failed:", e);
    return { data: null, error: "Database temporarily unavailable (latest scan)." };
  }
}

async function loadActiveWatchItems(): Promise<Fallible<DashboardWatchlistItem[]>> {
  try {
    const data = await prisma.setupWatchItem.findMany({
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
      take: 21,
      include: {
        symbol: { select: { symbol: true } },
      },
    });
    return { data, error: null };
  } catch (e) {
    console.error("[dashboard] watch items query failed:", e);
    return { data: [], error: "Database temporarily unavailable (watchlist)." };
  }
}

async function loadMarketContext(
  benchmarkDate: string | null,
  rawCandidates: ReturnType<typeof toCandidateRows>,
  scanNotes: DailyScanGate2Notes | null
): Promise<MarketContextUiDto | null> {
  if (!benchmarkDate) return null;
  try {
    const rsSymbolsForContext = [
      ...new Set([
        ...rawCandidates.map((c) => c.symbolKey),
        ...(scanNotes?.closestToValidSymbols ?? []).slice(0, 12).map((r) => r.symbol),
      ]),
    ];
    return await fetchMarketContextUi(prisma, benchmarkDate, {
      symbols: rsSymbolsForContext,
    });
  } catch (e) {
    console.error("[dashboard] market context load failed:", e);
    return null;
  }
}

async function loadCandidatesWithHealth(
  rawCandidates: ReturnType<typeof toCandidateRows>,
  evalDate: Date
): Promise<Fallible<SurfacedCandidateHealthView[]>> {
  if (rawCandidates.length === 0) return { data: [], error: null };
  try {
    const data = await prepareSurfacedCandidatesHealthView(prisma, rawCandidates, evalDate);
    return { data, error: null };
  } catch (e) {
    console.error("[dashboard] candidate health query failed:", e);
    return { data: [], error: "Database temporarily unavailable (candidate health)." };
  }
}

async function loadLatestCloseBySymbol(
  activeWatchItems: DashboardWatchlistItem[]
): Promise<Map<string, number>> {
  if (activeWatchItems.length === 0) return new Map();
  try {
    return await buildLatestCloseBySymbol(
      prisma,
      activeWatchItems.map((item) => item.symbolId),
      new Date()
    );
  } catch (e) {
    console.error("[dashboard] latest close lookup failed:", e);
    return new Map();
  }
}

/**
 * Workstream B — mark-to-market exposure for OPEN trades. Reuses the existing
 * `fetchLatestCloseByTradeSymbols` helper (already used for unrealized P&L on
 * the Trades ledger — see `src/lib/trades/unrealized-from-close.ts`), keyed
 * directly by ticker (`Trade.symbol`). Deliberately NOT
 * `src/lib/dashboard/latest-close-by-symbol.ts`: that helper is keyed by the
 * internal `StockSymbol.id`, sourced from watchlist rows — a poor fit for
 * open trades, which only carry the ticker string.
 */
async function loadLatestCloseByTradeSymbol(
  openTrades: DecisionCockpitOpenTradeSnapshot[]
): Promise<Map<string, number>> {
  if (openTrades.length === 0) return new Map();
  try {
    const bars = await fetchLatestCloseByTradeSymbols(
      prisma,
      openTrades.map((t) => t.symbol)
    );
    const closeBySymbol = new Map<string, number>();
    for (const [sym, bar] of bars) closeBySymbol.set(sym, bar.close);
    return closeBySymbol;
  } catch (e) {
    console.error("[dashboard] latest close by trade symbol lookup failed:", e);
    return new Map();
  }
}

async function loadRsDiagnosticsBySymbol(
  candidatesWithHealth: SurfacedCandidateHealthView[],
  scanNotes: DailyScanGate2Notes | null,
  rsSession: Date | null
): Promise<Record<string, RsDiagnosticUi> | undefined> {
  if (!rsSession) return undefined;
  const rsSymbols = [
    ...new Set([
      ...candidatesWithHealth.map((c) => c.symbolKey),
      ...(scanNotes?.closestToValidSymbols ?? []).slice(0, 12).map((r) => r.symbol),
    ]),
  ];
  if (rsSymbols.length === 0) return undefined;
  try {
    const rsMap = await loadRsDiagnosticUiForSymbols(prisma, rsSymbols, rsSession);
    const rsDiagnosticsBySymbol: Record<string, RsDiagnosticUi> = {};
    for (const [sym, ui] of rsMap) {
      if (ui) rsDiagnosticsBySymbol[sym] = ui;
    }
    return rsDiagnosticsBySymbol;
  } catch (e) {
    console.error("[dashboard] RS diagnostic load failed:", e);
    return undefined;
  }
}

async function loadRsNearMiss(
  candidatesWithHealth: SurfacedCandidateHealthView[],
  rsSession: Date | null
) {
  const empty = {
    panel: buildRsNearMissWatchlistPanel([]),
    rowsForSnapshot: [] as Awaited<ReturnType<typeof getCachedRsNearMissWatchlist>>["rows"],
    tradabilityCount: 0,
    uiMap: undefined as Map<string, RsDiagnosticUi | null> | undefined,
  };
  if (!rsSession) return empty;
  try {
    const excludeSymbols = candidatesWithHealth.map((c) => c.symbolKey);
    const { rows, tradabilityPassedCount, earlyEntryBySymbol } =
      await getCachedRsNearMissWatchlist({ limit: 12, excludeSymbols });
    const rsMap = await loadRsDiagnosticUiForSymbols(
      prisma,
      rows.map((r) => r.symbol),
      rsSession
    );
    return {
      panel: buildRsNearMissWatchlistPanel(rows, rsMap, earlyEntryBySymbol),
      rowsForSnapshot: rows,
      tradabilityCount: tradabilityPassedCount,
      uiMap: rsMap,
    };
  } catch (e) {
    console.error("[dashboard] RS near-miss watchlist failed:", e);
    return empty;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Tier 1 — independent of everything except the session; run together.
  const [
    tradesResult,
    [regime, marketSnapshot],
    latestScanResult,
    activeWatchItemsResult,
    vnindexHistory,
  ] = await Promise.all([
    loadTrades(session.userId),
    Promise.all([getMarketRegimeFromDb("VNINDEX"), fetchMarketSessionSnapshot(prisma)]),
    loadLatestScan(),
    loadActiveWatchItems(),
    fetchVnindexHistoryCached(30),
  ]);
  const trades = tradesResult.data;
  const latestScan = latestScanResult.data;
  const watchlistTruncated = activeWatchItemsResult.data.length > 20;
  const activeWatchItems = activeWatchItemsResult.data.slice(0, 20);

  const alignmentAnalysis = analyzeMarketDataAlignment(marketSnapshot);
  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
  const freshness = buildMarketFreshnessDto({
    snapshot: marketSnapshot,
    alignment: alignmentAnalysis,
    delayedBackdropFromScanNotes: scanNotes?.benchmarkBackdrop?.delayedBackdrop === true,
    scanSessionCoverage: scanNotes?.sessionCoverage ?? null,
  });
  const rawCandidates = toCandidateRows(latestScan);
  const evalDate =
    rawCandidates.length > 0
      ? rawCandidates.reduce(
          (latestDate, c) => (c.barDate > latestDate ? c.barDate : latestDate),
          rawCandidates[0]!.barDate
        )
      : latestScan?.runAt ?? new Date();
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const currentExposure = openTrades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0);
  const accountEquityVnd = parseTradingAccountEquityVnd();
  const portfolioRiskConfigured = isTradingRiskBudgetConfigured();
  // Workstream D — practical portfolio guardrails; reuses `trades` already loaded above
  // (all statuses, not just OPEN) rather than issuing a new Prisma query.
  const portfolioGuardrails = computePortfolioGuardrails({ trades, accountEquityVnd });
  // Workstream B — risk-to-stop / mark-to-market inputs (distinct from cost-basis `currentExposure`).
  const openTradesForRisk: DecisionCockpitOpenTradeSnapshot[] = openTrades.map((t) => ({
    symbol: t.symbol,
    entryPrice: t.entryPrice,
    quantity: t.quantity,
    stopLoss: t.stopLoss,
  }));

  // Tier 2 — each depends only on Tier 1 results, independent of each other.
  const [marketContext, candidatesHealthResult, latestCloseBySymbol, latestCloseByTradeSymbol] =
    await Promise.all([
      loadMarketContext(freshness.benchmarkDate, rawCandidates, scanNotes),
      loadCandidatesWithHealth(rawCandidates, evalDate),
      loadLatestCloseBySymbol(activeWatchItems),
      loadLatestCloseByTradeSymbol(openTradesForRisk),
    ]);
  const candidatesWithHealth = candidatesHealthResult.data;
  const topSetups = candidatesWithHealth.slice(0, 5);

  const rsSession =
    marketSnapshot.benchmarkSessionDate ?? (rawCandidates.length > 0 ? evalDate : null);

  // Tier 3 — both depend on candidatesWithHealth/rsSession, independent of each other.
  const [rsDiagnosticsBySymbol, rsNearMiss] = await Promise.all([
    loadRsDiagnosticsBySymbol(candidatesWithHealth, scanNotes, rsSession),
    loadRsNearMiss(candidatesWithHealth, rsSession),
  ]);
  const rsNearMissWatchlist = rsNearMiss.panel;

  const dbLoadError =
    tradesResult.error ??
    latestScanResult.error ??
    candidatesHealthResult.error ??
    activeWatchItemsResult.error ??
    null;

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
      portfolioGuardrails,
      openTrades: openTradesForRisk,
      latestCloseByTradeSymbol,
    })
  );

  // Snapshot persistence is a write with no effect on the rendered response —
  // schedule it after the response is sent instead of blocking on it.
  if (
    isRsWatchlistSnapshotEnabled() &&
    rsSession &&
    rsNearMiss.rowsForSnapshot.length > 0
  ) {
    const sessionDate = rsSession;
    const rowsForSnapshot = rsNearMiss.rowsForSnapshot;
    const tradabilityCount = rsNearMiss.tradabilityCount;
    const uiMap = rsNearMiss.uiMap;
    const verdictUxLevel = cockpitDto.verdict.uxLevel.value;
    after(async () => {
      try {
        await persistRsWatchlistSnapshot(prisma, {
          sessionDate,
          rows: rowsForSnapshot,
          verdictUxLevel,
          tradabilityPassedCount: tradabilityCount,
          rsUiBySymbol: uiMap,
        });
      } catch (e) {
        console.error("[dashboard] RS watchlist snapshot failed:", e);
      }
    });
  }

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
    <div className="page-container command-deck dash-cockpit dash-cockpit--v2 pb-10">
      <DashboardPageHeader cta={viewModel.headerCta} />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          className="dash-v2-alert"
          title="Partial dashboard data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/dashboard/page.tsx · one or more Prisma reads failed; sections below may be empty."
          data-testid="dashboard-db-load-error"
        />
      ) : null}

      <DashboardDecisionCockpit
        freshness={freshness}
        latestScan={latestScan}
        scanDelayedBackdrop={scanNotes?.benchmarkBackdrop?.delayedBackdrop ?? null}
        cockpitDto={cockpitDto}
        surfacedCount={latestScan?.candidateCountSurfaced ?? 0}
        portfolioRiskConfigured={portfolioRiskConfigured}
        trades={trades}
        activeWatchItems={activeWatchItems}
        watchlistTruncated={watchlistTruncated}
        latestCloseBySymbol={latestCloseBySymbol}
        tradeGate={viewModel.risk.tradeGate}
        vnindexHistory={vnindexHistory}
      />
    </div>
  );
}
