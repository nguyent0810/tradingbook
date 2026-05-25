import Link from "next/link";

export type TradesPageHeaderProps = {
  tradeCount: number;
};

export function TradesPageHeader({ tradeCount }: TradesPageHeaderProps) {
  return (
    <div className="trades-page-header" data-testid="trades-page-header">
      <div>
        <h1 className="trades-page-header__title">Trades</h1>
        <p
          className="trades-page-header__subtitle"
          data-testid="trades-header-count"
        >
          {tradeCount} trade{tradeCount !== 1 ? "s" : ""} in this view
        </p>
      </div>
      <Link href="/trades/new" className="btn btn-primary shrink-0">
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
        Log Trade
      </Link>
    </div>
  );
}
