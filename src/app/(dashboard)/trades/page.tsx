import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TradeFilters } from "./trade-filters";
import { formatVND, formatEquityThousandVndPerShare, formatBarDataDateUtcLong } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import {
  fetchBarCloseOnOrBeforeReviewBatch,
  fetchLatestTwoClosesByTradeSymbols,
  formatSignedPct,
  type LatestTwoCloseBars,
  utcStockBarCutoffDate,
} from "@/lib/trades/unrealized-from-close";
import { loadOpenPositionMarks } from "@/lib/trades/position-health";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { MarketDataAlignmentBanner } from "@/components/market-data-alignment-banner";
import { PageHeader } from "@/components/shell/page-header";
import { deriveTradesLedgerRowFields } from "@/lib/trades/trades-ledger-row-derived";
import { TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE } from "@/lib/trades/price-unit-guard";
import {
  buildOpenPositionReviewDto,
  type LatestTradeHealthLog,
  type OpenPositionReviewDto,
} from "@/lib/trades/open-position-intelligence";
import {
  displayScanQualityTier,
  displayTradeDirection,
  displayTradeStatus,
} from "@/lib/trading-display-labels";
import { aggregateOpenPortfolioReviewStrip } from "@/lib/trades/eod-review-workflow";
import {
  deriveOperatingPosture,
  OPERATING_POSTURE_TRADER_LABEL,
  type OperatingPosture,
} from "@/lib/trades/operating-posture";
import {
  parseHealthReviewLogPayload,
  reviewOutcomeTraderLabel,
  type ReviewOutcomeId,
} from "@/lib/trades/review-outcome";
import {
  buildOpenLedgerReviewOrder,
  buildReviewMemoryLines,
  buildReviewQueueModel,
  classifyReviewPriorityTier,
  compareOpenLedgerReviewOrder,
  deterioratedVsLastReviewBar,
  type ReviewPriorityTier,
  type ReviewQueueSymbol,
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
  type PositionEvolutionState,
} from "@/lib/trades/position-state-evolution";
import { OperatingSnapshotPersist } from "./operating-snapshot-persist";
import { OpenPositionReviewCell } from "./open-position-review-cell";
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

function formatQuantityCell(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(q);
}

function formatSignedVnd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const s = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    Math.abs(value)
  );
  return `${sign}${s}k ₫`;
}

function formatRMultiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function ReviewQueueSymbolLinks({ items }: { items: ReviewQueueSymbol[] }) {
  if (items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
      {items.map((s, i) => (
        <span key={s.tradeId} className="inline-flex items-center gap-1">
          {i > 0 ? (
            <span style={{ color: "var(--text-muted)" }} aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            href={`/trades/${s.tradeId}`}
            className="mono font-semibold text-[13px] underline-offset-2 hover:underline"
            style={{ color: "var(--accent-text)" }}
          >
            {s.symbol}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Mirrors filters layout — Suspense fallback while client filters hydrate (`useSearchParams`). */
function TradeFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="skeleton h-10 flex-1 rounded-lg sm:max-w-xs" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-36 rounded-lg" />
      <div className="skeleton h-10 w-40 rounded-lg" />
    </div>
  );
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

  const [trades, marketSnapshot] = await Promise.all([
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
  ]);

  const alignmentAnalysis = analyzeMarketDataAlignment(marketSnapshot);

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

  type OpenRowPack = {
    derived: ReturnType<typeof deriveTradesLedgerRowFields>;
    reviewDto: OpenPositionReviewDto;
    priorityTier: ReviewPriorityTier;
    sortKey: ReturnType<typeof buildOpenLedgerReviewOrder>;
    memoryLines: string[];
    escalationCues: string[];
    latestReviewOutcome: ReviewOutcomeId | null;
    operatingPosture: OperatingPosture;
    postureExplainLines: string[];
    positionEvolution: PositionEvolutionState;
    positionEvolutionLine: string | null;
  };
  const openRowPackByTradeId = new Map<string, OpenRowPack>();
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatBarSessionDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
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

  return (
    <div className="page-container animate-in">
      <div className="mb-6">
        <PageHeader
          title="Trades"
          subtitle={`${trades.length} trade${trades.length !== 1 ? "s" : ""}`}
          actions={
            <Link href="/trades/new" className="btn btn-primary" data-testid="trades-log-trade-cta">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Log Trade
            </Link>
          }
        />
        <p className="sr-only" data-testid="trades-header-count">
          {trades.length} trade{trades.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessionBriefing && hasOpenTrades && !compactReview ? (
        <div
          className="card mt-4 border px-4 py-3"
          data-testid="trades-session-briefing"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Today&apos;s briefing
          </div>
          <ul
            className="mt-2 list-none space-y-1 text-[13px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {sessionBriefing.lines.map((line, bi) => (
              <li key={`brief-${bi}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
          {sessionBriefing.partialRiskFigures ? (
            <p
              className="mt-2 text-[10px] leading-snug"
              style={{ color: "var(--text-muted)" }}
            >
              Risk sum excludes rows without a valid planned stop.
            </p>
          ) : null}
        </div>
      ) : null}

      {reviewQueueModel && hasOpenTrades ? (
        <div
          className="card mt-4 border px-4 py-3"
          data-testid="trades-review-queue"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            {compactReview ? "Review queue" : "Review queue · daily bar context"}
          </div>
          <dl className="mt-2 space-y-2 text-[13px]">
            {reviewQueueModel.urgent.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt
                  className="font-semibold tabular-nums"
                  style={{ color: "#9a3412" }}
                >
                  {reviewQueueModel.urgent.length} urgent
                </dt>
                <dd style={{ color: "var(--text-secondary)" }}>
                  <ReviewQueueSymbolLinks items={reviewQueueModel.urgent} />
                </dd>
              </div>
            ) : null}
            {reviewQueueModel.highAttention.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt
                  className="font-semibold tabular-nums"
                  style={{ color: "#854d0e" }}
                >
                  {reviewQueueModel.highAttention.length} high attention
                </dt>
                <dd style={{ color: "var(--text-secondary)" }}>
                  <ReviewQueueSymbolLinks
                    items={reviewQueueModel.highAttention}
                  />
                </dd>
              </div>
            ) : null}
            {reviewQueueModel.routinePending.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt
                  className="font-semibold tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {reviewQueueModel.routinePending.length} routine reviews
                  pending
                </dt>
                <dd style={{ color: "var(--text-secondary)" }}>
                  <ReviewQueueSymbolLinks
                    items={reviewQueueModel.routinePending}
                  />
                </dd>
              </div>
            ) : null}
            {reviewQueueModel.staleMarket.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt
                  className="font-semibold tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {reviewQueueModel.staleMarket.length} stale market data
                </dt>
                <dd style={{ color: "var(--text-secondary)" }}>
                  <ReviewQueueSymbolLinks
                    items={reviewQueueModel.staleMarket}
                  />
                </dd>
              </div>
            ) : null}
          </dl>
          {!reviewQueueModel.urgent.length &&
          !reviewQueueModel.highAttention.length &&
          !reviewQueueModel.routinePending.length &&
          !reviewQueueModel.staleMarket.length ? (
            <p
              className="mt-2 text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              Nothing flagged in the queue — quick-scan open rows below.
            </p>
          ) : null}
          {!compactReview ? (
            <p
              className="mt-2 text-[10px] leading-snug"
              style={{ color: "var(--text-muted)" }}
            >
              Open rows sort for review: stop urgency · proximity to stress · drift
              vs last checkpoint · stale data or pending log · planned capital at
              risk · symbol.
            </p>
          ) : (
            <p
              className="mt-2 text-[10px] leading-snug"
              style={{ color: "var(--text-muted)" }}
            >
              Same sort as briefing — expand filters for full legend.
            </p>
          )}
        </div>
      ) : null}

      {bookOperatingContext && hasOpenTrades ? (
        <div
          className="card mt-4 border px-4 py-3"
          data-testid="book-operating-context"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Book operating context
          </div>
          <p
            className="mt-2 text-[13px] font-medium leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {bookOperatingContext.headline}
          </p>
          {bookOperatingContext.detailLines.length > 0 ? (
            <ul
              className="mt-2 list-none space-y-1 text-[12px] leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              {(compactReview
                ? bookOperatingContext.detailLines.slice(0, 1)
                : bookOperatingContext.detailLines
              ).map((line, li) => (
                <li key={`book-ctx-${li}-${line.slice(0, 28)}`}>{line}</li>
              ))}
            </ul>
          ) : null}
          {!compactReview &&
          (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
            <>
              {bookOperatingBalanceLines.length > 0 ? (
                <>
                  <div
                    className="mt-3 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Operating balance
                  </div>
                  <ul
                    className="mt-1 list-none space-y-1 text-[11px] leading-snug"
                    style={{ color: "var(--text-muted)" }}
                    data-testid="book-operating-balance-lines"
                  >
                    {bookOperatingBalanceLines.map((line, li) => (
                      <li key={`book-bal-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {sinceLastVisitLines.length > 0 ? (
                <>
                  <div
                    className="mt-3 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Since last ledger visit
                  </div>
                  <ul
                    className="mt-1 list-none space-y-1 text-[11px] leading-snug"
                    style={{ color: "var(--text-muted)" }}
                    data-testid="book-operating-trend-lines"
                  >
                    {sinceLastVisitLines.map((line, li) => (
                      <li key={`book-trend-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : null}
          {compactReview &&
          (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
            <details
              className="mt-2 group"
              data-testid="book-visit-delta-collapsed"
            >
              <summary
                className="cursor-pointer list-none text-[10px] font-medium uppercase tracking-wide underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden"
                style={{ color: "var(--text-tertiary)" }}
              >
                Visit delta & balance
              </summary>
              <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
                {bookOperatingBalanceLines.length > 0 ? (
                  <ul
                    className="list-none space-y-1 text-[11px] leading-snug"
                    style={{ color: "var(--text-muted)" }}
                    data-testid="book-operating-balance-lines"
                  >
                    {bookOperatingBalanceLines.slice(0, 1).map((line, li) => (
                      <li key={`book-bal-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {sinceLastVisitLines.length > 0 ? (
                  <ul
                    className="list-none space-y-1 text-[11px] leading-snug"
                    style={{ color: "var(--text-muted)" }}
                    data-testid="book-operating-trend-lines"
                  >
                    {sinceLastVisitLines.map((line, li) => (
                      <li key={`book-trend-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {dbLoadError ? (
        <div
          role="alert"
          className="card mt-4 border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {dbLoadError}
        </div>
      ) : null}

      <Suspense fallback={<TradeFiltersSkeleton />}>
        <TradeFilters
          currentSearch={search}
          currentStatus={statusFilter}
          currentSort={params.sort || "newest"}
          currentCompactReview={compactReview}
          currentReviewSession={reviewSessionActive}
        />
      </Suspense>

      {reviewSessionActive && hasOpenTrades ? (
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
      ) : null}

      {reviewSessionActive &&
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
      ) : null}

      {alignmentAnalysis.showBanner ? (
        <MarketDataAlignmentBanner
          analysis={alignmentAnalysis}
          mentionOpenPositionMarks={hasOpenTrades}
        />
      ) : null}

      {marks.barsLoadFailed && hasOpenTrades ? (
        <div
          role="status"
          className="card mt-4 border px-4 py-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Latest closes could not be loaded. Open-position marks may be
            incomplete until bars load.
          </p>
        </div>
      ) : null}

      {trades.length === 0 ? (
        <div className="card mt-4">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div className="empty-state-title">
              {search || statusFilter ? "No matching trades" : "No trades yet"}
            </div>
            <div className="empty-state-description">
              {search || statusFilter
                ? "Try adjusting your search or filters."
                : "Log your first trade to start tracking your performance."}
            </div>
            {!search && !statusFilter && (
              <Link href="/trades/new" className="btn btn-primary mt-6">
                Log Your First Trade
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
            data-testid="trades-ledger-scroll-hint"
          >
            Scroll horizontally for the full ledger. The Symbol column stays pinned while you
            scroll.
          </p>
          <p
            className="mt-1 text-[11px] leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            Equity prices in this table are{" "}
            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
              thousand VND per share
            </span>{" "}
            (imported EOD). P&amp;L uses the same numeric scale × quantity.
          </p>
          <div
            className="table-container table-sticky trades-ledger-scroll mt-2"
            data-testid="trades-scroll-container"
          >
          <table className="table min-w-[1840px]" data-testid="trades-table">
            <thead data-testid="trades-table-header">
              <tr>
                <th className="ledger-sticky-symbol">Symbol</th>
                <th>Setup</th>
                <th>Direction</th>
                <th>Playbook</th>
                <th>Status</th>
                <th>Position &amp; review</th>
                <th className="table-num">Hold</th>
                <th>Entry Date</th>
                <th className="table-num">
                  <span className="block">Entry</span>
                  <span
                    className="block text-[10px] font-normal font-sans normal-case"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (1000 ₫)
                  </span>
                </th>
                <th className="table-num">
                  <span className="block">Session mark</span>
                  <span
                    className="block text-[10px] font-normal font-sans normal-case"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Open: EOD · Closed: exit
                  </span>
                </th>
                <th className="table-num">Qty</th>
                <th className="table-num">R</th>
                <th className="table-num">
                  <span className="block">Stop dist.</span>
                  <span
                    className="block text-[10px] font-normal font-sans normal-case"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (1000 ₫)
                  </span>
                </th>
                <th className="table-num">
                  <span className="block">TP dist.</span>
                  <span
                    className="block text-[10px] font-normal font-sans normal-case"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (1000 ₫)
                  </span>
                </th>
                <th className="table-num">P&amp;L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ledgerTableItems.map((item, rowIndex) => {
                if (
                  item !== null &&
                  typeof item === "object" &&
                  "kind" in item &&
                  item.kind === "divider"
                ) {
                  return (
                    <tr
                      key={`cluster-divider-${rowIndex}-${item.label}`}
                      data-testid="trades-cluster-divider"
                      aria-hidden="true"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                      }}
                    >
                      <td colSpan={16} className="py-1.5 pl-3">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {item.label}
                        </span>
                      </td>
                    </tr>
                  );
                }
                const trade = item as (typeof trades)[number];
                const openPack = openRowPackByTradeId.get(trade.id);
                const ledgerCtxInner = {
                  latestCloseBySymbol,
                  expectedSessionDate,
                  checkedTodayTradeIds,
                  now,
                };
                const {
                  latestBar,
                  unrealized,
                  priceUnitMismatch,
                  holdingDays,
                  rMultiple,
                  distanceToStop,
                  distanceToTakeProfit,
                } =
                  openPack?.derived ??
                  deriveTradesLedgerRowFields(
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
                    ledgerCtxInner
                  );

                const reviewDto =
                  trade.status === "OPEN" ? (openPack?.reviewDto ?? null) : null;

                const isSessionFocusRow =
                  reviewSessionActive &&
                  trade.status === "OPEN" &&
                  sessionFocusId != null &&
                  trade.id === sessionFocusId;

                const rowHandledCalm =
                  trade.status === "OPEN" &&
                  openPack &&
                  checkedTodayTradeIds.has(trade.id) &&
                  openPack.priorityTier !== "urgent" &&
                  reviewDto != null &&
                  reviewDto.surface !== "stop_violated" &&
                  reviewDto.stopBand !== "breached";

                const dimNonFocusSessionRow =
                  reviewSessionActive &&
                  reviewSessionQueue.length > 0 &&
                  sessionFocusId != null &&
                  !isSessionFocusRow;

                const sessionRowOpacity = dimNonFocusSessionRow
                  ? trade.status === "OPEN"
                    ? 0.56
                    : 0.82
                  : 1;

                return (
                  <tr
                    key={trade.id}
                    data-testid="trades-table-row"
                    data-review-session-focus={
                      isSessionFocusRow ? "true" : undefined
                    }
                    style={{
                      opacity: sessionRowOpacity,
                      ...(isSessionFocusRow
                        ? {
                            outline:
                              "2px solid color-mix(in srgb, #0ea5e9 38%, var(--border-color))",
                            outlineOffset: "-1px",
                          }
                        : {}),
                      ...(rowHandledCalm
                        ? {
                            backgroundColor:
                              "color-mix(in srgb, #22c55e 7%, transparent)",
                          }
                        : {}),
                    }}
                  >
                    <td className="ledger-sticky-symbol">
                      <span
                        className="mono font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {trade.symbol}
                      </span>
                      {priceUnitMismatch ? (
                        <span
                          className="mt-1 block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            borderColor: "color-mix(in srgb, #f97316 45%, var(--border-color))",
                            color: "#9a3412",
                          }}
                        >
                          Unit check needed
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {trade.setupCandidate ? (
                        <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                          {displayScanQualityTier(trade.setupCandidate.quality)} ·{" "}
                          {formatPlaybookLabel(trade.setupCandidate.setupType)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>
                          Manual
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          trade.direction === "LONG"
                            ? "badge-long"
                            : "badge-short"
                        }`}
                      >
                        {displayTradeDirection(trade.direction)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {formatPlaybookLabel(trade.playbook)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${trade.status.toLowerCase()}`}
                      >
                        {displayTradeStatus(trade.status)}
                      </span>
                    </td>
                    <td className="align-top">
                      {trade.status === "OPEN" && reviewDto && openPack ? (
                        <OpenPositionReviewCell
                          tradeId={trade.id}
                          compact={
                            compactReview ||
                            (reviewSessionActive && !isSessionFocusRow)
                          }
                          priorityTier={openPack.priorityTier}
                          escalationCues={openPack.escalationCues}
                          memoryLines={openPack.memoryLines}
                          reviewDto={reviewDto}
                          reviewedToday={checkedTodayTradeIds.has(trade.id)}
                          latestBar={latestBar ?? null}
                          formatBarSessionDate={formatBarSessionDate}
                          sessionMode={reviewSessionActive}
                          sessionFocused={Boolean(isSessionFocusRow)}
                          operatingPostureLabel={
                            OPERATING_POSTURE_TRADER_LABEL[
                              openPack.operatingPosture
                            ]
                          }
                          latestOutcomeLabel={reviewOutcomeTraderLabel(
                            openPack.latestReviewOutcome
                          )}
                          evolutionStateLabel={
                            POSITION_EVOLUTION_TRADER_LABEL[
                              openPack.positionEvolution
                            ]
                          }
                          evolutionExplainLine={openPack.positionEvolutionLine}
                          compactReviewMode={compactReview}
                        />
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="mono table-num">
                      {holdingDays != null ? holdingDays : "—"}
                    </td>
                    <td className="mono">{formatDate(trade.entryDate)}</td>
                    <td className="mono table-num">
                      {Number.isFinite(trade.entryPrice) &&
                      trade.entryPrice > 0 ? (
                        formatEquityThousandVndPerShare(trade.entryPrice)
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="mono table-num">
                      {trade.status === "OPEN" ? (
                        latestBar ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span style={{ color: "var(--text-secondary)" }}>
                              Latest close:{" "}
                              {formatEquityThousandVndPerShare(latestBar.close)}
                            </span>
                            <span
                              className="text-[11px] font-normal normal-case"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Data date:{" "}
                              {formatBarDataDateUtcLong(latestBar.date)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )
                      ) : trade.exitPrice !== null &&
                        Number.isFinite(trade.exitPrice) ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span style={{ color: "var(--text-secondary)" }}>
                            Exit price:{" "}
                            {formatEquityThousandVndPerShare(trade.exitPrice)}
                          </span>
                          {trade.exitDate ? (
                            <span
                              className="text-[11px] font-normal normal-case"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Exit date:{" "}
                              {formatBarDataDateUtcLong(trade.exitDate)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono table-num">
                      {formatQuantityCell(trade.quantity)}
                    </td>
                    <td className="mono table-num text-xs">
                      {trade.status === "OPEN" ? formatRMultiple(rMultiple) : "—"}
                    </td>
                    <td className="mono table-num text-xs align-top">
                      {trade.status === "OPEN" ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatSignedVnd(distanceToStop)}</span>
                          {reviewDto?.cushionPctDisplay ? (
                            <span
                              className="text-[10px] font-normal normal-case tabular-nums"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {reviewDto.cushionPctDisplay}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono table-num text-xs">
                      {trade.status === "OPEN"
                        ? formatSignedVnd(distanceToTakeProfit)
                        : "—"}
                    </td>
                    <td className="table-num align-top">
                      {trade.status === "OPEN" ? (
                        latestBar ? (
                          <div
                            className="flex flex-col items-end gap-0.5 text-[13px] font-normal opacity-95"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wide"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Unrealized
                            </span>
                            <span
                              className="max-w-[14rem] text-right text-[10px] leading-snug"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Long bias: (latest close − entry) × qty. Short bias: (entry − latest
                              close) × qty. Same price units as entry (thousand ₫ per share).
                              {latestBar ? (
                                <>
                                  {" "}
                                  Data date: {formatBarDataDateUtcLong(latestBar.date)}.
                                </>
                              ) : null}
                            </span>
                            {priceUnitMismatch ? (
                              <>
                                <span
                                  className="text-left text-[11px] font-medium leading-snug"
                                  style={{ color: "#9a3412" }}
                                >
                                  Unit check needed — unrealized P&amp;L not shown as valid.
                                </span>
                                <span
                                  className="max-w-[16rem] text-right text-[10px] leading-snug"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE}
                                </span>
                                <span className="mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  Entry (raw): {trade.entryPrice.toFixed(4)} · Latest close (raw):{" "}
                                  {latestBar.close.toFixed(4)}
                                </span>
                              </>
                            ) : unrealized?.pnlAmount != null ? (
                              <span
                                className="mono"
                                style={{
                                  color:
                                    unrealized.pnlAmount >= 0
                                      ? "var(--pnl-positive)"
                                      : "var(--pnl-negative)",
                                }}
                              >
                                {unrealized.pnlAmount > 0 ? "+" : ""}
                                {formatVND(unrealized.pnlAmount, false)}
                              </span>
                            ) : (
                              <span
                                className="mono"
                                style={{ color: "var(--text-muted)" }}
                              >
                                —
                              </span>
                            )}
                            {priceUnitMismatch ? (
                              <span className="mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                                Raw % (do not use): {formatSignedPct(unrealized?.pnlPct ?? null)}
                              </span>
                            ) : (
                              <span
                                className="mono text-[12px]"
                                style={{
                                  color:
                                    unrealized?.pnlPct != null
                                      ? unrealized.pnlPct >= 0
                                        ? "var(--pnl-positive)"
                                        : "var(--pnl-negative)"
                                      : "var(--text-muted)",
                                }}
                              >
                                {formatSignedPct(unrealized?.pnlPct ?? null)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )
                      ) : trade.realizedPnl !== null ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Realized
                          </span>
                          <span
                            className="mono font-medium text-sm"
                            style={{
                              color:
                                trade.realizedPnl >= 0
                                  ? "var(--pnl-positive)"
                                  : "var(--pnl-negative)",
                            }}
                          >
                            {trade.realizedPnl > 0 ? "+" : ""}
                            {formatVND(trade.realizedPnl, false)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/trades/${trade.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <OperatingSnapshotPersist snapshot={snapshotForPersistence} />
    </div>
  );
}
