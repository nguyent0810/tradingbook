import Link from "next/link";

export type TradesPageHeaderProps = {
  tradeCount: number;
  openCount: number;
  closedCount: number;
};

export function TradesPageHeader({
  tradeCount,
  openCount,
  closedCount,
}: TradesPageHeaderProps) {
  return (
    <header
      className="dash-v2-page-header command-deck-page-header trades-page-header"
      data-testid="trades-page-header"
    >
      <div className="dash-v2-page-header__copy">
        <p className="dash-v2-eyebrow dash-v2-eyebrow--accent">Ledger deck</p>
        <h1 className="dash-v2-page-header__title trades-page-header__title">Trades ledger</h1>
        <p className="dash-v2-page-header__lead trades-page-header__subtitle">
          <span data-testid="trades-header-count">
            {tradeCount} trade{tradeCount !== 1 ? "s" : ""} in this view
          </span>
          {tradeCount > 0 ? (
            <>
              {" "}
              · <span className="tabular-nums">{openCount}</span> open ·{" "}
              <span className="tabular-nums">{closedCount}</span> closed
            </>
          ) : null}
        </p>
      </div>
      <div className="dash-v2-page-header__actions">
        <Link href="/trades/new" className="btn btn-primary btn-sm dash-v2-btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Log trade
        </Link>
      </div>
    </header>
  );
}
