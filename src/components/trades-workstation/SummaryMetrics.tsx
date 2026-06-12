import Link from "next/link";
import { TradesFreshnessCompact } from "@/components/trades/trades-freshness-compact";
import type { ReviewQueueModel, ReviewQueueSymbol } from "@/lib/trades/review-priority-queue";
import type { BookOperatingContext } from "@/lib/trades/book-operating-context";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { SessionBriefingModel } from "@/lib/trades/session-briefing";
import type { CheckpointCompletion } from "./types";
import "./trades-workstation.css";

export type SummaryMetricsProps = {
  marketFreshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  sessionBriefing: SessionBriefingModel | null;
  reviewQueueModel: ReviewQueueModel | null;
  bookOperatingContext: BookOperatingContext | null;
  bookOperatingBalanceLines: string[];
  sinceLastVisitLines: string[];
  compactReview: boolean;
  hasOpenTrades: boolean;
  checkpointCompletion: CheckpointCompletion;
};

function RadialCheckpointRing({
  reviewed,
  total,
}: {
  reviewed: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(1, reviewed / total) : 0;
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="relative h-[72px] w-[72px] shrink-0" aria-hidden>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="tw-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
          </linearGradient>
          <filter id="tw-ring-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="rgba(51,65,85,0.5)"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="url(#tw-ring-grad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          filter="url(#tw-ring-glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-semibold tabular-nums text-emerald-300">
          {reviewed}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
          / {total}
        </span>
      </div>
    </div>
  );
}

function ReviewQueueCompact({ model }: { model: ReviewQueueModel }) {
  const rows: { label: string; items: ReviewQueueSymbol[]; tone?: string }[] = [
    { label: "Urgent", items: model.urgent, tone: "urgent" },
    { label: "High", items: model.highAttention, tone: "high" },
    { label: "Routine", items: model.routinePending },
    { label: "Stale data", items: model.staleMarket },
  ].filter((r) => r.items.length > 0);

  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No open reviews queued.</p>;
  }

  return (
    <ul className="space-y-1.5" data-testid="trades-review-queue-compact">
      {rows.map((row) => (
        <li
          key={row.label}
          className={`flex flex-wrap items-baseline gap-2 text-xs ${
            row.tone === "urgent"
              ? "text-rose-300"
              : row.tone === "high"
                ? "text-amber-300"
                : "text-slate-400"
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-wide tabular-nums">
            {row.items.length} {row.label}
          </span>
          <span className="text-slate-500">
            {row.items.slice(0, 4).map((s, i) => (
              <span key={s.tradeId}>
                {i > 0 ? " · " : null}
                <Link href={`/trades/${s.tradeId}`} className="font-mono text-slate-300 hover:text-cyan-300">
                  {s.symbol}
                </Link>
              </span>
            ))}
            {row.items.length > 4 ? ` +${row.items.length - 4}` : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SummaryMetrics({
  marketFreshness,
  latestScan,
  scanDelayedBackdrop,
  sessionBriefing,
  reviewQueueModel,
  bookOperatingContext,
  bookOperatingBalanceLines,
  sinceLastVisitLines,
  compactReview,
  hasOpenTrades,
  checkpointCompletion,
}: SummaryMetricsProps) {
  const showOperating = Boolean(sessionBriefing && hasOpenTrades && !compactReview);
  const showBook = Boolean(bookOperatingContext && hasOpenTrades);
  const showGrid = showOperating || showBook || (reviewQueueModel && hasOpenTrades);

  return (
    <div className="space-y-3">
      <TradesFreshnessCompact
        freshness={marketFreshness}
        latestScan={latestScan}
        delayedBackdrop={scanDelayedBackdrop}
      />

      {showGrid ? (
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-2"
          aria-label="Ledger operating cockpit"
        >
          <section className="tw-glass-panel p-4">
            {showOperating && sessionBriefing ? (
              <div data-testid="trades-session-briefing">
                <header className="mb-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                    Operating
                  </p>
                  <h2 className="text-sm font-medium text-slate-200">Today&apos;s briefing</h2>
                </header>
                <ul className="space-y-1.5 text-sm leading-relaxed text-slate-400">
                  {sessionBriefing.lines.map((line, bi) => (
                    <li key={`brief-${bi}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
                {sessionBriefing.partialRiskFigures ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Risk sum excludes rows without a valid planned stop.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {hasOpenTrades ? "Compact review mode — briefing collapsed." : "No open positions."}
              </p>
            )}
          </section>

          <section className="tw-glass-panel p-4" data-testid="book-operating-context">
            {showBook && bookOperatingContext ? (
              <>
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                      Book
                    </p>
                    <h2 className="text-sm font-medium text-slate-200">Ledger summary</h2>
                  </div>
                  <RadialCheckpointRing
                    reviewed={checkpointCompletion.reviewedCount}
                    total={checkpointCompletion.openCount}
                  />
                </header>
                <p className="mb-2 text-xs text-slate-500">
                  Checkpoint completion ·{" "}
                  <span className="font-mono tabular-nums text-emerald-400">
                    {checkpointCompletion.reviewedCount} of {checkpointCompletion.openCount}
                  </span>{" "}
                  positions reviewed
                </p>
                <p className="text-sm text-slate-300">{bookOperatingContext.headline}</p>
                {bookOperatingContext.detailLines.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {(compactReview
                      ? bookOperatingContext.detailLines.slice(0, 2)
                      : bookOperatingContext.detailLines
                    ).map((line, li) => (
                      <li key={`book-ctx-${li}-${line.slice(0, 28)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                {reviewQueueModel && hasOpenTrades ? (
                  <div className="mt-4 border-t border-slate-800/50 pt-3">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                      Review queue
                    </p>
                    <ReviewQueueCompact model={reviewQueueModel} />
                  </div>
                ) : null}

                {!compactReview &&
                (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
                  <div className="mt-4 grid gap-3 border-t border-slate-800/50 pt-3 sm:grid-cols-2">
                    {sinceLastVisitLines.length > 0 ? (
                      <div>
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                          Since last visit
                        </p>
                        <ul
                          className="space-y-1 text-xs text-slate-500"
                          data-testid="book-operating-trend-lines"
                        >
                          {sinceLastVisitLines.map((line, li) => (
                            <li key={`book-trend-${li}-${line.slice(0, 24)}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {bookOperatingBalanceLines.length > 0 ? (
                      <div>
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                          Balance
                        </p>
                        <ul
                          className="space-y-1 text-xs text-slate-500"
                          data-testid="book-operating-balance-lines"
                        >
                          {bookOperatingBalanceLines.map((line, li) => (
                            <li key={`book-bal-${li}-${line.slice(0, 24)}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Book summary appears when you have open trades.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
