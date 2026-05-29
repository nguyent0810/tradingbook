import type { V3SignalTrajectory } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  data: V3SignalTrajectory;
};

function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function SignalTrajectoryChart({ data }: Props) {
  const chartHeight = 140;
  const path = sparkPath(data.points, 960, chartHeight);

  return (
    <section className="tosv3-panel tosv3-chart" aria-label="Book P and L trajectory">
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Book trajectory</span>
        <p className="tosv3-type-muted">Closed trades cumulative P&amp;L</p>
      </div>
      {data.emptyMessage ? (
        <p className="tosv3-empty-state tosv3-chart__empty">{data.emptyMessage}</p>
      ) : (
        <svg viewBox={`0 0 960 ${chartHeight}`} role="img" aria-label="Closed trades cumulative P and L">
          <defs>
            <linearGradient id="tosv3ProdChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(80, 227, 194, 0.9)" />
              <stop offset="100%" stopColor="rgba(80, 227, 194, 0.05)" />
            </linearGradient>
          </defs>
          <path d={`${path} L 960 ${chartHeight} L 0 ${chartHeight} Z`} fill="url(#tosv3ProdChartGrad)" />
          <path d={path} className="tosv3-chart__line" />
        </svg>
      )}
    </section>
  );
}
