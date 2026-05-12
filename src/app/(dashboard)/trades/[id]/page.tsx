import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { DeleteTradeButton } from "./delete-button";
import {
  formatVND,
  formatEquityThousandVndPerShare,
  formatBarDataDateUtcLong,
} from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import { addTradeHealthCheckpoint } from "@/app/actions/trades";
import {
  computeUnrealizedFromLatestClose,
  formatSignedPct,
} from "@/lib/trades/unrealized-from-close";
import {
  computeOpenPhase2Metrics,
  computeDisplayHoldingDaysUtc,
  equityBarStaleVsBenchmark,
  loadOpenPositionMarks,
} from "@/lib/trades/position-health";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { MarketDataAlignmentBanner } from "@/components/market-data-alignment-banner";
import {
  detectTradePriceUnitMismatch,
  TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE,
} from "@/lib/trades/price-unit-guard";
import {
  displayScanQualityTier,
  displayTradeDirection,
  displayTradeStatus,
} from "@/lib/trading-display-labels";
import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";
import {
  parseHealthReviewLogPayload,
  REVIEW_OUTCOME_IDS,
  REVIEW_OUTCOME_TRADER_LABEL,
  type ReviewOutcomeId,
} from "@/lib/trades/review-outcome";

export const metadata: Metadata = {
  title: "Trade Details — TradeLog",
};

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

interface TradeDetailPageProps {
  params: Promise<{ id: string }>;
}

type TradeHealthLevel = "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD";

type TradeHealthLogRow = {
  checkedAt: Date;
  healthLevel: TradeHealthLevel | null;
  priceVsZone: string | null;
  structureStatus: string | null;
  recommendedAction: string | null;
  reviewChecklist: EodReviewChecklistState | null;
  reviewOutcome: ReviewOutcomeId | null;
};

const HEALTH_RANK: Record<TradeHealthLevel, number> = {
  HEALTHY: 0,
  WARNING: 1,
  AT_RISK: 2,
  DEAD: 3,
};

function levelPillStyle(level: TradeHealthLevel | null): CSSProperties {
  switch (level) {
    case "HEALTHY":
      return { backgroundColor: "color-mix(in srgb, #22c55e 18%, transparent)", color: "#166534" };
    case "WARNING":
      return { backgroundColor: "color-mix(in srgb, #eab308 22%, transparent)", color: "#854d0e" };
    case "AT_RISK":
      return { backgroundColor: "color-mix(in srgb, #f97316 22%, transparent)", color: "#9a3412" };
    case "DEAD":
      return { backgroundColor: "color-mix(in srgb, #ef4444 20%, transparent)", color: "#991b1b" };
    default:
      return { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" };
  }
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const trade = await prisma.trade.findFirst({
    where: { id, userId: session.userId },
    include: {
      setupCandidate: {
        select: {
          id: true,
          setupType: true,
          quality: true,
          symbol: { select: { symbol: true } },
        },
      },
      setupOutcomes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!trade) {
    notFound();
  }

  const now = new Date();

  const symKey = trade.symbol.trim().toUpperCase();
  const positionMarks =
    trade.status === "OPEN"
      ? await loadOpenPositionMarks(prisma, [symKey])
      : null;

  const latestCloseSnap =
    trade.status === "OPEN"
      ? positionMarks?.latestCloseBySymbol.get(symKey) ?? null
      : null;

  const priceUnitMismatch =
    trade.status === "OPEN"
      ? detectTradePriceUnitMismatch(trade.entryPrice, latestCloseSnap?.close ?? null)
      : false;

  const unrealizedLive =
    latestCloseSnap != null
      ? computeUnrealizedFromLatestClose({
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          quantity: trade.quantity,
          latestClose: latestCloseSnap.close,
        })
      : null;

  const expectedSessionDate =
    trade.status === "OPEN" ? positionMarks?.expectedSessionDate ?? null : null;
  const barStaleState =
    trade.status === "OPEN" && latestCloseSnap != null
      ? equityBarStaleVsBenchmark(latestCloseSnap.date, expectedSessionDate)
      : null;

  const holdingDaysDisplay =
    trade.status === "CANCELLED"
      ? null
      : computeDisplayHoldingDaysUtc({
          status: trade.status,
          entryDate: trade.entryDate,
          exitDate: trade.exitDate,
          now,
        });

  const phase2Metrics = computeOpenPhase2Metrics({
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    latestClose:
      priceUnitMismatch || latestCloseSnap == null ? null : latestCloseSnap.close,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
  });

  const latestOutcome = trade.setupOutcomes[0] ?? null;
  const showWritebackCard =
    trade.status === "OPEN" || trade.status === "CLOSED";
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  let hasCheckpointToday = false;
  let healthLogsDesc: TradeHealthLogRow[] = [];
  try {
    const raw = await prisma.$queryRawUnsafe<
      Array<{
        checked_at: Date;
        health_level: string | null;
        price_vs_zone: string | null;
        structure_status: string | null;
        recommended_action: string | null;
        review_checklist: unknown | null;
      }>
    >(
      `SELECT checked_at, health_level, price_vs_zone, structure_status, recommended_action, review_checklist
       FROM trade_health_logs
       WHERE trade_id = $1
       ORDER BY checked_at DESC
       LIMIT 20`,
      trade.id
    );
    healthLogsDesc = raw.map((r) => {
      const payload = parseHealthReviewLogPayload(r.review_checklist);
      return {
        checkedAt: new Date(r.checked_at),
        healthLevel:
          r.health_level === "HEALTHY" ||
          r.health_level === "WARNING" ||
          r.health_level === "AT_RISK" ||
          r.health_level === "DEAD"
            ? r.health_level
            : null,
        priceVsZone: r.price_vs_zone,
        structureStatus: r.structure_status,
        recommendedAction: r.recommended_action,
        reviewChecklist: payload.checklist,
        reviewOutcome: payload.reviewOutcome,
      };
    });
    hasCheckpointToday = raw.some((r) => {
      const d = new Date(r.checked_at);
      return d >= dayStart && d <= dayEnd;
    });
  } catch {
    // Keep read-only UI resilient if logs table/model isn't present in this environment yet.
    healthLogsDesc = [];
    hasCheckpointToday = false;
  }
  const healthLogs = [...healthLogsDesc].reverse();

  const alignmentAnalysis =
    trade.status === "OPEN"
      ? analyzeMarketDataAlignment(await fetchMarketSessionSnapshot(prisma))
      : analyzeMarketDataAlignment({
          benchmarkSessionDate: null,
          latestEquityBarSessionDate: null,
          latestScanRunAt: null,
        });

  return (
    <div className="page-container animate-in">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Edit Trade
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span className="font-mono" style={{ color: "var(--accent-text)" }}>
                {trade.symbol}
              </span>{" "}
              · {displayTradeDirection(trade.direction)} · {displayTradeStatus(trade.status)}
              {" · "}
              {formatPlaybookLabel(trade.playbook)}
              {holdingDaysDisplay != null ? (
                <>
                  {" · "}
                  <span style={{ color: "var(--text-secondary)" }}>
                    Held {holdingDaysDisplay}{" "}
                    {holdingDaysDisplay === 1 ? "day" : "days"}
                  </span>
                </>
              ) : null}
              {trade.setupCandidate ? (
                <>
                  {" · "}
                  setup {displayScanQualityTier(trade.setupCandidate.quality)} /{" "}
                  {formatPlaybookLabel(trade.setupCandidate.setupType)}
                </>
              ) : null}
              {trade.realizedPnl !== null && (
                <>
                  {" · "}
                  <span
                    style={{
                      color:
                        trade.realizedPnl > 0
                          ? "var(--pnl-positive)"
                          : "var(--pnl-negative)",
                    }}
                  >
                    {trade.realizedPnl > 0 ? "+" : ""}
                    {formatVND(trade.realizedPnl, true)}
                  </span>
                </>
              )}
            </p>
          </div>

          <DeleteTradeButton tradeId={trade.id} />
        </div>

        {trade.status === "OPEN" && alignmentAnalysis.showBanner ? (
          <MarketDataAlignmentBanner
            analysis={alignmentAnalysis}
            mentionOpenPositionMarks
          />
        ) : null}

        {trade.status === "OPEN" && positionMarks?.barsLoadFailed ? (
          <div
            role="status"
            className="card mb-4 border px-4 py-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Latest close could not be loaded for this symbol.
            </p>
          </div>
        ) : null}

        {showWritebackCard ? (
          <div className="card mb-4 p-4">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Setup Outcome
            </div>
            {trade.status === "CLOSED" ? (
              trade.setupCandidate ? (
                latestOutcome ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p style={{ color: "var(--text-primary)" }}>
                      Outcome written back to setup learning.
                    </p>
                    <p style={{ color: "var(--text-secondary)" }}>
                      Outcome: <span className="font-medium">{latestOutcome.outcome ?? "N/A"}</span>
                      {" · "}
                      R multiple:{" "}
                      <span className="font-medium">
                        {latestOutcome.rMultiple != null ? latestOutcome.rMultiple.toFixed(2) : "N/A"}
                      </span>
                      {" · "}
                      Exit reason:{" "}
                      <span className="font-medium">{latestOutcome.exitReason ?? "N/A"}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Setup-linked trade closed, but outcome writeback is pending.
                  </p>
                )
              ) : (
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Manual trade — no setup learning link.
                </p>
              )
            ) : trade.setupCandidate ? (
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Will write outcome back when closed.
              </p>
            ) : (
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Manual trade — no setup learning link.
              </p>
            )}
          </div>
        ) : null}

        {trade.status === "OPEN" ? (
          <div className="card mb-4 p-4">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Active position (daily bars)
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Derived marks only — not saved on this trade. Diagnostic context,
              not an entry signal.
            </p>

            <div
              className="mt-4 flex flex-wrap gap-2 rounded-md border px-3 py-2"
              style={{
                borderColor: "var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
              }}
            >
              {hasCheckpointToday ? (
                <span
                  className="px-2 py-1 text-xs rounded-md border font-medium"
                  style={{
                    borderColor:
                      "color-mix(in srgb, #22c55e 35%, var(--border-color))",
                    backgroundColor:
                      "color-mix(in srgb, #22c55e 12%, transparent)",
                    color: "#166534",
                  }}
                >
                  Daily review logged today
                </span>
              ) : (
                <span
                  className="px-2 py-1 text-xs rounded-md border font-medium"
                  style={{
                    borderColor:
                      "color-mix(in srgb, #eab308 40%, var(--border-color))",
                    backgroundColor:
                      "color-mix(in srgb, #eab308 12%, transparent)",
                    color: "#854d0e",
                  }}
                >
                  Daily review not logged yet today
                </span>
              )}
              {latestCloseSnap ? (
                barStaleState === true ? (
                  <span
                    className="px-2 py-1 text-xs rounded-md border font-medium"
                    style={{
                      borderColor:
                        "color-mix(in srgb, #f97316 45%, var(--border-color))",
                      backgroundColor:
                        "color-mix(in srgb, #f97316 14%, transparent)",
                      color: "#9a3412",
                    }}
                  >
                    Stale vs benchmark (equity bar older than VNINDEX)
                  </span>
                ) : barStaleState === "unknown" ? (
                  <span
                    className="px-2 py-1 text-xs rounded-md border"
                    style={{
                      borderColor: "var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                    title="Cannot evaluate bar freshness — import or refresh VNINDEX daily bars."
                  >
                    Bar freshness unverified
                  </span>
                ) : (
                  <span
                    className="px-2 py-1 text-xs rounded-md border"
                    style={{
                      borderColor: "var(--border-color)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Equity bar date matches latest VNINDEX bar date
                  </span>
                )
              ) : (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  No equity bar — cannot assess freshness
                </span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Holding (UTC days)</dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {holdingDaysDisplay != null ? holdingDaysDisplay : "—"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Entry price (1000 ₫ / share)</dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {Number.isFinite(trade.entryPrice) && trade.entryPrice > 0
                    ? formatEquityThousandVndPerShare(trade.entryPrice)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Latest close (1000 ₫ / share)</dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {latestCloseSnap
                    ? formatEquityThousandVndPerShare(latestCloseSnap.close)
                    : "—"}
                </dd>
              </div>
              {latestCloseSnap ? (
                <div>
                  <dt style={{ color: "var(--text-muted)" }}>Data date (UTC)</dt>
                  <dd style={{ color: "var(--text-secondary)" }}>
                    {formatBarDataDateUtcLong(latestCloseSnap.date)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt style={{ color: "var(--text-muted)" }}>R multiple</dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {formatRMultiple(phase2Metrics.rMultiple)}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-muted)" }}>Distance to stop (1000 ₫ / share)</dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {formatSignedVnd(phase2Metrics.distanceToStop)}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-muted)" }}>
                  Distance to take profit (1000 ₫ / share)
                </dt>
                <dd className="mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {formatSignedVnd(phase2Metrics.distanceToTakeProfit)}
                </dd>
              </div>
            </dl>

            <div
              className="mt-4 border-t pt-3 text-[13px]"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-secondary)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Unrealized
              </div>
              <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                Long bias: (latest close − entry) × qty. Short bias: (entry − latest close) × qty.
                Same units as entry price (thousand ₫ per share).
                {latestCloseSnap ? (
                  <>
                    {" "}
                    Data date: {formatBarDataDateUtcLong(latestCloseSnap.date)}.
                  </>
                ) : null}
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <dt style={{ color: "var(--text-muted)" }}>Unrealized P&amp;L</dt>
                  <dd className="mono font-normal" style={{ color: "var(--text-muted)" }}>
                    {priceUnitMismatch ? (
                      <span className="block space-y-1 text-left text-xs font-normal normal-case">
                        <span className="font-medium" style={{ color: "#9a3412" }}>
                          Unit check needed
                        </span>
                        <span className="block leading-snug" style={{ color: "var(--text-secondary)" }}>
                          {TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE}
                        </span>
                        <span className="block font-mono text-[11px]">
                          Entry (raw): {trade.entryPrice.toFixed(4)} · Latest close (raw):{" "}
                          {latestCloseSnap ? latestCloseSnap.close.toFixed(4) : "—"}
                        </span>
                        <span className="block text-[11px]">
                          Raw amount (do not use):{" "}
                          {unrealizedLive?.pnlAmount != null
                            ? `${unrealizedLive.pnlAmount > 0 ? "+" : ""}${formatVND(unrealizedLive.pnlAmount, false)}`
                            : "—"}
                        </span>
                      </span>
                    ) : unrealizedLive?.pnlAmount != null ? (
                      <>
                        <span
                          style={{
                            color:
                              unrealizedLive.pnlAmount >= 0
                                ? "var(--pnl-positive)"
                                : "var(--pnl-negative)",
                          }}
                        >
                          {unrealizedLive.pnlAmount > 0 ? "+" : ""}
                          {formatVND(unrealizedLive.pnlAmount, false)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--text-muted)" }}>Unrealized %</dt>
                  <dd
                    className="mono font-normal"
                    style={{
                      color:
                        priceUnitMismatch
                          ? "var(--text-muted)"
                          : unrealizedLive?.pnlPct != null
                            ? unrealizedLive.pnlPct >= 0
                              ? "var(--pnl-positive)"
                              : "var(--pnl-negative)"
                            : "var(--text-muted)",
                    }}
                  >
                    {priceUnitMismatch ? (
                      <span>
                        Raw % (do not use): {formatSignedPct(unrealizedLive?.pnlPct ?? null)}
                      </span>
                    ) : (
                      formatSignedPct(unrealizedLive?.pnlPct ?? null)
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}

        <div className="card mb-4 p-4">
          <div
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Health Timeline
          </div>
          {healthLogs.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              No health checkpoints recorded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {healthLogs.map((log, idx) => {
                const prev = idx > 0 ? healthLogs[idx - 1] : null;
                const degraded =
                  prev?.healthLevel &&
                  log.healthLevel &&
                  HEALTH_RANK[log.healthLevel] > HEALTH_RANK[prev.healthLevel];
                const improved =
                  prev?.healthLevel &&
                  log.healthLevel &&
                  HEALTH_RANK[log.healthLevel] < HEALTH_RANK[prev.healthLevel];

                const extraParts = [log.priceVsZone, log.structureStatus].filter(
                  (x): x is string => Boolean(x && x.trim())
                );
                return (
                  <li
                    key={`${log.checkedAt.toISOString()}-${idx}`}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-primary)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                          .format(log.checkedAt)
                          .replace(",", " ·")}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                        style={levelPillStyle(log.healthLevel)}
                      >
                        {log.healthLevel ?? "N/A"}
                      </span>
                      {degraded ? (
                        <span className="text-xs" style={{ color: "var(--danger)" }}>
                          ↓ degraded
                        </span>
                      ) : improved ? (
                        <span className="text-xs" style={{ color: "var(--pnl-positive)" }}>
                          ↑ improved
                        </span>
                      ) : null}
                    </div>
                    {extraParts.length > 0 ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        ({extraParts.join(" · ")})
                      </p>
                    ) : null}
                    {log.recommendedAction ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        Action: {log.recommendedAction}
                      </p>
                    ) : null}
                    {log.reviewOutcome ? (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        Review outcome:{" "}
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {REVIEW_OUTCOME_TRADER_LABEL[log.reviewOutcome]}
                        </span>
                      </p>
                    ) : null}
                    {log.reviewChecklist ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {log.reviewChecklist.stopReviewed ? (
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
                        {log.reviewChecklist.structureReviewed ? (
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
                        {log.reviewChecklist.sizingReviewed ? (
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
                        {log.reviewChecklist.exitPlanReviewed ? (
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
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {trade.status === "OPEN" ? (
          <>
            <div className="card mb-4 p-4">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {hasCheckpointToday
                  ? "Health checkpoint recorded today."
                  : "Record today’s health checkpoint before market close."}
              </p>
            </div>

          <div className="card mb-4 p-4">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Add Health Checkpoint
            </div>
            <form
              action={addTradeHealthCheckpoint.bind(null, trade.id)}
              className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <div>
                <label htmlFor="healthLevel" className="label">
                  Health Level
                </label>
                <select id="healthLevel" name="healthLevel" className="select" required>
                  <option value="">Select level</option>
                  <option value="HEALTHY">HEALTHY</option>
                  <option value="WARNING">WARNING</option>
                  <option value="AT_RISK">AT_RISK</option>
                  <option value="DEAD">DEAD</option>
                </select>
              </div>
              <div>
                <label htmlFor="healthScore" className="label">
                  Health Score <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  id="healthScore"
                  name="healthScore"
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="priceVsZone" className="label">
                  Price vs Zone <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input id="priceVsZone" name="priceVsZone" type="text" className="input" />
              </div>
              <div>
                <label htmlFor="structureStatus" className="label">
                  Structure Status <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input id="structureStatus" name="structureStatus" type="text" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="recommendedAction" className="label">
                  Recommended Action <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input id="recommendedAction" name="recommendedAction" type="text" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="reviewOutcome" className="label">
                  Review outcome <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select id="reviewOutcome" name="reviewOutcome" className="select">
                  <option value="">None</option>
                  {REVIEW_OUTCOME_IDS.map((id) => (
                    <option key={id} value={id}>
                      {REVIEW_OUTCOME_TRADER_LABEL[id]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Your operational label for this checkpoint — not advice.
                </p>
              </div>
              <fieldset
                className="sm:col-span-2 space-y-2 rounded-md border px-3 py-2"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <legend className="px-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Review checklist (optional)
                </legend>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Lightweight reminders — not a workflow gate.
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="checkStopReviewed" />
                  Stop reviewed
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="checkStructureReviewed" />
                  Structure reviewed
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="checkSizingReviewed" />
                  Sizing reviewed
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="checkExitPlanReviewed" />
                  Exit plan reviewed
                </label>
              </fieldset>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-secondary btn-sm">
                  Save checkpoint
                </button>
              </div>
            </form>
          </div>
          </>
        ) : null}

        <div className="card p-6">
          <TradeForm trade={trade} />
        </div>
      </div>
    </div>
  );
}
