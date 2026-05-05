import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { DeleteTradeButton } from "./delete-button";
import { formatVND } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";

export const metadata: Metadata = {
  title: "Trade Details — TradeLog",
};

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

  const latestOutcome = trade.setupOutcomes[0] ?? null;
  const showWritebackCard =
    trade.status === "OPEN" || trade.status === "CLOSED";
  let healthLogsDesc: TradeHealthLogRow[] = [];
  try {
    const raw = await prisma.$queryRawUnsafe<
      Array<{
        checked_at: Date;
        health_level: string | null;
        price_vs_zone: string | null;
        structure_status: string | null;
        recommended_action: string | null;
      }>
    >(
      `SELECT checked_at, health_level, price_vs_zone, structure_status, recommended_action
       FROM trade_health_logs
       WHERE trade_id = $1
       ORDER BY checked_at DESC
       LIMIT 20`,
      trade.id
    );
    healthLogsDesc = raw.map((r) => ({
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
    }));
  } catch {
    // Keep read-only UI resilient if logs table/model isn't present in this environment yet.
    healthLogsDesc = [];
  }
  const healthLogs = [...healthLogsDesc].reverse();

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
              · {trade.direction.toLowerCase()} · {trade.status.toLowerCase()}
              {" · "}
              {formatPlaybookLabel(trade.playbook)}
              {trade.setupCandidate ? (
                <>
                  {" · "}
                  setup {trade.setupCandidate.quality}/{trade.setupCandidate.setupType}
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <TradeForm trade={trade} />
        </div>
      </div>
    </div>
  );
}
