import type { Metadata } from "next";
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

        <div className="card p-6">
          <TradeForm trade={trade} />
        </div>
      </div>
    </div>
  );
}
