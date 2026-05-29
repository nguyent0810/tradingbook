import Link from "next/link";
import { TradesFreshnessCompact } from "@/components/trades/trades-freshness-compact";
import { TradesLedgerSummary } from "@/components/trades/trades-ledger-summary";
import type { BookOperatingContext } from "@/lib/trades/book-operating-context";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { ReviewQueueModel } from "@/lib/trades/review-priority-queue";
import type { SessionBriefingModel } from "@/lib/trades/session-briefing";
import type { ReviewQueueSymbol } from "@/lib/trades/review-priority-queue";

function ReviewQueueCompact({ model }: { model: ReviewQueueModel }) {
  const rows: { label: string; items: ReviewQueueSymbol[]; tone?: string }[] = [
    { label: "Urgent", items: model.urgent, tone: "urgent" },
    { label: "High", items: model.highAttention, tone: "high" },
    { label: "Routine", items: model.routinePending },
    { label: "Stale data", items: model.staleMarket },
  ].filter((r) => r.items.length > 0);

  if (rows.length === 0) {
    return <p className="tosv3-ledger-book__empty">No open reviews queued.</p>;
  }

  return (
    <ul className="tosv3-ledger-book__queue" data-testid="trades-review-queue-compact">
      {rows.map((row) => (
        <li key={row.label} className={`tosv3-ledger-book__queue-row${row.tone ? ` is-${row.tone}` : ""}`}>
          <span className="tosv3-ledger-book__queue-label tabular-nums">
            {row.items.length} {row.label}
          </span>
          <span className="tosv3-ledger-book__queue-symbols">
            {row.items.slice(0, 4).map((s, i) => (
              <span key={s.tradeId}>
                {i > 0 ? " · " : null}
                <Link href={`/trades/${s.tradeId}`} className="mono">
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

export type TradesLedgerCockpitProps = {
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
};

export function TradesLedgerCockpit({
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
}: TradesLedgerCockpitProps) {
  const showOperating = Boolean(sessionBriefing && hasOpenTrades && !compactReview);
  const showBook = Boolean(bookOperatingContext && hasOpenTrades);
  const showCockpitGrid = showOperating || showBook || (reviewQueueModel && hasOpenTrades);

  return (
    <>
      <TradesFreshnessCompact
        freshness={marketFreshness}
        latestScan={latestScan}
        delayedBackdrop={scanDelayedBackdrop}
      />

      {showCockpitGrid ? (
        <div className="tosv3-ledger-cockpit" aria-label="Ledger operating cockpit">
          <div className="tosv3-ledger-cockpit__operating tosv3-glass-panel">
            {showOperating && sessionBriefing ? (
              <section className="tosv3-ledger-operating" data-testid="trades-session-briefing">
                <header className="tosv3-ledger-operating__head">
                  <span className="tosv3-kicker">Operating</span>
                  <h2 className="tosv3-ledger-operating__title">Today&apos;s briefing</h2>
                </header>
                <ul className="tosv3-ledger-operating__lines">
                  {sessionBriefing.lines.map((line, bi) => (
                    <li key={`brief-${bi}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
                {sessionBriefing.partialRiskFigures ? (
                  <p className="tosv3-ledger-operating__footnote">
                    Risk sum excludes rows without a valid planned stop.
                  </p>
                ) : null}
              </section>
            ) : (
              <p className="tosv3-ledger-operating__placeholder">
                {hasOpenTrades ? "Compact review mode — briefing collapsed." : "No open positions."}
              </p>
            )}
          </div>

          <div className="tosv3-ledger-cockpit__book tosv3-glass-panel">
            {showBook && bookOperatingContext ? (
              <section className="tosv3-ledger-book" data-testid="book-operating-context">
                <header className="tosv3-ledger-book__head">
                  <span className="tosv3-kicker">Book</span>
                  <h2 className="tosv3-ledger-book__title">Ledger summary</h2>
                </header>
                <p className="tosv3-ledger-book__headline">{bookOperatingContext.headline}</p>
                {bookOperatingContext.detailLines.length > 0 ? (
                  <ul className="tosv3-ledger-book__lines">
                    {(compactReview
                      ? bookOperatingContext.detailLines.slice(0, 2)
                      : bookOperatingContext.detailLines
                    ).map((line, li) => (
                      <li key={`book-ctx-${li}-${line.slice(0, 28)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                {reviewQueueModel && hasOpenTrades ? (
                  <div className="tosv3-ledger-book__subsection">
                    <p className="tosv3-ledger-book__subsection-title">Review queue</p>
                    <ReviewQueueCompact model={reviewQueueModel} />
                  </div>
                ) : null}

                {!compactReview &&
                (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
                  <div className="tosv3-ledger-book__delta">
                    {sinceLastVisitLines.length > 0 ? (
                      <div>
                        <p className="tosv3-ledger-book__subsection-title">Since last visit</p>
                        <ul
                          className="tosv3-ledger-book__lines tosv3-ledger-book__lines--muted"
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
                        <p className="tosv3-ledger-book__subsection-title">Balance</p>
                        <ul
                          className="tosv3-ledger-book__lines tosv3-ledger-book__lines--muted"
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
              </section>
            ) : (
              <p className="tosv3-ledger-book__empty">Book summary appears when you have open trades.</p>
            )}
          </div>
        </div>
      ) : (
        <TradesLedgerSummary
          sessionBriefing={sessionBriefing}
          bookOperatingContext={bookOperatingContext}
          bookOperatingBalanceLines={bookOperatingBalanceLines}
          sinceLastVisitLines={sinceLastVisitLines}
          compactReview={compactReview}
          showSessionBriefing={showOperating}
          showBookContext={showBook}
        />
      )}
    </>
  );
}
