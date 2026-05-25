import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatVND, formatEquityThousandVndPerShare, formatBarDataDateUtcLong } from "@/lib/formatters";
import { getMarketRegimeFromDb } from "@/lib/playbook/get-market-regime";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import {
  parseDailyScanGate2Notes,
} from "@/lib/scanner/parse-daily-scan-notes";
import {
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";
import {
  computeDailyTradingDecision,
  formatDecisionLevelForDisplay,
} from "@/lib/scanner/trading-decision";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import {
  prepareSurfacedCandidatesHealthView,
  type SurfacedCandidateHealthView,
  type SetupHealthLevelValue,
} from "@/lib/setup-health";
import { distanceToZonePct, healthLevelActionHint } from "@/lib/setup-health";
import { rejectionBucketLabel, rejectionBucketTraderGuide } from "@/lib/scanner/setups-trader-copy";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import { isTradingRiskBudgetConfigured } from "@/lib/trading-account-risk-config";
import { fetchMarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import {
  buildMarketFreshnessDto,
} from "@/lib/market/market-freshness-dto";
import { DashboardFreshnessStrip } from "@/components/dashboard/dashboard-freshness-strip";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardScanRunMeta } from "@/components/dashboard/dashboard-scan-run-meta";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import {
  displayCandidateLifecycleSortLabel,
  displayGate1ScanLevel,
  displayScanQualityTier,
  displaySetupHealthLevel,
  displaySetupLifecycleStatus,
} from "@/lib/trading-display-labels";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Decision-first trading cockpit.",
};

function pctFromRangeText(input: string): number | null {
  const m = input.match(/(\d+)\s*-\s*(\d+)%/);
  if (m) return Number(m[2]) / 100;
  const single = input.match(/(\d+)%/);
  return single ? Number(single[1]) / 100 : null;
}

function watchActionHint(
  lifecycle: SetupLifecycleStatus,
  healthLevel: "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD" | null
): string {
  if (healthLevel) {
    const hint = healthLevelActionHint(healthLevel);
    if (hint) return hint;
  }
  switch (lifecycle) {
    case "READY":
      return "Eligible for execution workflow.";
    case "WATCHING":
      return "Wait for pullback into entry zone.";
    case "NEW":
      return "Monitor for first valid retest.";
    default:
      return "Review setup state before action.";
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  type DashboardTradeRow = {
    status: string;
    entryPrice: number;
    quantity: number;
  };

  type DashboardWatchRow = {
    id: string;
    symbolId: string;
    lifecycleStatus: SetupLifecycleStatus;
    healthLevel: SetupHealthLevelValue | null;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    symbol: { symbol: string };
  };

  type LatestBarRow = { symbolId: string; close: number };

  let dbLoadError: string | null = null;

  let trades: DashboardTradeRow[] = [];
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

  const decision =
    scanNotes?.decision ??
    (latestScan
      ? computeDailyTradingDecision({
          gate1Level: regime.level,
          candidateCountA: latestScan.candidateCountA,
          candidateCountB: latestScan.candidateCountB,
        })
      : {
          level: "NO_TRADE" as const,
          allocation: "0%",
          explanation: "No scan run found yet.",
        });

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const currentExposure = openTrades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0);
  const maxPortfolioPct = pctFromRangeText(decision.allocation);
  const perTradeGuidance = decision.level === "PROBE" ? "10-15%" : "10-20%";

  let activeWatchItems: DashboardWatchRow[] = [];
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
  let latestBars: LatestBarRow[] = [];
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

  const rejectionBuckets = Object.entries(scanNotes?.topRejectionCategories ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const portfolioRiskConfigured = isTradingRiskBudgetConfigured();

  const exposureSection = (
    <>
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        {portfolioRiskConfigured ? "Exposure overview (guidance only)" : "Exposure snapshot"}
      </h2>
      <div className="card p-5">
        {!portfolioRiskConfigured ? (
          <p
            className="mb-4 rounded-md border px-3 py-2 text-sm leading-snug"
            style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
          >
            Risk budget is not configured yet. These values are guidance-only. Set{" "}
            <code className="rounded bg-[var(--bg-tertiary)] px-1 py-0.5 text-xs">
              TRADING_ACCOUNT_EQUITY_VND
            </code>{" "}
            on the server to unlock exposure overview labels that reference your account.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Current exposure (entry notional)
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatVND(currentExposure, true)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Allocation guidance (not remaining capacity math)
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {!portfolioRiskConfigured
                ? "—"
                : maxPortfolioPct == null
                  ? "Unavailable (could not parse allocation text)"
                  : `${decision.allocation} — qualitative cap from scan only`}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Max per-trade exposure (guide)
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {perTradeGuidance}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Stance from scan
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {decision.level === "NO_TRADE"
                ? "Preserve capital."
                : decision.level === "PROBE"
                  ? "Small, selective probes only."
                  : "Normal risk with discipline."}
            </div>
          </div>
        </div>
        {!portfolioRiskConfigured ? (
          <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
            Allocation percentages below still reflect scanner guidance; they are not validated
            against your account until equity is configured.
          </p>
        ) : (
          <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
            Guidance only — not stop-based risk or mark-to-market sizing. Exposure shown uses entry
            prices × quantity.
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="page-container animate-in space-y-6 pb-10">
      <DashboardPageHeader />

      <DashboardFreshnessStrip freshness={freshness} />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          title="Partial dashboard data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/dashboard/page.tsx · one or more Prisma reads failed; sections below may be empty."
          data-testid="dashboard-db-load-error"
        />
      ) : null}

      <div className="dashboard-cockpit-grid">
      <section className="card space-y-3 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Today&apos;s Action
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDecisionLevelForDisplay(decision.level)}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Max exposure guidance: <span className="font-medium">{decision.allocation}</span>
            </p>
          </div>
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Market backdrop:{" "}
            <span className="font-medium">{displayGate1ScanLevel(regime.level)}</span> | Surfaced:{" "}
            <span className="font-medium">{latestScan?.candidateCountSurfaced ?? 0}</span>
          </div>
        </div>
        <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
          {decision.explanation}
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {regime.latestBar
            ? `VNINDEX latest close: ${formatEquityThousandVndPerShare(regime.latestBar.close)} · Data date: ${formatBarDataDateUtcLong(regime.latestBar.date)}`
            : "VNINDEX latest bar unavailable."}
        </p>
      </section>

      <section className="space-y-3">{exposureSection}</section>
      </div>

      <DashboardScanRunMeta
        latestScan={latestScan}
        delayedBackdrop={scanDelayedBackdrop}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Best Setups
          </h2>
          <p className="mt-0.5 text-xs font-medium tracking-wide text-[var(--text-tertiary)]">
            Qualified setups — core scanner Tier A/B only
          </p>
        </div>
        {topSetups.length === 0 ? (
          <EmptyStateWithReason
            title="No qualified setups in the latest scan"
            reason={
              latestScan
                ? `The latest run (${latestScan.candidateCountSurfaced} surfaced) produced no Tier A/B candidates for the dashboard shortlist. Gate 1 was ${displayGate1ScanLevel(latestScan.gate1Level)} — see Diagnostics or the full Setups page for near-miss symbols.`
                : "No daily scan run is available yet. Wait for the scheduled import and scan, or check automation in GitHub Actions."
            }
            data-testid="dashboard-best-setups-empty"
          >
            <Link href="/setups" className="btn btn-secondary text-xs">
              Open Setups pipeline
            </Link>
          </EmptyStateWithReason>
        ) : (
          <div className="table-container">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th className="table-num">Score</th>
                  <th className="table-num">
                    <span className="block">Close</span>
                    <span
                      className="block text-[10px] font-normal font-sans normal-case"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      (1000 ₫)
                    </span>
                  </th>
                  <th className="table-num">
                    <span className="block">Zone</span>
                    <span
                      className="block text-[10px] font-normal font-sans normal-case"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      (1000 ₫)
                    </span>
                  </th>
                  <th className="table-num">
                    <span className="block">Stop</span>
                    <span
                      className="block text-[10px] font-normal font-sans normal-case"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      (1000 ₫)
                    </span>
                  </th>
                  <th className="table-num whitespace-nowrap text-xs">Data date (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {topSetups.map((c) => (
                  <Fragment key={c.id}>
                    <tr>
                      <td className="max-w-[280px] align-top">
                        <SetupsCandidateHealthStrip
                          symbolKey={c.symbolKey}
                          lifecycleSortLabel={c.lifecycleSortLabel}
                          healthLevel={c.healthLevel}
                          healthScore={c.healthScore}
                          healthScoreLabel={c.healthScoreLabel}
                          healthLines={c.healthLines}
                          healthHint={c.healthHint}
                          compact
                        />
                      </td>
                      <td className="align-top">{displayCandidateLifecycleSortLabel(c.lifecycleSortLabel)}</td>
                      <td className="align-top">{c.healthLevel.replace("_", " ")}</td>
                      <td className="table-num align-top">
                        {c.healthScoreLabel} ({c.healthScore})
                      </td>
                      <td className="table-num align-top">
                        {formatEquityThousandVndPerShare(c.close)}
                      </td>
                      <td className="table-num">
                        {formatEquityThousandVndPerShare(c.pullbackZoneLow)} –{" "}
                        {formatEquityThousandVndPerShare(c.pullbackZoneHigh)}
                      </td>
                      <td className="table-num">{formatEquityThousandVndPerShare(c.stopLevel)}</td>
                      <td className="table-num whitespace-nowrap text-xs">
                        {formatBarDataDateUtcLong(new Date(c.barDate))}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="border-t p-0 align-top" style={{ borderColor: "var(--border-primary)" }}>
                        <details className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <summary className="cursor-pointer font-medium" style={{ color: "var(--text-primary)" }}>
                            Candidate details
                          </summary>
                          {c.healthSummary ? <p className="mt-2">{c.healthSummary}</p> : null}
                          {c.healthHint ? (
                            <p className="mt-1 italic" style={{ color: "var(--text-tertiary)" }}>
                              {c.healthHint}
                            </p>
                          ) : null}
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            <li>
                              Distance to entry zone:{" "}
                              {(distanceToZonePct(c.close, c.pullbackZoneLow, c.pullbackZoneHigh) * 100).toFixed(1)}%
                            </li>
                            <li>Quality tier: {displayScanQualityTier(c.quality)}</li>
                            <li>Scanner score: {c.rankScore.toFixed(2)}</li>
                          </ul>
                          {Array.isArray(c.reasons) && c.reasons.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4 leading-snug">
                              {c.reasons.map((line, i) => (
                                <li key={i} className="break-words">
                                  {String(line)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MomentumWatchSection />

      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Watchlist
        </h2>
        {activeWatchItems.length === 0 ? (
          <EmptyStateWithReason
            title="Watchlist is empty"
            reason="No setup watch items are in NEW, WATCHING, or READY lifecycle. Surfaced candidates from a future scan will populate the watchlist automatically."
            data-testid="dashboard-watchlist-empty"
          />
        ) : (
          <div className="table-container">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th className="table-num">Distance to Zone</th>
                  <th>Action Hint</th>
                </tr>
              </thead>
              <tbody>
                {activeWatchItems.map((w) => {
                  const close = latestCloseBySymbol.get(w.symbolId) ?? null;
                  const dist = close == null ? null : distanceToZonePct(close, w.pullbackZoneLow, w.pullbackZoneHigh);
                  return (
                    <tr key={w.id}>
                      <td className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                        {w.symbol.symbol}
                      </td>
                      <td>{displaySetupLifecycleStatus(w.lifecycleStatus)}</td>
                      <td>
                        {w.healthLevel ? displaySetupHealthLevel(w.healthLevel) : "—"}
                      </td>
                      <td className="table-num">
                        {dist == null ? "N/A" : `${(dist * 100).toFixed(1)}%`}
                      </td>
                      <td className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {watchActionHint(w.lifecycleStatus, w.healthLevel)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Diagnostics
        </h2>
        {rejectionBuckets.length === 0 ? (
          <EmptyStateWithReason
            title="No rejection diagnostics"
            reason={
              latestScan
                ? "The latest scan did not persist Gate 2 rejection buckets in notes, or the run had no tradability failures to summarize."
                : "Run a daily scan to populate rejection diagnostics."
            }
            data-testid="dashboard-diagnostics-empty"
          />
        ) : (
          <div className="card p-5">
            <ul className="space-y-2">
              {rejectionBuckets.map(([category, count]) => {
                const guide = rejectionBucketTraderGuide(category);
                const symbols = scanNotes?.rejectionSymbolsByCategory?.[category] ?? [];
                return (
                  <li key={category} className="rounded-lg border p-3" style={{ borderColor: "var(--border-primary)" }}>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {rejectionBucketLabel(category)} ({count})
                      </summary>
                      <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {guide.meaning}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        Wait for: {guide.waitFor}
                      </p>
                      {symbols.length > 0 ? (
                        <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Symbols: {symbols.join(", ")}
                        </p>
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {trades.length === 0 ? (
        <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          No trade history yet. Log your first trade to unlock portfolio feedback context.
        </div>
      ) : null}
    </div>
  );
}
