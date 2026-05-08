import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupsInsightBlock } from "@/components/setups-insight-block";
import {
  SetupsRejectionAccordion,
  type SetupsRejectionAccordionItem,
} from "@/components/setups-rejection-accordion";
import { SetupsCandidatePositionSizing } from "@/components/setups-candidate-position-sizing";
import { SetupsClosestSymbolsSection } from "@/components/setups-closest-symbols";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { SetupsTodaysActionBlock } from "@/components/setups-todays-action-block";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import { prisma } from "@/lib/prisma";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  gate1Label,
  getLatestDailyScanRun,
  toCandidateRows,
} from "@/lib/scanner/setups-queries";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import {
  REJECTION_SYMBOLS_PER_BUCKET_CAP,
  type DailyScanGate2Notes,
} from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate2CategoryBreakdownRow } from "@/lib/scanner/setups-gate2-breakdown";
import { fetchGate2InvalidBreakdown } from "@/lib/scanner/setups-gate2-breakdown";
import { ScanQuality, ScanSetupType } from "@/generated/prisma/client";
import { prepareSurfacedCandidatesHealthView } from "@/lib/setup-health";
import { compareClosestRowsExecutionOrder } from "@/lib/scanner/closest-execution-metrics";
import {
  buildSetupsInsightCopy,
  rejectionBucketLabel,
  rejectionBucketTraderGuide,
} from "@/lib/scanner/setups-trader-copy";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Setups — TradeLog",
  description: "Latest daily scanner run and breakout/pullback candidates.",
};

function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRunDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function reasonsToStrings(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  return reasons.filter((x): x is string => typeof x === "string");
}

type SetupPerfHint = {
  tradeCount: number;
  winRatePct: number;
  avgR: number | null;
};

function fmtSetupPerfHint(
  tier: "A" | "B",
  perf: SetupPerfHint | null
): string {
  if (!perf || perf.tradeCount < 10) return `${tier}-tier · Not enough data`;
  const avgR = perf.avgR ?? 0;
  const avgRLabel = `${avgR >= 0 ? "+" : ""}${avgR.toFixed(1)}R`;
  return `${tier}-tier · ${perf.winRatePct.toFixed(0)}% win · ${avgRLabel} (n=${perf.tradeCount})`;
}

function dominantCategoryFromNotes(
  top: Record<string, number> | undefined
): string | null {
  if (!top || Object.keys(top).length === 0) return null;
  const sorted = Object.entries(top).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function buildDiagnosticsAccordionItems(
  breakdown: Gate2CategoryBreakdownRow[],
  notes: DailyScanGate2Notes | null
): SetupsRejectionAccordionItem[] {
  const notesSym = notes?.rejectionSymbolsByCategory;
  const notesTop = notes?.topRejectionCategories;

  if (breakdown.length > 0) {
    return breakdown.map((row) => {
      const key = String(row.categoryKey);
      const guide = rejectionBucketTraderGuide(key);
      const symbols = row.symbols.length > 0 ? row.symbols : (notesSym?.[key] ?? []);
      return {
        categoryKey: key,
        label: row.label,
        count: row.count,
        symbols,
        meaning: guide.meaning,
        waitFor: guide.waitFor,
      };
    });
  }

  if (!notesTop || Object.keys(notesTop).length === 0) return [];

  return Object.entries(notesTop)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const guide = rejectionBucketTraderGuide(cat);
      return {
        categoryKey: cat,
        label: rejectionBucketLabel(cat),
        count,
        symbols: notesSym?.[cat] ?? [],
        meaning: guide.meaning,
        waitFor: guide.waitFor,
      };
    });
}

export default async function SetupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let dbLoadError: string | null = null;

  let latest = null as Awaited<ReturnType<typeof getLatestDailyScanRun>>;
  try {
    latest = await getLatestDailyScanRun();
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (scanner data).";
    console.error("[setups] getLatestDailyScanRun failed:", e);
    latest = null;
  }

  const notes = parseDailyScanGate2Notes(latest?.notes ?? null);

  let expectedLatestSession = null;
  try {
    expectedLatestSession = latest ? await getExpectedLatestSessionFromIndexBars(prisma) : null;
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (Gate 2 diagnostics).";
    console.error("[setups] expectedLatestSession lookup failed:", e);
    expectedLatestSession = null;
  }

  let breakdown: Gate2CategoryBreakdownRow[] = [];
  try {
    breakdown = expectedLatestSession
      ? await fetchGate2InvalidBreakdown(prisma, expectedLatestSession)
      : [];
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (Gate 2 diagnostics).";
    console.error("[setups] fetchGate2InvalidBreakdown failed:", e);
    breakdown = [];
  }

  const dominantCategoryKey =
    (breakdown[0]?.categoryKey as string | undefined) ??
    dominantCategoryFromNotes(notes?.topRejectionCategories);

  const insight = buildSetupsInsightCopy({
    surfacedCount: latest?.candidateCountSurfaced ?? 0,
    dominantCategoryKey,
    tradableCount: latest?.symbolCountAfterTradability ?? 0,
  });

  const candidates = toCandidateRows(latest);
  const evalBarDateForHealth =
    expectedLatestSession ??
    (candidates.length > 0
      ? candidates.reduce(
          (latestDate, c) => (c.barDate > latestDate ? c.barDate : latestDate),
          candidates[0]!.barDate
        )
      : null);

  let candidatesWithHealth: Awaited<
    ReturnType<typeof prepareSurfacedCandidatesHealthView>
  > = [];
  if (candidates.length > 0 && evalBarDateForHealth) {
    try {
      candidatesWithHealth = await prepareSurfacedCandidatesHealthView(
        prisma,
        candidates,
        evalBarDateForHealth
      );
    } catch (e) {
      dbLoadError ??= "Database temporarily unavailable (candidate health).";
      console.error("[setups] prepareSurfacedCandidatesHealthView failed:", e);
      candidatesWithHealth = [];
    }
  }

  type SetupPerfRow = {
    setup_type: ScanSetupType;
    setup_tier_at_entry: ScanQuality;
    trade_count: bigint | number;
    win_count: bigint | number;
    avg_r: number | null;
  };
  let setupPerfRows: SetupPerfRow[] = [];
  try {
    setupPerfRows = await prisma.$queryRaw<SetupPerfRow[]>`
      SELECT
        setup_type,
        setup_tier_at_entry,
        COUNT(*) AS trade_count,
        SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) AS win_count,
        AVG(r_multiple) AS avg_r
      FROM setup_outcomes
      GROUP BY setup_type, setup_tier_at_entry
    `;
  } catch (e) {
    dbLoadError ??= "Database temporarily unavailable (setup performance).";
    console.error("[setups] setupPerfRows query failed:", e);
    setupPerfRows = [];
  }
  const setupPerfMap = new Map<string, SetupPerfHint>();
  for (const r of setupPerfRows) {
    const tradeCount = Number(r.trade_count);
    const winCount = Number(r.win_count);
    const winRatePct = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;
    setupPerfMap.set(`${r.setup_type}:${r.setup_tier_at_entry}`, {
      tradeCount,
      winRatePct,
      avgR: r.avg_r,
    });
  }
  const accordionItems = buildDiagnosticsAccordionItems(breakdown, notes);

  const closestRows = [...(notes?.closestToValidSymbols ?? [])].sort((a, b) =>
    compareClosestRowsExecutionOrder(
      {
        rankScore: a.rankScore,
        close: a.close,
        pullbackZoneLow: a.pullbackZoneLow,
        pullbackZoneHigh: a.pullbackZoneHigh,
      },
      {
        rankScore: b.rankScore,
        close: b.close,
        pullbackZoneLow: b.pullbackZoneLow,
        pullbackZoneHigh: b.pullbackZoneHigh,
      }
    )
  );

  const tradingDecision =
    latest &&
    (notes?.decision ??
      computeDailyTradingDecision({
        gate1Level: latest.gate1Level as Gate1Level,
        candidateCountA: latest.candidateCountA,
        candidateCountB: latest.candidateCountB,
      }));

  return (
    <div className="page-container animate-in space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Setups
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Breakout-pullback scan — what cleared, what didn’t, and what to watch next.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[var(--accent-text)] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {dbLoadError ? (
        <div
          role="alert"
          className="card border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {dbLoadError}
        </div>
      ) : null}

      {!latest ? (
        <>
          <div className="card">
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
              <div className="empty-state-title">No scanner runs yet</div>
              <div className="empty-state-description">
                Run{" "}
                <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-xs">
                  npx tsx scripts/run-daily-scanner.ts
                </code>{" "}
                after importing bars.
              </div>
            </div>
          </div>
          <MomentumWatchSection />
        </>
      ) : (
        <>
          {tradingDecision ? <SetupsTodaysActionBlock decision={tradingDecision} /> : null}

          <section className="space-y-4">
            <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              Market &amp; setup insight
            </h2>
            <SetupsInsightBlock
              insight={insight}
              runAtLabel={fmtRunDate(latest.runAt)}
              gate1Label={gate1Label(latest.gate1Level)}
              status={latest.status}
              tradabilityPassed={latest.symbolCountAfterTradability}
              tradabilityTotal={latest.symbolCountTotal}
              filteredOut={latest.symbolCountFilteredOut}
              candidateCountA={latest.candidateCountA}
              candidateCountB={latest.candidateCountB}
              candidateCountSurfaced={latest.candidateCountSurfaced}
              errorSummary={latest.status === "FAILED" ? latest.errorSummary : null}
            />
          </section>

          {!expectedLatestSession && accordionItems.length === 0 ? (
            <div className="card">
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
                <div className="empty-state-title">Gate 2 diagnostics unavailable</div>
                <div className="empty-state-description">
                  Gate 2 diagnostics need either a latest VNINDEX session (for live lists) or persisted
                  scanner notes. Import index bars and run{" "}
                  <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-xs">
                    npx tsx scripts/run-daily-scanner.ts
                  </code>
                  .
                </div>
              </div>
            </div>
          ) : null}

          {accordionItems.length > 0 ? (
            <SetupsRejectionAccordion
              sectionIntro={`Buckets match the scanner’s Gate 2 template — not entry signals. Expand for plain-English context and sample symbols. Saved scan notes include up to ${REJECTION_SYMBOLS_PER_BUCKET_CAP} symbols per bucket (bucket totals can be larger).`}
              items={accordionItems}
            />
          ) : null}

          {candidates.length === 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                  Surfaced candidates
                </h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  Đủ điều kiện — core scanner Tier A/B only
                </p>
              </div>
              <div className="card">
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
                <div className="empty-state-title">No surfaced candidates</div>
                <div className="empty-state-description">
                  No Tier A/B candidates surfaced on this run.
                </div>
              </div>
            </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                  Surfaced candidates ({candidates.length})
                </h2>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  Đủ điều kiện — core scanner Tier A/B only
                </p>
              </div>
              <div className="table-container">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Quality</th>
                      <th className="table-num">Score</th>
                      <th className="table-num">close (k ₫)</th>
                      <th className="table-num">zone low–high</th>
                      <th className="table-num">stop</th>
                      <th className="table-num">barDate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatesWithHealth.map((c) => {
                      const lines = reasonsToStrings(c.reasons);
                      const tier = c.quality === ScanQuality.A ? "A" : "B";
                      const perfHint = setupPerfMap.get(`${c.setupType}:${c.quality}`) ?? null;
                      return (
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
                              <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                                {fmtSetupPerfHint(tier, perfHint)}
                              </p>
                            </td>
                            <td className="align-top">{c.quality}</td>
                            <td className="table-num align-top">{c.healthScore}</td>
                            <td className="table-num">{fmtThousands(c.close)}</td>
                            <td className="table-num">
                              {fmtThousands(c.pullbackZoneLow)} – {fmtThousands(c.pullbackZoneHigh)}
                            </td>
                            <td className="table-num">{fmtThousands(c.stopLevel)}</td>
                            <td className="table-num whitespace-nowrap text-xs">
                              {new Date(c.barDate).toLocaleDateString("en-CA")}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="border-t p-0 align-top" style={{ borderColor: "var(--border-primary)" }}>
                              <details className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                                <summary className="cursor-pointer font-medium" style={{ color: "var(--text-primary)" }}>
                                  Candidate details
                                </summary>
                                {c.healthLines.length > 0 || c.healthHint ? (
                                  <div className="mt-2">
                                    {c.healthSummary ? (
                                      <p className="leading-snug" style={{ color: "var(--text-primary)" }}>
                                        {c.healthSummary}
                                      </p>
                                    ) : null}
                                    {c.healthLines.length > 0 ? (
                                      <ul className="mt-1 space-y-0.5 leading-snug">
                                        {c.healthLines.map((line, i) => (
                                          <li key={i}>{line}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                    {c.healthHint ? (
                                      <p className="mt-1 italic leading-snug" style={{ color: "var(--text-tertiary)" }}>
                                        {c.healthHint}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {lines.length > 0 ? (
                                  <ul className="mt-2 list-disc space-y-1 pl-4 leading-snug">
                                    {lines.map((line, i) => (
                                      <li key={i} className="break-words">
                                        {line}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 leading-snug">No extra scanner notes.</p>
                                )}
                              </details>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="border-t p-0 align-top" style={{ borderColor: "var(--border-primary)" }}>
                              <div className="px-3 py-2">
                                <div className="mb-2 flex justify-end">
                                  <Link
                                    href={`/trades/new?setupCandidateId=${c.id}`}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Create Trade from Setup
                                  </Link>
                                </div>
                                <SetupsCandidatePositionSizing
                                  symbolKey={c.symbolKey}
                                  quality={tier}
                                  defaultEntryKVnd={c.close}
                                  defaultStopKVnd={c.stopLevel}
                                />
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <MomentumWatchSection />

          {closestRows.length > 0 ? <SetupsClosestSymbolsSection rows={closestRows} /> : null}

          {latest.tradabilityBreakdown &&
            typeof latest.tradabilityBreakdown === "object" &&
            latest.tradabilityBreakdown !== null && (
              <details className="details-disclosure card p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <summary
                  className="cursor-pointer text-base font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span className="details-marker-closed mr-2 inline text-[var(--text-tertiary)]" aria-hidden>
                    ▸
                  </span>
                  <span className="details-marker-open mr-2 inline text-[var(--text-tertiary)]" aria-hidden>
                    ▾
                  </span>
                  Tradability filter detail
                </summary>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                  Raw reasons symbols were removed before Gate 2 (unchanged from scanner output).
                </p>
                <ul className="mt-3 space-y-1.5">
                  {Object.entries(latest.tradabilityBreakdown as Record<string, number>).map(
                    ([reason, count]) => (
                      <li key={reason}>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {count}×
                        </span>{" "}
                        {reason}
                      </li>
                    )
                  )}
                </ul>
              </details>
            )}
        </>
      )}
    </div>
  );
}
