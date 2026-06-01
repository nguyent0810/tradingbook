import { V3Collapsible, V3Panel, V3Section } from "@/components/trading-os-v3/layout";
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
    <div className="tosv3-ledger-summary-row">
      {showSessionBriefing && sessionBriefing ? (
        <V3Panel className="tosv3-ledger-summary-card">
          <V3Section eyebrow="Operating" title="Today's briefing" testId="trades-session-briefing">
            <ul className="tosv3-ledger-summary__lines">
              {sessionBriefing.lines.map((line, bi) => (
                <li key={`brief-${bi}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
            {sessionBriefing.partialRiskFigures ? (
              <p className="tosv3-ledger-summary__footnote">
                Risk sum excludes rows without a valid planned stop.
              </p>
            ) : null}
          </V3Section>
        </V3Panel>
      ) : null}

      {showBookContext && bookOperatingContext ? (
        <V3Panel className="tosv3-ledger-summary-card">
          <V3Section
            eyebrow="Book"
            title="Operating summary"
            lead={bookOperatingContext.headline}
            testId="book-operating-context"
          >
            {bookOperatingContext.detailLines.length > 0 ? (
              <ul className="tosv3-ledger-summary__lines tosv3-ledger-summary__lines--detail">
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
                  <div className="tosv3-ledger-summary__subsection">
                    <p className="tosv3-ledger-summary__subsection-title">Operating balance</p>
                    <ul
                      className="tosv3-ledger-summary__lines tosv3-ledger-summary__lines--muted"
                      data-testid="book-operating-balance-lines"
                    >
                      {bookOperatingBalanceLines.map((line, li) => (
                        <li key={`book-bal-${li}-${line.slice(0, 24)}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {sinceLastVisitLines.length > 0 ? (
                  <div className="tosv3-ledger-summary__subsection">
                    <p className="tosv3-ledger-summary__subsection-title">Since last ledger visit</p>
                    <ul
                      className="tosv3-ledger-summary__lines tosv3-ledger-summary__lines--muted"
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
              <V3Collapsible
                summary="Visit delta & balance"
                testId="book-visit-delta-collapsed"
                className="tosv3-ledger-summary__collapsed-delta"
              >
                {bookOperatingBalanceLines.length > 0 ? (
                  <ul
                    className="tosv3-ledger-summary__lines tosv3-ledger-summary__lines--muted"
                    data-testid="book-operating-balance-lines"
                  >
                    {bookOperatingBalanceLines.slice(0, 1).map((line, li) => (
                      <li key={`book-bal-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {sinceLastVisitLines.length > 0 ? (
                  <ul
                    className="tosv3-ledger-summary__lines tosv3-ledger-summary__lines--muted"
                    data-testid="book-operating-trend-lines"
                  >
                    {sinceLastVisitLines.map((line, li) => (
                      <li key={`book-trend-c-${li}-${line.slice(0, 24)}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </V3Collapsible>
            ) : null}
          </V3Section>
        </V3Panel>
      ) : null}
    </div>
  );
}
