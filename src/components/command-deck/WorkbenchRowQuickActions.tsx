"use client";

type Props = {
  symbol: string;
};

export function WorkbenchRowQuickActions({ symbol }: Props) {
  const chartUrl = `https://www.tradingview.com/chart/?symbol=HOSE%3A${encodeURIComponent(symbol)}`;

  return (
    <div
      className="cd-workbench-quick-actions"
      data-testid={`rs-workbench-quick-actions-${symbol}`}
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={chartUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cd-workbench-quick-actions__btn"
        data-testid="rs-quick-view-chart"
      >
        View chart
      </a>
      <button type="button" className="cd-workbench-quick-actions__btn" data-testid="rs-quick-add-watchlist">
        Add to watchlist
      </button>
      <button type="button" className="cd-workbench-quick-actions__btn" data-testid="rs-quick-create-alert">
        Create alert
      </button>
      <button type="button" className="cd-workbench-quick-actions__btn" data-testid="rs-quick-paper-log">
        Log signal
      </button>
    </div>
  );
}
