import type { MarketPulse } from "../types";

type Props = {
  data: MarketPulse;
};

export function MarketPulseCommandBar({ data }: Props) {
  const deltaClass = data.vnindexDelta >= 0 ? "tosv3-positive" : "tosv3-negative";

  return (
    <section className="tosv3-panel tosv3-commandbar" aria-label="Market pulse command bar">
      <div className="tosv3-commandbar__session">
        <span className="tosv3-kicker">Market Pulse</span>
        <h1>{data.session}</h1>
      </div>

      <div className="tosv3-commandbar__metrics">
        <div>
          <span>Freshness</span>
          <strong>{data.freshness}</strong>
        </div>
        <div>
          <span>VNINDEX</span>
          <strong className="tabular-nums">
            {data.vnindex} <em className={deltaClass}>{data.vnindexDelta >= 0 ? "+" : ""}{data.vnindexDelta}%</em>
          </strong>
        </div>
        <div>
          <span>Regime</span>
          <strong>{data.regime}</strong>
        </div>
        <div>
          <span>Breadth</span>
          <strong className="tabular-nums">{data.breadth}%</strong>
        </div>
        <div>
          <span>Volatility</span>
          <strong>{data.volatility}</strong>
        </div>
        <div>
          <span>Watch State</span>
          <strong>{data.watchState}</strong>
        </div>
      </div>
    </section>
  );
}
