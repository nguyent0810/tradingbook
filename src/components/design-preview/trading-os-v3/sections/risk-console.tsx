import type { RiskConsoleData } from "../types";

type Props = {
  data: RiskConsoleData;
};

export function RiskConsole({ data }: Props) {
  const exposureRatio = Math.min(100, (data.currentExposure / data.maxRisk) * 100);
  const exposureStyle = { width: `${exposureRatio}%` };
  const utilizationTone =
    exposureRatio >= 85 ? "tosv3-risk__util--critical" : exposureRatio >= 65 ? "tosv3-risk__util--elevated" : "";

  return (
    <section className="tosv3-panel tosv3-risk" aria-label="Risk console">
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Risk Console</span>
        <p className="tosv3-type-muted">{data.posture}</p>
      </div>

      <div className="tosv3-risk__cap-row">
        <div>
          <span className="tosv3-type-label">Book exposure</span>
          <strong className="tosv3-type-metric tabular-nums">
            {data.currentExposure}%
            <em> / {data.maxRisk}% cap</em>
          </strong>
        </div>
        <div>
          <span className="tosv3-type-label">Open positions</span>
          <strong className="tosv3-type-metric tabular-nums">{data.openPositions}</strong>
        </div>
      </div>

      <div className="tosv3-meter tosv3-meter--risk" role="img" aria-label={`Exposure ${data.currentExposure} percent of ${data.maxRisk} percent cap`}>
        <div className="tosv3-meter__track">
          <span className="tosv3-meter__cap-mark" style={{ left: "100%" }} aria-hidden />
          <div className="tosv3-meter__fill" style={exposureStyle} />
        </div>
      </div>
      <p className={`tosv3-risk__util tabular-nums ${utilizationTone}`}>
        Utilization {Math.round(exposureRatio)}% · Loss limit {data.lossLimit}
      </p>

      <p className="tosv3-risk__shield">{data.capitalProtectionState}</p>
      <p className="tosv3-risk__dont-trade">Do not trade if</p>
      <ol className="tosv3-risk__blockers">
        {data.blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ol>
    </section>
  );
}
