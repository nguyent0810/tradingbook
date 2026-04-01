import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { DeleteTradeButton } from "./delete-button";

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
  });

  if (!trade) {
    notFound();
  }

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
              {trade.realizedPnl !== null && (
                <>
                  {" · "}
                  <span
                    style={{
                      color:
                        trade.realizedPnl >= 0
                          ? "var(--pnl-positive)"
                          : "var(--pnl-negative)",
                    }}
                  >
                    {trade.realizedPnl >= 0 ? "+" : ""}$
                    {trade.realizedPnl.toFixed(2)}
                  </span>
                </>
              )}
            </p>
          </div>

          <DeleteTradeButton tradeId={trade.id} />
        </div>

        <div className="card p-6">
          <TradeForm trade={trade} />
        </div>
      </div>
    </div>
  );
}
