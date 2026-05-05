import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { DashboardKpiBand } from "@/components/dashboard-kpi-band";
import { EquityPanel } from "@/components/equity-panel";
import { PerformanceEdgeGrid } from "@/components/performance-edge-grid";
import { TradePreviewTable } from "@/components/trade-preview-table";
import { formatVND } from "@/lib/formatters";
import {
  computeAdvancedMetrics,
  computeEquityCurve,
  computePlaybookPerformance,
} from "@/lib/analytics";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { buildRegimePanelCopy } from "@/lib/playbook/regime-display";
import { RegimePanel } from "@/components/regime-panel";
import { SetupsScanPreview } from "@/components/setups-scan-preview";
import {
  bottleneckShortLabel,
  parseDailyScanGate2Notes,
} from "@/lib/scanner/parse-daily-scan-notes";
import {
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Your trading performance at a glance.",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    orderBy: { entryDate: "asc" },
  });

  const {
    totalTrades,
    winRate,
    totalPnl,
    averageWinner,
    averageLoser,
    largestWinner,
    largestLoser,
    profitFactor,
    expectancy,
    maxDrawdown,
  } = computeAdvancedMetrics(trades);

  const equityData = computeEquityCurve(trades);
  const playbookData = computePlaybookPerformance(trades);
  const openTrades = trades.filter((t) => t.status === "OPEN").length;

  const recentTrades = [...trades]
    .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
    .slice(0, 10);

  const regime = await getMarketRegimeFromDb("VNINDEX");
  const regimeCopy = buildRegimePanelCopy(regime);

  const latestScan = await getLatestDailyScanRun();
  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
  const bottleneckKey = scanNotes?.recommendation.likelyBottleneck ?? "none_obvious";
  const bottleneckLabel = bottleneckShortLabel(bottleneckKey);
  const setupCandidatesPreview = toCandidateRows(latestScan);

  return (
    <div className="page-container animate-in space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Closed-trade KPIs, equity, and recent ledger activity.
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

      <RegimePanel
        symbol={regime.symbol}
        level={regime.level}
        primarySummary={regimeCopy.primarySummary}
        actionGuidance={regimeCopy.actionGuidance}
        technicalReasons={regimeCopy.technicalReasons}
        evaluatedBarsCount={regime.evaluatedBarsCount}
        storedBarsCount={regime.storedBarsCount}
        latestBar={regime.latestBar}
        checkedAt={regime.checkedAt}
      />

      <SetupsScanPreview
        candidates={setupCandidatesPreview}
        bottleneckKey={bottleneckKey}
        bottleneckLabel={bottleneckLabel}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
        <DashboardKpiBand
          className="lg:col-span-5"
          totalTrades={totalTrades}
          openTrades={openTrades}
          winRate={winRate}
          totalPnl={totalPnl}
        />
        <EquityPanel className="lg:col-span-7" data={equityData} />
      </div>

      <TradePreviewTable trades={recentTrades} />

      <PerformanceEdgeGrid
        expectancy={expectancy}
        profitFactor={profitFactor}
        maxDrawdown={maxDrawdown}
        averageWinner={averageWinner}
        averageLoser={averageLoser}
        largestWinner={largestWinner}
        largestLoser={largestLoser}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Playbook Performance
        </h2>

        {playbookData.length === 0 ? (
          <div className="flex h-[150px] items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm text-[var(--text-muted)]">
            Close trades to see playbook-level metrics here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <tr>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Playbook</th>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Count</th>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Win Rate</th>
                    <th className="px-6 py-3 text-right font-medium text-[var(--text-secondary)]">
                      Net P&L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {playbookData.map((s) => (
                    <tr
                      key={s.playbook}
                      className="transition-colors hover:bg-[var(--bg-primary)]"
                    >
                      <td className="px-6 py-4 font-medium text-[var(--text-primary)]">
                        {s.label}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{s.totalTrades}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{s.winRate}%</td>
                      <td className="px-6 py-4 text-right font-medium">
                        <span
                          style={{
                            color: s.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--danger)",
                          }}
                        >
                          {s.totalPnl > 0 ? "+" : ""}
                          {formatVND(s.totalPnl, true)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {trades.length === 0 && (
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
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="empty-state-title">No trades yet</div>
            <div className="empty-state-description">
              Start logging your trades to track your performance and identify patterns in your edge.
            </div>
            <Link href="/trades/new" className="btn btn-primary mt-6">
              Log Your First Trade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
