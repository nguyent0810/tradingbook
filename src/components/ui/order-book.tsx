export type OrderBookLevel = {
  price: string;
  size: string;
  total?: string;
};

export type OrderBookProps = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread?: string;
  className?: string;
};

export function OrderBook({ bids, asks, spread, className = "" }: OrderBookProps) {
  return (
    <div className={`panel flex flex-col overflow-hidden ${className}`.trim()}>
      <div
        className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ borderColor: "var(--border-primary)", color: "var(--text-tertiary)" }}
      >
        Order book
        {spread ? (
          <span className="float-right font-normal normal-case tabular-nums" style={{ color: "var(--text-secondary)" }}>
            Spread {spread}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="max-h-[140px] overflow-y-auto px-1">
        {asks.slice().reverse().map((row, i) => (
          <div
            key={`a-${i}`}
            className="grid grid-cols-3 gap-0 rounded px-2 py-0.5 font-mono text-xs tabular-nums hover:bg-[var(--bg-hover)]"
          >
            <span className="price-down">{row.price}</span>
            <span className="text-right" style={{ color: "var(--text-secondary)" }}>{row.size}</span>
            <span className="text-right" style={{ color: "var(--text-tertiary)" }}>{row.total ?? "—"}</span>
          </div>
        ))}
      </div>
      <div
        className="my-1 border-y py-1.5 text-center font-mono text-xs font-medium tabular-nums"
        style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
      >
        Mid
      </div>
      <div className="max-h-[140px] overflow-y-auto px-1 pb-2">
        {bids.map((row, i) => (
          <div
            key={`b-${i}`}
            className="grid grid-cols-3 gap-0 rounded px-2 py-0.5 font-mono text-xs tabular-nums hover:bg-[var(--bg-hover)]"
          >
            <span className="price-up">{row.price}</span>
            <span className="text-right" style={{ color: "var(--text-secondary)" }}>{row.size}</span>
            <span className="text-right" style={{ color: "var(--text-tertiary)" }}>{row.total ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
