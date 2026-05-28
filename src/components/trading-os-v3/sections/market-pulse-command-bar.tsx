import type { V3MarketPulse } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  data: V3MarketPulse;
};

export function MarketPulseCommandBar({ data }: Props) {
  return (
    <section
      className="tosv3-panel tosv3-commandbar"
      aria-label="Market pulse command bar"
      data-testid="dashboard-v3-market-pulse"
    >
      <div className="tosv3-commandbar__session">
        <span className="tosv3-kicker">Market Pulse</span>
        <h1>{data.session}</h1>
      </div>

      <div className="tosv3-commandbar__metrics">
        <div>
          <span>Freshness</span>
          <strong>{data.freshness}</strong>
        </div>
        {data.vnindex ? (
          <div className="tosv3-commandbar__metric tosv3-commandbar__metric--primary">
            <span>VNINDEX</span>
            <strong className="tabular-nums">{data.vnindex}</strong>
          </div>
        ) : null}
        <div>
          <span>Regime</span>
          <strong>{data.regime}</strong>
        </div>
        {data.breadth ? (
          <div>
            <span>Breadth</span>
            <strong>{data.breadth}</strong>
          </div>
        ) : null}
        {data.volatility ? (
          <div>
            <span>Volatility</span>
            <strong>{data.volatility}</strong>
          </div>
        ) : null}
        <div>
          <span>Watch State</span>
          <strong>{data.watchState}</strong>
        </div>
      </div>
    </section>
  );
}
