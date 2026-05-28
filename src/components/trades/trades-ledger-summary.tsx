import { CommandDeckCollapsible, CommandDeckZone } from "@/components/command-deck";
import type { BookOperatingContext } from "@/lib/trades/book-operating-context";
import type { SessionBriefingModel } from "@/lib/trades/session-briefing";

export type TradesLedgerSummaryProps = {
  sessionBriefing: SessionBriefingModel | null;
  bookOperatingContext: BookOperatingContext | null;
  bookOperatingBalanceLines: string[];
  sinceLastVisitLines: string[];
  compactReview: boolean;
  showSessionBriefing: boolean;
  showBookContext: boolean;
};

export function TradesLedgerSummary({
  sessionBriefing,
  bookOperatingContext,
  bookOperatingBalanceLines,
  sinceLastVisitLines,
  compactReview,
  showSessionBriefing,
  showBookContext,
}: TradesLedgerSummaryProps) {
  return (
    <div className="ledger-deck__summary-row">
      {showSessionBriefing && sessionBriefing ? (
        <CommandDeckZone
          eyebrow="Operating"
          title="Today's briefing"
          variant="context"
          testId="trades-session-briefing"
          className="ledger-deck-summary__briefing"
        >
          <ul className="ledger-deck-summary__lines">
            {sessionBriefing.lines.map((line, bi) => (
              <li key={`brief-${bi}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
          {sessionBriefing.partialRiskFigures ? (
            <p className="ledger-deck-summary__footnote">
              Risk sum excludes rows without a valid planned stop.
            </p>
          ) : null}
        </CommandDeckZone>
      ) : null}

      {showBookContext && bookOperatingContext ? (
        <CommandDeckZone
          eyebrow="Book"
          title="Operating summary"
          lead={bookOperatingContext.headline}
          variant="context"
          testId="book-operating-context"
          className="ledger-deck-summary__book"
        >
          {bookOperatingContext.detailLines.length > 0 ? (
            <ul className="ledger-deck-summary__lines ledger-deck-summary__lines--detail">
              {(compactReview
                ? bookOperatingContext.detailLines.slice(0, 1)
                : bookOperatingContext.detailLines
              ).map((line, li) => (
                <li key={`book-ctx-${li}-${line.slice(0, 28)}`}>{line}</li>
              ))}
            </ul>
          ) : null}

          {!compactReview &&
          (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
            <>
              {bookOperatingBalanceLines.length > 0 ? (
                <div className="ledger-deck-summary__subsection">
                  <p className="ledger-deck-summary__subsection-title">Operating balance</p>
                  <ul
                    className="ledger-deck-summary__lines ledger-deck-summary__lines--muted"
                    data-testid="book-operating-balance-lines"
                  >
                    {bookOperatingBalanceLines.map((line, li) => (
                      <li key={`book-bal-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {sinceLastVisitLines.length > 0 ? (
                <div className="ledger-deck-summary__subsection">
                  <p className="ledger-deck-summary__subsection-title">Since last ledger visit</p>
                  <ul
                    className="ledger-deck-summary__lines ledger-deck-summary__lines--muted"
                    data-testid="book-operating-trend-lines"
                  >
                    {sinceLastVisitLines.map((line, li) => (
                      <li key={`book-trend-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {compactReview &&
          (bookOperatingBalanceLines.length > 0 || sinceLastVisitLines.length > 0) ? (
            <CommandDeckCollapsible
              summary="Visit delta & balance"
              testId="book-visit-delta-collapsed"
              className="ledger-deck-summary__collapsed-delta"
            >
              {bookOperatingBalanceLines.length > 0 ? (
                <ul
                  className="ledger-deck-summary__lines ledger-deck-summary__lines--muted"
                  data-testid="book-operating-balance-lines"
                >
                  {bookOperatingBalanceLines.slice(0, 1).map((line, li) => (
                    <li key={`book-bal-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {sinceLastVisitLines.length > 0 ? (
                <ul
                  className="ledger-deck-summary__lines ledger-deck-summary__lines--muted"
                  data-testid="book-operating-trend-lines"
                >
                  {sinceLastVisitLines.map((line, li) => (
                    <li key={`book-trend-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </CommandDeckCollapsible>
          ) : null}
        </CommandDeckZone>
      ) : null}
    </div>
  );
}
