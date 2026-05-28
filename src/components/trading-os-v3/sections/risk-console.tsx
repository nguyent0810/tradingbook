import type { V3RiskConsole } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  data: V3RiskConsole;
};

export function RiskConsole({ data }: Props) {
  const hasPercentCap =
    data.exposurePercent != null && data.maxRiskPercent != null && data.utilizationPercent != null;
  const exposureStyle = hasPercentCap
    ? { width: `${Math.min(100, data.utilizationPercent!)}%` }
    : { width: "0%" };
  const utilizationTone =
    data.utilizationTone === "critical"
      ? "tosv3-risk__util--critical"
      : data.utilizationTone === "elevated"
        ? "tosv3-risk__util--elevated"
        : "";

  return (
    <section
      className="tosv3-panel tosv3-risk"
      aria-label="Risk console"
      data-testid="dashboard-v3-risk-console"
    >
      <div className="tosv3-section-head">
        <span className="tosv3-kicker">Risk Console</span>
        <p className="tosv3-type-muted">{data.posture}</p>
      </div>

      <div className="tosv3-risk__cap-row">
        {hasPercentCap ? (
          <div>
            <span className="tosv3-type-label">Book exposure</span>
            <strong className="tosv3-type-metric tabular-nums">
              {data.exposurePercent}%
              <em> / {data.maxRiskPercent}% cap</em>
            </strong>
          </div>
        ) : (
          <div>
            <span className="tosv3-type-label">Book exposure</span>
            <strong className="tosv3-type-metric">Configure equity for % cap</strong>
          </div>
        )}
        <div>
          <span className="tosv3-type-label">Open positions</span>
          <strong className="tosv3-type-metric tabular-nums">{data.openPositions}</strong>
        </div>
      </div>

      <div
        className="tosv3-meter tosv3-meter--risk"
        role="img"
        aria-label="Exposure utilization"
      >
        <div className="tosv3-meter__track">
          <span className="tosv3-meter__cap-mark" style={{ left: "100%" }} aria-hidden />
          <div className="tosv3-meter__fill" style={exposureStyle} />
        </div>
      </div>

      {hasPercentCap ? (
        <p className={`tosv3-risk__util tabular-nums ${utilizationTone}`}>
          Utilization {data.utilizationPercent}%
          {data.lossLimit ? ` · ${data.lossLimit}` : ""}
        </p>
      ) : null}

      <p className="tosv3-risk__shield">{data.capitalProtectionState}</p>
      {data.blockers.length > 0 ? (
        <>
          <p className="tosv3-risk__dont-trade">Do not trade if</p>
          <ol className="tosv3-risk__blockers">
            {data.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
