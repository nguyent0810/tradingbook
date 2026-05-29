import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  fetchBarCloseOnOrBeforeReviewBatch,
  fetchLatestTwoClosesByTradeSymbols,
  type LatestTwoCloseBars,
  utcStockBarCutoffDate,
} from "@/lib/trades/unrealized-from-close";
import { loadOpenPositionMarks } from "@/lib/trades/position-health";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import {
  TradesLedgerDeck,
  TradesLedgerPageShell,
} from "@/components/trades/trades-ledger-deck";
import type { TradesLedgerOpenRowPack } from "@/components/trades/trades-ledger-types";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import { getLatestDailyScanRun } from "@/lib/scanner/setups-queries";
import { deriveTradesLedgerRowFields } from "@/lib/trades/trades-ledger-row-derived";
import {
  buildOpenPositionReviewDto,
  type LatestTradeHealthLog,
} from "@/lib/trades/open-position-intelligence";
import { aggregateOpenPortfolioReviewStrip } from "@/lib/trades/eod-review-workflow";
import {
  deriveOperatingPosture,
  OPERATING_POSTURE_TRADER_LABEL,
} from "@/lib/trades/operating-posture";
import {
  parseHealthReviewLogPayload,
  reviewOutcomeTraderLabel,
} from "@/lib/trades/review-outcome";
import {
  buildOpenLedgerReviewOrder,
  buildReviewMemoryLines,
  buildReviewQueueModel,
  classifyReviewPriorityTier,
  compareOpenLedgerReviewOrder,
  deterioratedVsLastReviewBar,
  type WeeklyReviewChecklistAgg,
} from "@/lib/trades/review-priority-queue";
import { buildSessionBriefing } from "@/lib/trades/session-briefing";
import { deriveEscalationCues } from "@/lib/trades/review-escalation-cues";
import {
  buildReviewSessionQueue,
  computeReviewSessionDashboardCounts,
  resolveReviewSessionFocus,
  sessionQueueNeighbors,
  sortTradesForReviewSession,
} from "@/lib/trades/review-session-queue";
import { buildReviewContinuityLines } from "@/lib/trades/review-continuity-lines";
import {
  expandClusterDividerRows,
  sortTradesWithBookClusters,
} from "@/lib/trades/book-clusters";
import {
  computePlannedRiskConcentration,
  countOperatingPostures,
  deriveBookOperatingContext,
} from "@/lib/trades/book-operating-context";
import {
  bookOperatingSnapshotsMeaningfullyEqual,
  buildNextOperatingSnapshot,
  deriveOperatingTrendDiscipline,
  derivePersistentPressureAwareness,
  enhanceSessionOperatingNarrative,
  mergeSinceLastVisitDisplayLines,
  parseBookOperatingSnapshot,
} from "@/lib/trades/operating-trend-discipline";
import {
  countBookAttentionClusters,
  deriveBookOperatingBalanceLines,
} from "@/lib/trades/book-operating-balance";
import {
  derivePositionEvolution,
  POSITION_EVOLUTION_TRADER_LABEL,
} from "@/lib/trades/position-state-evolution";
import { OperatingSnapshotPersist } from "./operating-snapshot-persist";
import { FocusReviewWorkspace } from "./focus-review-workspace";
import { ReviewSessionChrome } from "./review-session-chrome";

export const metadata: Metadata = {
  title: "Trades — TradeLog",
  description: "View and manage your trades.",
};

/** Ledger routes must not statically omit streamed row payloads (filters use `useSearchParams`). */
export const dynamic = "force-dynamic";

interface TradesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    compactReview?: string;
    reviewSession?: string;
    reviewFocus?: string;
  }>;
}

function buildTradesSearchParams(input: {
  search: string;
  statusFilter: string;
  sortParam: string | undefined;
  compactReview: boolean;
  reviewSessionActive: boolean;
  reviewFocusId: string | undefined;
}): URLSearchParams {
  const p = new URLSearchParams();
  const s = input.search.trim();
  if (s) p.set("search", s);
  if (input.statusFilter && input.statusFilter !== "ALL") {
    p.set("status", input.statusFilter);
  }
  if (input.sortParam) p.set("sort", input.sortParam);
  if (input.compactReview) p.set("compactReview", "1");
  if (input.reviewSessionActive) p.set("reviewSession", "1");
  if (input.reviewFocusId) p.set("reviewFocus", input.reviewFocusId);
  return p;
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const prevBookOperatingSnapshot = parseBookOperatingSnapshot(
    cookieStore.get(`tl_book_op_v1_${session.userId}`)?.value
  );

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "";
  const sortOrder = params.sort === "oldest" ? "asc" : "desc";
  const compactReview =
    params.compactReview === "1" || params.compactReview === "true";
  const reviewSessionActive =
    params.reviewSession === "1" || params.reviewSession === "true";
  const reviewFocusParam =
    typeof params.reviewFocus === "string" ? params.reviewFocus : undefined;

  const where: Record<string, unknown> = { userId: session.userId };

  if (search) {
    where.symbol = { contains: search.toUpperCase(), mode: "insensitive" };
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  let dbLoadError: string | null = null;

  const [trades, marketSnapshot, latestScan] = await Promise.all([
    (async () => {
      try {
        return await prisma.trade.findMany({
          where,
          orderBy: { entryDate: sortOrder },
          include: {
            setupCandidate: {
              select: {
                id: true,
                setupType: true,
                quality: true,
                breakoutLevel: true,
                pullbackZoneLow: true,
                pullbackZoneHigh: true,
                stopLevel: true,
                barDate: true,
              },
            },
          },
        });
      } catch (e) {
        dbLoadError = "Database temporarily unavailable (trades).";
        console.error("[trades] trade list query failed:", e);
        return [];
      }
    })(),
    fetchMarketSessionSnapshot(prisma),
    getLatestDailyScanRun(),
  ]);

  const alignmentAnalysis = analyzeMarketDataAlignment(marketSnapshot);
  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
  const marketFreshness = buildMarketFreshnessDto({
    snapshot: marketSnapshot,
    alignment: alignmentAnalysis,
    delayedBackdropFromScanNotes:
      scanNotes?.benchmarkBackdrop?.delayedBackdrop === true,
    scanSessionCoverage: scanNotes?.sessionCoverage ?? null,
  });
  const scanDelayedBackdrop =
    scanNotes?.benchmarkBackdrop?.delayedBackdrop ?? null;

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const openTradeIds = trades
    .filter((t) => t.status === "OPEN")
    .map((t) => t.id);

  const openSymbols = [
    ...new Set(
      trades
        .filter((t) => t.status === "OPEN")
        .map((t) => t.symbol.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  const marks = await (async () => {
    try {
      return await loadOpenPositionMarks(prisma, openSymbols);
    } catch (e) {
      dbLoadError ??= "Database temporarily unavailable (position marks).";
      console.error("[trades] loadOpenPositionMarks failed:", e);
      return {
        latestCloseBySymbol: new Map(),
        expectedSessionDate: null,
        benchmarkLoadFailed: true,
        barsLoadFailed: true,
      };
    }
  })();
  const { latestCloseBySymbol: latestCloseBySymbol, expectedSessionDate } =
    marks;

  let checkedTodayTradeIds = new Set<string>();
  if (openTradeIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<Array<{ trade_id: string }>>`
        SELECT DISTINCT trade_id
        FROM trade_health_logs
        WHERE trade_id IN (${Prisma.join(openTradeIds)})
          AND checked_at >= ${dayStart}
          AND checked_at <= ${dayEnd}
      `;
      checkedTodayTradeIds = new Set(rows.map((r) => r.trade_id));
    } catch (e) {
      console.error("[trades] trade_health_logs batch query skipped:", e);
      checkedTodayTradeIds = new Set();
    }
  }

  const reviewedTodayOpenCount = openTradeIds.filter((id) =>
    checkedTodayTradeIds.has(id)
  ).length;

  let latestHealthByTradeId = new Map<string, LatestTradeHealthLog>();
  if (openTradeIds.length > 0) {
    try {
      const healthRows = await prisma.$queryRaw<
        Array<{
          trade_id: string;
          health_level: string;
          structure_status: string | null;
          checked_at: Date;
          review_checklist: unknown | null;
        }>
      >`
        SELECT DISTINCT ON (trade_id)
          trade_id,
          health_level,
          structure_status,
          checked_at,
          review_checklist
        FROM trade_health_logs
        WHERE trade_id IN (${Prisma.join(openTradeIds)})
        ORDER BY trade_id, checked_at DESC
      `;
      latestHealthByTradeId = new Map(
        healthRows.map((r) => {
          const payload = parseHealthReviewLogPayload(r.review_checklist);
          return [
            r.trade_id,
            {
              healthLevel: r.health_level,
              structureStatus: r.structure_status,
              checkedAt: r.checked_at,
              reviewChecklist: payload.checklist,
              reviewOutcome: payload.reviewOutcome,
            } satisfies LatestTradeHealthLog,
          ] as const;
        })
      );
    } catch (e) {
      console.error("[trades] latest trade_health_logs batch skipped:", e);
      latestHealthByTradeId = new Map();
    }
  }

  let weeklyFlagsByTradeId = new Map<string, WeeklyReviewChecklistAgg>();
  if (openTradeIds.length > 0) {
    try {
      const weekStartUtc = new Date(now);
      weekStartUtc.setUTCDate(weekStartUtc.getUTCDate() - 7);
      weekStartUtc.setUTCHours(0, 0, 0, 0);

      const aggRows = await prisma.$queryRaw<
        Array<{
          trade_id: string;
          stop_w: boolean;
          struct_w: boolean;
          exit_w: boolean;
        }>
      >`
        SELECT
          trade_id,
          BOOL_OR(COALESCE(review_checklist->>'stopReviewed', 'false') = 'true') AS stop_w,
          BOOL_OR(COALESCE(review_checklist->>'structureReviewed', 'false') = 'true') AS struct_w,
          BOOL_OR(COALESCE(review_checklist->>'exitPlanReviewed', 'false') = 'true') AS exit_w
        FROM trade_health_logs
        WHERE trade_id IN (${Prisma.join(openTradeIds)})
          AND checked_at >= ${weekStartUtc}
        GROUP BY trade_id
      `;

      weeklyFlagsByTradeId = new Map(
        aggRows.map((r) => [
          r.trade_id,
          {
            stopMarkedThisWeek: Boolean(r.stop_w),
            structureMarkedThisWeek: Boolean(r.struct_w),
            exitPlanMarkedThisWeek: Boolean(r.exit_w),
          },
        ])
      );
    } catch (e) {
      console.error("[trades] weekly checklist aggregation skipped:", e);
      weeklyFlagsByTradeId = new Map();
    }
  }

  let twoBarBySymbol = new Map<string, LatestTwoCloseBars>();
  if (openSymbols.length > 0) {
    try {
      twoBarBySymbol = await fetchLatestTwoClosesByTradeSymbols(
        prisma,
        openSymbols
      );
    } catch (e) {
      console.error("[trades] prior-bar batch skipped:", e);
      twoBarBySymbol = new Map();
    }
  }

  let baselineCloseByTradeId = new Map<string, number>();
  if (openTradeIds.length > 0 && latestHealthByTradeId.size > 0) {
    try {
      const stockRows = await prisma.stockSymbol.findMany({
        where: { symbol: { in: openSymbols } },
        select: { id: true, symbol: true },
      });
      const symbolKeyToId = new Map(
        stockRows.map((s) => [s.symbol.trim().toUpperCase(), s.id] as const)
      );

      const specs = trades
        .filter((t) => t.status === "OPEN")
        .flatMap((t) => {
          const log = latestHealthByTradeId.get(t.id);
          if (!log) return [];
          const sid = symbolKeyToId.get(t.symbol.trim().toUpperCase());
          if (!sid) return [];
          return [
            {
              tradeId: t.id,
              symbolId: sid,
              cutoffDate: utcStockBarCutoffDate(log.checkedAt),
            },
          ];
        });

      const baselines = await fetchBarCloseOnOrBeforeReviewBatch(
        prisma,
        specs
      );
      for (const [tid, bar] of baselines) {
        baselineCloseByTradeId.set(tid, bar.close);
      }
    } catch (e) {
      console.error("[trades] review-baseline batch skipped:", e);
      baselineCloseByTradeId = new Map();
    }
  }

  const openRowPackByTradeId = new Map<string, TradesLedgerOpenRowPack>();
  const ledgerCtx = {
    latestCloseBySymbol,
    expectedSessionDate,
    checkedTodayTradeIds,
    now,
  } as const;

  for (const trade of trades) {
    if (trade.status !== "OPEN") continue;
    const derived = deriveTradesLedgerRowFields(
      {
        id: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        entryDate: trade.entryDate,
        exitDate: trade.exitDate,
      },
      ledgerCtx
    );
    const sym = trade.symbol.trim().toUpperCase();
    const two = twoBarBySymbol.get(sym);
    const reviewDto = buildOpenPositionReviewDto({
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      quantity: trade.quantity,
      stopLoss: trade.stopLoss,
      stopValidity: derived.stopValidity,
      distanceToStop: derived.distanceToStop,
      latestClose: derived.latestBar?.close ?? null,
      latestBarDate: derived.latestBar?.date ?? null,
      staleVsBenchmark: derived.staleState,
      benchmarkSession: expectedSessionDate,
      reviewedToday: checkedTodayTradeIds.has(trade.id),
      setupLevels:
        trade.setupCandidate != null
          ? {
              breakoutLevel: trade.setupCandidate.breakoutLevel,
              pullbackZoneLow: trade.setupCandidate.pullbackZoneLow,
              pullbackZoneHigh: trade.setupCandidate.pullbackZoneHigh,
            }
          : null,
      latestHealthLog: latestHealthByTradeId.get(trade.id) ?? null,
      priorClose: two?.prior?.close ?? null,
      baselineCloseAtLastReview: baselineCloseByTradeId.get(trade.id) ?? null,
      priceUnitMismatch: derived.priceUnitMismatch,
    });

    const reviewedToday = checkedTodayTradeIds.has(trade.id);
    const deteriorated = deterioratedVsLastReviewBar({
      direction: trade.direction,
      latestClose: derived.latestBar?.close ?? null,
      baselineClose: baselineCloseByTradeId.get(trade.id) ?? null,
    });

    const priorityTier = classifyReviewPriorityTier({
      surface: reviewDto.surface,
      stopBand: reviewDto.stopBand,
      structureHints: reviewDto.structureHints,
      marketDataStale: reviewDto.marketDataStale,
      reviewedToday,
      deterioratedVsReview: deteriorated,
    });

    const sortKey = buildOpenLedgerReviewOrder({
      tradeId: trade.id,
      symbol: trade.symbol,
      surface: reviewDto.surface,
      stopBand: reviewDto.stopBand,
      structureHints: reviewDto.structureHints,
      marketDataStale: reviewDto.marketDataStale,
      reviewedToday,
      plannedCapitalAtRisk: reviewDto.plannedCapitalAtRisk,
      deterioratedVsReview: deteriorated,
    });

    const latestLog = latestHealthByTradeId.get(trade.id);
    const memoryLines = buildReviewMemoryLines({
      reviewedToday,
      latestChecklist: reviewDto.latestChecklist,
      weekFlags: weeklyFlagsByTradeId.get(trade.id) ?? null,
      lastCheckpointAt: latestLog?.checkedAt ?? null,
    });

    const escalationCues = deriveEscalationCues({
      priorityTier,
      stopBand: reviewDto.stopBand,
      surface: reviewDto.surface,
      marketDataStale: reviewDto.marketDataStale,
      reviewedToday,
      deterioratedVsReview: deteriorated,
      failedBreakoutHold: reviewDto.structureHints.includes(
        "failed_breakout_hold"
      ),
    });

    const latestOutcome = latestLog?.reviewOutcome ?? null;
    const { posture: operatingPosture, explainLines: postureExplainLines } =
      deriveOperatingPosture({
        stopBand: reviewDto.stopBand,
        surface: reviewDto.surface,
        marketDataStale: reviewDto.marketDataStale,
        reviewedToday,
        latestReviewOutcome: latestOutcome,
        escalationCueCount: escalationCues.length,
      });

    const { state: positionEvolution, explainLine: positionEvolutionLine } =
      derivePositionEvolution({
        operatingPosture,
        reviewedToday,
        stopBand: reviewDto.stopBand,
        surface: reviewDto.surface,
        marketDataStale: reviewDto.marketDataStale,
        deterioratedVsReview: deteriorated,
        escalationCueCount: escalationCues.length,
        priorityTier,
        latestReviewOutcome: latestOutcome,
      });

    openRowPackByTradeId.set(trade.id, {
      derived,
      reviewDto,
      priorityTier,
      sortKey,
      memoryLines,
      escalationCues,
      latestReviewOutcome: latestOutcome,
      operatingPosture,
      postureExplainLines,
      positionEvolution,
      positionEvolutionLine,
    });
  }

  const portfolioStrip =
    openRowPackByTradeId.size > 0
      ? aggregateOpenPortfolioReviewStrip(
          [...openRowPackByTradeId.entries()].map(([id, pack]) => ({
            reviewedToday: checkedTodayTradeIds.has(id),
            stopViolated: pack.reviewDto.surface === "stop_violated",
            underPressure:
              pack.reviewDto.surface === "under_pressure" ||
              pack.reviewDto.surface === "structure_weakening",
            staleMarket: pack.reviewDto.marketDataStale,
            plannedCapitalAtRisk: pack.reviewDto.plannedCapitalAtRisk,
          }))
        )
      : null;

  const reviewQueueModel =
    openRowPackByTradeId.size > 0
      ? buildReviewQueueModel(
          [...openRowPackByTradeId.values()].map((pack) => ({
            sortKey: pack.sortKey,
            priorityTier: pack.priorityTier,
            marketDataStale: pack.reviewDto.marketDataStale,
          }))
        )
      : null;

  const bookClusterCounts =
    openRowPackByTradeId.size > 0
      ? countBookAttentionClusters({
          packs: [...openRowPackByTradeId.entries()].map(
            ([tradeId, pack]) => ({
              tradeId,
              operatingPosture: pack.operatingPosture,
              priorityTier: pack.priorityTier,
            })
          ),
          reviewedTodayTradeIds: checkedTodayTradeIds,
        })
      : null;

  const urgentAllReviewedToday =
    reviewQueueModel != null &&
    reviewQueueModel.urgent.length > 0 &&
    reviewQueueModel.urgent.every((s) =>
      checkedTodayTradeIds.has(s.tradeId)
    );

  const highAttentionAllReviewedToday =
    reviewQueueModel != null &&
    reviewQueueModel.highAttention.length > 0 &&
    reviewQueueModel.highAttention.every((s) =>
      checkedTodayTradeIds.has(s.tradeId)
    );

  const sessionQuietLines = [
    urgentAllReviewedToday ? "Urgent reviews completed for today." : null,
    highAttentionAllReviewedToday
      ? "All high-attention positions reviewed today."
      : null,
  ].filter((l): l is string => l != null);

  const displayTrades =
    trades.length === 0
      ? trades
      : trades
          .map((t, index) => ({ t, index }))
          .sort((a, b) => {
            const oa = a.t.status === "OPEN";
            const ob = b.t.status === "OPEN";
            if (oa && !ob) return -1;
            if (!oa && ob) return 1;
            if (oa && ob) {
              const pa = openRowPackByTradeId.get(a.t.id);
              const pb = openRowPackByTradeId.get(b.t.id);
              if (pa && pb) {
                const cmp = compareOpenLedgerReviewOrder(
                  pa.sortKey,
                  pb.sortKey
                );
                if (cmp !== 0) return cmp;
              } else if (pa && !pb) return -1;
              else if (!pa && pb) return 1;
            }
            const ta = a.t.entryDate.getTime();
            const tb = b.t.entryDate.getTime();
            const dateCmp =
              sortOrder === "asc" ? ta - tb : tb - ta;
            if (dateCmp !== 0) return dateCmp;
            return a.index - b.index;
          })
          .map((x) => x.t);

  const sessionPackInputs = trades.flatMap((t) => {
    if (t.status !== "OPEN") return [];
    const pack = openRowPackByTradeId.get(t.id);
    if (!pack) return [];
    return [
      {
        tradeId: t.id,
        priorityTier: pack.priorityTier,
        reviewedToday: checkedTodayTradeIds.has(t.id),
        sortKey: pack.sortKey,
      },
    ];
  });

  const reviewSessionQueue = buildReviewSessionQueue(sessionPackInputs);
  const { focusId: sessionFocusId, focusIndex: sessionFocusIndex } =
    resolveReviewSessionFocus(reviewSessionQueue, reviewFocusParam);
  const { prevId: sessionPrevId, nextId: sessionNextId } =
    sessionQueueNeighbors(reviewSessionQueue, sessionFocusIndex);

  if (reviewSessionActive) {
    if (
      reviewSessionQueue.length > 0 &&
      sessionFocusId &&
      reviewFocusParam &&
      reviewFocusParam !== sessionFocusId
    ) {
      redirect(
        `/trades?${buildTradesSearchParams({
          search,
          statusFilter,
          sortParam: params.sort,
          compactReview,
          reviewSessionActive: true,
          reviewFocusId: sessionFocusId,
        }).toString()}`
      );
    }
    if (reviewSessionQueue.length === 0 && reviewFocusParam) {
      redirect(
        `/trades?${buildTradesSearchParams({
          search,
          statusFilter,
          sortParam: params.sort,
          compactReview,
          reviewSessionActive: true,
          reviewFocusId: undefined,
        }).toString()}`
      );
    }
  }

  const tierByTradeId = new Map(
    sessionPackInputs.map((p) => [p.tradeId, p.priorityTier] as const)
  );
  const allOpenTradeIds = trades
    .filter((t) => t.status === "OPEN")
    .map((t) => t.id);

  const sessionDashboardCounts = computeReviewSessionDashboardCounts({
    sessionQueue: reviewSessionQueue,
    focusIndex: sessionFocusIndex,
    tierByTradeId,
    reviewedTodayTradeIds: checkedTodayTradeIds,
    allOpenTradeIds,
  });

  const hasOpenTrades = trades.some((t) => t.status === "OPEN");

  const clusterPackMap = new Map(
    [...openRowPackByTradeId.entries()].map(([id, pack]) => [
      id,
      {
        operatingPosture: pack.operatingPosture,
        priorityTier: pack.priorityTier,
        sortKey: pack.sortKey,
      },
    ])
  );

  const useClusteredLedger =
    hasOpenTrades &&
    openRowPackByTradeId.size > 0 &&
    (reviewSessionActive || openRowPackByTradeId.size >= 5);

  const baseLedgerRows =
    reviewSessionActive && reviewSessionQueue.length > 0
      ? sortTradesForReviewSession(displayTrades, reviewSessionQueue)
      : displayTrades;

  const tableRowsSorted = useClusteredLedger
    ? sortTradesWithBookClusters(
        baseLedgerRows,
        clusterPackMap,
        checkedTodayTradeIds,
        {
          sessionActive:
            reviewSessionActive && reviewSessionQueue.length > 0,
          sessionQueue: reviewSessionQueue,
        }
      )
    : baseLedgerRows;

  const ledgerTableItems = expandClusterDividerRows(
    tableRowsSorted,
    useClusteredLedger,
    clusterPackMap,
    checkedTodayTradeIds
  );

  const plannedRiskConcentration = computePlannedRiskConcentration(
    trades
      .filter((t) => t.status === "OPEN")
      .map((t) => ({
        symbol: t.symbol,
        plannedCapitalAtRisk:
          openRowPackByTradeId.get(t.id)?.reviewDto.plannedCapitalAtRisk ??
          null,
      }))
  );

  const bookPostureCounts =
    openRowPackByTradeId.size > 0
      ? countOperatingPostures([...openRowPackByTradeId.values()])
      : null;

  const bookOperatingContext =
    portfolioStrip &&
    reviewQueueModel &&
    openRowPackByTradeId.size > 0 &&
    bookPostureCounts
      ? deriveBookOperatingContext({
          activeOpenCount: portfolioStrip.activeOpenCount,
          postureCounts: bookPostureCounts,
          urgentQueueCount: reviewQueueModel.urgent.length,
          highAttentionQueueCount: reviewQueueModel.highAttention.length,
          routinePendingQueueCount: reviewQueueModel.routinePending.length,
          staleMarketOpenCount: portfolioStrip.staleMarketOpenCount,
          stopViolationsCount: portfolioStrip.stopViolationsCount,
          pendingCheckpointCount: portfolioStrip.reviewsPendingTodayCount,
          partialRiskFigures: portfolioStrip.positionsPartialRiskFigures,
          concentration: plannedRiskConcentration,
        })
      : null;

  const defensiveHeavyBook =
    portfolioStrip != null &&
    bookPostureCounts != null &&
    portfolioStrip.activeOpenCount >= 3 &&
    bookPostureCounts.defensive + bookPostureCounts.high_attention >=
      Math.ceil(portfolioStrip.activeOpenCount * 0.45);

  const bookOperatingBalanceLines =
    bookClusterCounts != null &&
    portfolioStrip != null &&
    bookPostureCounts != null &&
    openRowPackByTradeId.size > 0
      ? deriveBookOperatingBalanceLines({
          activeOpenCount: portfolioStrip.activeOpenCount,
          postureCounts: bookPostureCounts,
          clusterCounts: bookClusterCounts,
          concentration: plannedRiskConcentration,
          previousStableClusterCount:
            prevBookOperatingSnapshot?.stableReviewedClusterCount ?? null,
        })
      : [];

  const deterioratingOpenCount = [...openRowPackByTradeId.values()].filter(
    (p) => p.positionEvolution === "deteriorating"
  ).length;
  const evolutionSummaryBook =
    deterioratingOpenCount >= 2
      ? "Multiple rows deteriorating vs last checkpoint."
      : null;

  const operatingTrendMetrics =
    bookOperatingContext != null &&
    portfolioStrip != null &&
    reviewQueueModel != null &&
    bookPostureCounts != null
      ? {
          postureCounts: bookPostureCounts,
          activeOpenCount: portfolioStrip.activeOpenCount,
          urgentQueueCount: reviewQueueModel.urgent.length,
          highAttentionQueueCount: reviewQueueModel.highAttention.length,
          staleMarketOpenCount: portfolioStrip.staleMarketOpenCount,
          pendingCheckpointCount: portfolioStrip.reviewsPendingTodayCount,
          reviewedTodayOpenCount,
          headlineTag: bookOperatingContext.headlineTag,
          staleHeavyCondition: bookOperatingContext.staleHeavyCondition,
          top1Share: plannedRiskConcentration.top1Share,
          top2Share: plannedRiskConcentration.top2Share,
          urgentSortedTradeIds: reviewQueueModel.urgent.map((s) => s.tradeId),
          highAttentionSortedTradeIds: reviewQueueModel.highAttention.map(
            (s) => s.tradeId
          ),
          stableReviewedClusterCount: bookClusterCounts?.stable_reviewed ?? 0,
          defensiveHeavyBook,
        }
      : null;

  const operatingTrendDiscipline =
    operatingTrendMetrics != null
      ? deriveOperatingTrendDiscipline({
          previous: prevBookOperatingSnapshot,
          current: operatingTrendMetrics,
          urgentPendingCheckpointCount:
            sessionDashboardCounts.urgentPendingGlobal,
        })
      : {
          trendPhrases: [] as string[],
          disciplineCues: [] as string[],
          memoryLines: [] as string[],
        };

  const persistenceAwarenessLines =
    operatingTrendMetrics != null
      ? derivePersistentPressureAwareness({
          previous: prevBookOperatingSnapshot,
          current: operatingTrendMetrics,
          urgentPendingCheckpointCount:
            sessionDashboardCounts.urgentPendingGlobal,
        })
      : [];

  const enhancedSessionOperatingNarrative =
    bookOperatingContext != null
      ? enhanceSessionOperatingNarrative(
          bookOperatingContext.sessionNarrative,
          operatingTrendDiscipline,
          { evolutionSummary: evolutionSummaryBook }
        )
      : null;

  const snapshotToPersist =
    operatingTrendMetrics != null
      ? buildNextOperatingSnapshot(
          prevBookOperatingSnapshot,
          operatingTrendMetrics
        )
      : null;

  const snapshotForPersistence =
    snapshotToPersist != null &&
    (prevBookOperatingSnapshot == null ||
      !bookOperatingSnapshotsMeaningfullyEqual(
        prevBookOperatingSnapshot,
        snapshotToPersist
      ))
      ? snapshotToPersist
      : null;

  const sinceLastVisitLines = mergeSinceLastVisitDisplayLines(
    operatingTrendDiscipline.trendPhrases,
    operatingTrendDiscipline.memoryLines,
    persistenceAwarenessLines,
    compactReview ? 2 : 3
  );

  let largestRiskPosition: { symbol: string; amount: number } | null = null;
  for (const t of trades) {
    if (t.status !== "OPEN") continue;
    const pk = openRowPackByTradeId.get(t.id);
    const amt = pk?.reviewDto.plannedCapitalAtRisk;
    if (amt == null || !Number.isFinite(amt)) continue;
    if (!largestRiskPosition || amt > largestRiskPosition.amount) {
      largestRiskPosition = {
        symbol: t.symbol.trim().toUpperCase(),
        amount: amt,
      };
    }
  }

  const sessionBriefing =
    portfolioStrip && reviewQueueModel
      ? buildSessionBriefing({
          activeOpenCount: portfolioStrip.activeOpenCount,
          urgentCount: reviewQueueModel.urgent.length,
          underPressureCount: portfolioStrip.underPressureCount,
          staleMarketOpenCount: portfolioStrip.staleMarketOpenCount,
          reviewsLoggedTodayCount:
            portfolioStrip.activeOpenCount -
            portfolioStrip.reviewsPendingTodayCount,
          plannedCapitalAtRiskTotal: portfolioStrip.plannedCapitalAtRiskTotal,
          partialRiskFigures: portfolioStrip.positionsPartialRiskFigures,
          largestRiskPosition,
        })
      : null;

  const focusTrade =
    sessionFocusId != null
      ? trades.find((t) => t.id === sessionFocusId)
      : undefined;
  const focusOpenPack =
    sessionFocusId != null
      ? openRowPackByTradeId.get(sessionFocusId)
      : undefined;
  const focusContinuityLines =
    sessionFocusId != null &&
    focusTrade?.status === "OPEN" &&
    focusOpenPack != null
      ? buildReviewContinuityLines({
          now,
          checkedToday: checkedTodayTradeIds.has(sessionFocusId),
          lastCheckpointAt:
            latestHealthByTradeId.get(sessionFocusId)?.checkedAt ?? null,
          latestChecklist:
            latestHealthByTradeId.get(sessionFocusId)?.reviewChecklist ?? null,
          weekFlags: weeklyFlagsByTradeId.has(sessionFocusId)
            ? weeklyFlagsByTradeId.get(sessionFocusId)!
            : undefined,
        })
      : [];

  const totalActiveOpenForSession =
    portfolioStrip?.activeOpenCount ?? openTradeIds.length;

  const openCount = trades.filter((t) => t.status === "OPEN").length;
  const closedCount = trades.filter((t) => t.status === "CLOSED").length;

  return (
    <TradesLedgerPageShell
      tradeCount={trades.length}
      openCount={openCount}
      closedCount={closedCount}
    >
      <TradesLedgerDeck
        marketFreshness={marketFreshness}
        latestScan={latestScan}
        scanDelayedBackdrop={scanDelayedBackdrop}
        sessionBriefing={sessionBriefing}
        reviewQueueModel={reviewQueueModel}
        bookOperatingContext={bookOperatingContext}
        bookOperatingBalanceLines={bookOperatingBalanceLines}
        sinceLastVisitLines={sinceLastVisitLines}
        compactReview={compactReview}
        hasOpenTrades={hasOpenTrades}
        dbLoadError={dbLoadError}
        search={search}
        statusFilter={statusFilter}
        sortParam={params.sort}
        reviewSessionActive={reviewSessionActive}
        alignmentAnalysis={alignmentAnalysis}
        barsLoadFailed={marks.barsLoadFailed}
        tradesEmpty={trades.length === 0}
        ledgerTableItems={ledgerTableItems}
        openRowPackByTradeId={openRowPackByTradeId}
        latestCloseBySymbol={latestCloseBySymbol}
        expectedSessionDate={expectedSessionDate}
        checkedTodayTradeIds={checkedTodayTradeIds}
        now={now}
        sessionFocusId={sessionFocusId}
        reviewSessionQueueLength={reviewSessionQueue.length}
        reviewSessionChrome={
          reviewSessionActive && hasOpenTrades ? (
            <ReviewSessionChrome
              sessionQueueLength={reviewSessionQueue.length}
              focusOneBased={
                sessionFocusIndex >= 0 ? sessionFocusIndex + 1 : null
              }
              totalActiveOpen={totalActiveOpenForSession}
              reviewedTodayOpenCount={reviewedTodayOpenCount}
              urgentPendingGlobal={sessionDashboardCounts.urgentPendingGlobal}
              pendingCheckpointGlobal={
                sessionDashboardCounts.pendingCheckpointGlobal
              }
              pendingAheadInQueue={sessionDashboardCounts.pendingAheadInQueue}
              sessionQuietLines={sessionQuietLines}
              sessionOperatingNarrative={
                enhancedSessionOperatingNarrative ??
                  bookOperatingContext?.sessionNarrative ??
                  null
              }
              prevId={sessionPrevId}
              nextId={sessionNextId}
            />
          ) : null
        }
        focusReviewWorkspace={
          reviewSessionActive &&
          hasOpenTrades &&
          reviewSessionQueue.length > 0 &&
          sessionFocusId != null &&
          focusTrade != null &&
          focusTrade.status === "OPEN" &&
          focusOpenPack != null ? (
            <FocusReviewWorkspace
              tradeId={focusTrade.id}
              symbol={focusTrade.symbol.trim().toUpperCase()}
              priorityTier={focusOpenPack.priorityTier}
              reviewDto={focusOpenPack.reviewDto}
              reviewedToday={checkedTodayTradeIds.has(sessionFocusId)}
              continuityLines={focusContinuityLines}
              memoryLines={focusOpenPack.memoryLines}
              escalationCues={focusOpenPack.escalationCues}
              latestBar={focusOpenPack.derived.latestBar ?? null}
              queuePositionOneBased={sessionFocusIndex + 1}
              queueLength={reviewSessionQueue.length}
              reviewedTodayOpenCount={reviewedTodayOpenCount}
              pendingCheckpointGlobal={sessionDashboardCounts.pendingCheckpointGlobal}
              totalActiveOpen={totalActiveOpenForSession}
              operatingPostureLabel={
                OPERATING_POSTURE_TRADER_LABEL[focusOpenPack.operatingPosture]
              }
              postureExplainLines={focusOpenPack.postureExplainLines}
              latestOutcomeLabel={reviewOutcomeTraderLabel(
                focusOpenPack.latestReviewOutcome
              )}
              sessionPendingAheadInQueue={
                sessionDashboardCounts.pendingAheadInQueue
              }
              sessionQuietLines={sessionQuietLines}
              evolutionStateLabel={
                POSITION_EVOLUTION_TRADER_LABEL[focusOpenPack.positionEvolution]
              }
              evolutionExplainLine={focusOpenPack.positionEvolutionLine}
            />
          ) : null
        }
        operatingSnapshotPersist={
          <OperatingSnapshotPersist snapshot={snapshotForPersistence} />
        }
      />
    </TradesLedgerPageShell>
  );
}
