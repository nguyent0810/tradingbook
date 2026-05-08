import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatVND } from "@/lib/formatters";
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

  const regime = await getMarketRegimeFromDb("VNINDEX");

  let latestScan = null as Awaited<ReturnType<typeof getLatestDailyScanRun>>;
  try {
    latestScan = await getLatestDailyScanRun();
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (latest scan).";
    console.error("[dashboard] latest scan query failed:", e);
    latestScan = null;
  }

  const scanNotes = parseDailyScanGate2Notes(latestScan?.notes ?? null);
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
            Decision-first trading cockpit.
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

      {dbLoadError ? (
        <div
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {dbLoadError}
        </div>
      ) : null}

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
            Gate 1: <span className="font-medium">{regime.level}</span> | Surfaced:{" "}
            <span className="font-medium">{latestScan?.candidateCountSurfaced ?? 0}</span>
          </div>
        </div>
        <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
          {decision.explanation}
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {regime.latestBar
            ? `VNINDEX close ${regime.latestBar.close.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })} (${regime.latestBar.date.toISOString().slice(0, 10)})`
            : "VNINDEX latest bar unavailable."}
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Best Setups
          </h2>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Đủ điều kiện — core scanner Tier A/B only
          </p>
        </div>
        {topSetups.length === 0 ? (
          <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
            No surfaced candidates in the latest run.
          </div>
        ) : (
          <div className="table-container">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th className="table-num">Score</th>
                  <th className="table-num">Close</th>
                  <th className="table-num">Zone</th>
                  <th className="table-num">Stop</th>
                  <th className="table-num">Bar Date</th>
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
                      <td className="align-top">{c.lifecycleSortLabel}</td>
                      <td className="align-top">{c.healthLevel.replace("_", " ")}</td>
                      <td className="table-num align-top">
                        {c.healthScoreLabel} ({c.healthScore})
                      </td>
                      <td className="table-num">{c.close.toFixed(2)}</td>
                      <td className="table-num">
                        {c.pullbackZoneLow.toFixed(2)} - {c.pullbackZoneHigh.toFixed(2)}
                      </td>
                      <td className="table-num">{c.stopLevel.toFixed(2)}</td>
                      <td className="table-num whitespace-nowrap text-xs">
                        {new Date(c.barDate).toLocaleDateString("en-CA")}
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
                            <li>Quality tier: {c.quality}</li>
                            <li>Rank score: {c.rankScore.toFixed(2)}</li>
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
          Portfolio Risk
        </h2>
        <div className="card p-5">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Current Exposure
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatVND(currentExposure, true)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Remaining Capacity
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {maxPortfolioPct == null
                  ? "Unavailable (equity baseline required)"
                  : `Guided by ${decision.allocation} cap`}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Max Per-Trade Exposure
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {perTradeGuidance}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Risk Guidance
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
          <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
            If account equity is not configured, capacity metrics remain guidance-only placeholders.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Watchlist
        </h2>
        {activeWatchItems.length === 0 ? (
          <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
            No active watch items yet.
          </div>
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
                      <td>{w.lifecycleStatus}</td>
                      <td>{w.healthLevel?.replace("_", " ") ?? "N/A"}</td>
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
          <div className="card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
            No rejection diagnostics available.
          </div>
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
