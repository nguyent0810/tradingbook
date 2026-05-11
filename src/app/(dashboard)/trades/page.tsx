import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TradeFilters } from "./trade-filters";
import { formatVND } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import {
  fetchBarCloseOnOrBeforeReviewBatch,
  fetchLatestTwoClosesByTradeSymbols,
  formatSignedPct,
  type LatestTwoCloseBars,
  utcStockBarCutoffDate,
} from "@/lib/trades/unrealized-from-close";
import {
  loadOpenPositionMarks,
  VNINDEX_FRESHNESS_UNAVAILABLE,
} from "@/lib/trades/position-health";
import { deriveTradesLedgerRowFields } from "@/lib/trades/trades-ledger-row-derived";
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
import { parseReviewChecklistJson } from "@/lib/trades/trade-health-review-checklist";
import {
  buildOpenLedgerReviewOrder,
  buildReviewMemoryLines,
  buildReviewQueueModel,
  classifyReviewPriorityTier,
  compareOpenLedgerReviewOrder,
  deterioratedVsLastReviewBar,
  reviewPriorityTraderLabel,
  type ReviewPriorityTier,
  type ReviewQueueSymbol,
  type WeeklyReviewChecklistAgg,
} from "@/lib/trades/review-priority-queue";

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
  }>;
}

function openReviewBadgeSkin(
  tone: OpenPositionReviewDto["badges"][number]["tone"]
): CSSProperties {
  switch (tone) {
    case "danger":
      return {
        borderColor: "color-mix(in srgb, #ef4444 45%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)",
        color: "#991b1b",
      };
    case "warn":
      return {
        borderColor: "color-mix(in srgb, #eab308 40%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #eab308 12%, transparent)",
        color: "#854d0e",
      };
    case "ok":
      return {
        borderColor: "color-mix(in srgb, #22c55e 35%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)",
        color: "#166534",
      };
    default:
      return {
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-secondary)",
      };
  }
}

function formatQuantityCell(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(q);
}

function formatSignedVnd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatVND(value, false)}`;
}

function formatRMultiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function priorityTierBadgeStyle(tier: ReviewPriorityTier): CSSProperties {
  switch (tier) {
    case "urgent":
      return {
        borderColor: "color-mix(in srgb, #ea580c 42%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #ea580c 11%, transparent)",
        color: "#9a3412",
      };
    case "high_attention":
      return {
        borderColor: "color-mix(in srgb, #ca8a04 38%, var(--border-color))",
        backgroundColor: "color-mix(in srgb, #eab308 10%, transparent)",
        color: "#854d0e",
      };
    case "routine_review":
      return {
        borderColor: "color-mix(in srgb, #64748b 35%, var(--border-color))",
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-secondary)",
      };
    default:
      return {
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-tertiary)",
        color: "var(--text-muted)",
      };
  }
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
    </div>
  );
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "";
  const sortOrder = params.sort === "oldest" ? "asc" : "desc";

  const where: Record<string, unknown> = { userId: session.userId };

  if (search) {
    where.symbol = { contains: search.toUpperCase(), mode: "insensitive" };
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  let dbLoadError: string | null = null;

  const trades = await (async () => {
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
  })();

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
        healthRows.map((r) => [
          r.trade_id,
          {
            healthLevel: r.health_level,
            structureStatus: r.structure_status,
            checkedAt: r.checked_at,
            reviewChecklist: parseReviewChecklistJson(r.review_checklist),
          } satisfies LatestTradeHealthLog,
        ])
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

    openRowPackByTradeId.set(trade.id, {
      derived,
      reviewDto,
      priorityTier,
      sortKey,
      memoryLines,
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
  const showFreshnessBanner =
    hasOpenTrades && expectedSessionDate === null;

  return (
    <div className="page-container animate-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Trades
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-tertiary)" }}
            data-testid="trades-header-count"
          >
            {trades.length} trade{trades.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Link href="/trades/new" className="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Log Trade
        </Link>
      </div>

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
            Review queue · daily bar context
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
          <p
            className="mt-2 text-[10px] leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            Open rows sort for review: stop urgency · proximity to stress · drift
            vs last checkpoint · stale data or pending log · planned capital at
            risk · symbol.
          </p>
        </div>
      ) : null}

      {portfolioStrip && hasOpenTrades ? (
        <div
          className="card mt-4 border px-4 py-3"
          data-testid="trades-portfolio-review-strip"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Open portfolio · daily bar context
          </div>
          <div
            className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.activeOpenCount}
              </span>{" "}
              active
            </span>
            <span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.underPressureCount}
              </span>{" "}
              under pressure
            </span>
            <span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.reviewsPendingTodayCount}
              </span>{" "}
              reviews pending today
            </span>
            <span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.staleMarketOpenCount}
              </span>{" "}
              stale market data
            </span>
            <span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.stopViolationsCount}
              </span>{" "}
              stop violations (daily close)
            </span>
            <span>
              Planned capital at risk (sum):{" "}
              <span
                className="mono font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {portfolioStrip.plannedCapitalAtRiskTotal != null ? (
                  formatVND(portfolioStrip.plannedCapitalAtRiskTotal, false)
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </span>
            </span>
          </div>
          {portfolioStrip.positionsPartialRiskFigures ? (
            <p
              className="mt-2 text-[10px] leading-snug"
              style={{ color: "var(--text-muted)" }}
            >
              Sum counts positions with a valid planned stop only; some open
              rows omit stop-based figures.
            </p>
          ) : null}
          <p
            className="mt-1 text-[10px] leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            End-of-day checkpoints only — not intraday execution advice.
          </p>
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
        />
      </Suspense>

      {showFreshnessBanner ? (
        <div
          role="alert"
          className="card mt-4 border px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, #eab308 45%, var(--border-color))",
            backgroundColor:
              "color-mix(in srgb, #eab308 8%, var(--bg-secondary))",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#854d0e" }}>
            {VNINDEX_FRESHNESS_UNAVAILABLE}
          </p>
        </div>
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
        <div className="table-container mt-4" data-testid="trades-scroll-container">
          <table className="table min-w-[1840px]" data-testid="trades-table">
            <thead data-testid="trades-table-header">
              <tr>
                <th>Symbol</th>
                <th>Setup</th>
                <th>Direction</th>
                <th>Playbook</th>
                <th>Status</th>
                <th>Position &amp; review</th>
                <th className="table-num">Hold</th>
                <th>Entry Date</th>
                <th className="table-num">Entry Price</th>
                <th className="table-num">Latest / Exit</th>
                <th className="table-num">Qty</th>
                <th className="table-num">R</th>
                <th className="table-num">Stop Dist</th>
                <th className="table-num">TP Dist</th>
                <th className="table-num">P&amp;L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayTrades.map((trade) => {
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

                return (
                  <tr key={trade.id} data-testid="trades-table-row">
                    <td>
                      <span
                        className="mono font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {trade.symbol}
                      </span>
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
                    <td>
                      <div className="flex max-w-[17rem] flex-col gap-1.5">
                        {trade.status === "OPEN" && reviewDto ? (
                          <>
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-md border"
                                style={priorityTierBadgeStyle(
                                  openPack!.priorityTier
                                )}
                              >
                                {reviewPriorityTraderLabel(
                                  openPack!.priorityTier
                                )}
                              </span>
                            </div>
                            {openPack!.memoryLines.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {openPack!.memoryLines.map((line, mi) => (
                                  <div
                                    key={`m-${mi}-${line.slice(0, 24)}`}
                                    className="text-[10px] leading-snug"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-1">
                              {reviewDto.badges.map((b) => (
                                <span
                                  key={b.key}
                                  className="w-fit px-2 py-0.5 text-[11px] font-medium rounded-md border"
                                  style={openReviewBadgeSkin(b.tone)}
                                >
                                  {b.label}
                                </span>
                              ))}
                            </div>
                            {reviewDto.focusHints.length > 0 ? (
                              <ul
                                className="list-disc space-y-0.5 pl-3.5 text-[10px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {reviewDto.focusHints.map((h, hi) => (
                                  <li key={`${hi}-${h.slice(0, 32)}`}>{h}</li>
                                ))}
                              </ul>
                            ) : null}
                            {reviewDto.sessionDeltaLine ? (
                              <div
                                className="text-[10px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {reviewDto.sessionDeltaLine}
                              </div>
                            ) : null}
                            {reviewDto.sinceReviewDeltaLine ? (
                              <div
                                className="text-[10px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {reviewDto.sinceReviewDeltaLine}
                              </div>
                            ) : null}
                            {reviewDto.latestChecklist ? (
                              <div className="flex flex-col gap-1">
                                {reviewDto.checklistSummaryLine ? (
                                  <div
                                    className="text-[10px] tabular-nums"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {reviewDto.checklistSummaryLine}
                                  </div>
                                ) : null}
                                <div className="flex flex-wrap gap-1">
                                  {reviewDto.latestChecklist.stopReviewed ? (
                                    <span
                                      className="rounded border px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        borderColor: "var(--border-color)",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Stop reviewed
                                    </span>
                                  ) : null}
                                  {reviewDto.latestChecklist.structureReviewed ? (
                                    <span
                                      className="rounded border px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        borderColor: "var(--border-color)",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Structure reviewed
                                    </span>
                                  ) : null}
                                  {reviewDto.latestChecklist.sizingReviewed ? (
                                    <span
                                      className="rounded border px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        borderColor: "var(--border-color)",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Sizing reviewed
                                    </span>
                                  ) : null}
                                  {reviewDto.latestChecklist.exitPlanReviewed ? (
                                    <span
                                      className="rounded border px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        borderColor: "var(--border-color)",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Exit plan reviewed
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            <div
                              className="text-[11px] leading-snug"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <span
                                className="font-medium"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {reviewDto.stopBandLabel}
                              </span>
                              {reviewDto.cushionPctDisplay ? (
                                <>
                                  {" · "}
                                  <span className="tabular-nums">
                                    {reviewDto.cushionPctDisplay}
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {reviewDto.plannedCapitalAtRisk != null ? (
                              <div
                                className="text-[11px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Planned capital at risk:{" "}
                                <span
                                  className="mono font-medium"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {formatVND(reviewDto.plannedCapitalAtRisk, false)}
                                </span>
                              </div>
                            ) : null}
                            {reviewDto.setupValidityLine ? (
                              <div
                                className="text-[11px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Setup snapshot: {reviewDto.setupValidityLine}
                              </div>
                            ) : null}
                            <p
                              className="text-[10px] leading-snug line-clamp-3"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {reviewDto.headline}
                            </p>
                            {latestBar ? (
                              <div
                                className="text-[10px]"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Latest bar: {formatBarSessionDate(latestBar.date)}
                              </div>
                            ) : (
                              <div
                                className="text-[10px]"
                                style={{ color: "var(--text-muted)" }}
                              >
                                No equity bar loaded.
                              </div>
                            )}
                            <div
                              className="text-[9px] uppercase tracking-wide"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Daily bar only · not intraday execution advice
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="mono table-num">
                      {holdingDays != null ? holdingDays : "—"}
                    </td>
                    <td className="mono">{formatDate(trade.entryDate)}</td>
                    <td className="mono table-num">
                      {Number.isFinite(trade.entryPrice) &&
                      trade.entryPrice > 0 ? (
                        formatVND(trade.entryPrice, false)
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="mono table-num">
                      {trade.status === "OPEN" ? (
                        latestBar ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span>
                              Close {formatVND(latestBar.close, false)}
                            </span>
                            <span
                              className="text-[11px] font-normal normal-case"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {formatBarSessionDate(latestBar.date)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )
                      ) : trade.exitPrice !== null &&
                        Number.isFinite(trade.exitPrice) ? (
                        formatVND(trade.exitPrice, false)
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
                              close) × qty. Same price units as entry.
                              {latestBar ? (
                                <>
                                  {" "}
                                  Session: {formatBarSessionDate(latestBar.date)}.
                                </>
                              ) : null}
                            </span>
                            {unrealized?.pnlAmount != null ? (
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
      )}
    </div>
  );
}
