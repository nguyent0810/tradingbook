import type { DecisionData } from "../types";
import { decisionModeClass } from "../v3-radar-utils";

type Props = {
  data: DecisionData;
};

export function DecisionHero({ data }: Props) {
  const meterStyle = { width: `${data.confidence}%` };

  return (
    <section
      className={`tosv3-panel tosv3-hero ${decisionModeClass(data.mode)}`}
      aria-label="Decision hero"
    >
      <div className="tosv3-hero__header">
        <span className="tosv3-kicker">Decision Core</span>
        <p className="tosv3-hero__confidence tabular-nums" aria-label={`Confidence ${data.confidence} percent`}>
          <span className="tosv3-hero__confidence-value">{data.confidence}</span>
          <span className="tosv3-hero__confidence-unit">%</span>
        </p>
      </div>

      <div className="tosv3-hero__title-row">
        <h2 className="tosv3-hero__mode">{data.mode}</h2>
        <span className="tosv3-hero__mode-tag">Today&apos;s stance</span>
      </div>

      <p className="tosv3-hero__reason">{data.primaryReason}</p>

      <div className="tosv3-meter tosv3-meter--confidence" role="img" aria-label={`Confidence meter ${data.confidence}%`}>
        <div className="tosv3-meter__fill" style={meterStyle} />
      </div>

      <dl className="tosv3-scan-strip">
        <div>
          <dt>Top setup</dt>
          <dd>{data.highestQualitySetup}</dd>
        </div>
        <div>
          <dt>Main risk</dt>
          <dd>{data.mainRisk}</dd>
        </div>
        <div className="tosv3-scan-strip__action">
          <dt>Next action</dt>
          <dd>{data.nextAction}</dd>
        </div>
      </dl>

      <div className="tosv3-hero__grid">
        <div>
          <span>Risk posture</span>
          <strong>{data.riskPosture}</strong>
        </div>
        <div>
          <span>Capital protection</span>
          <strong>{data.capitalProtection}</strong>
        </div>
      </div>
    </section>
  );
}
