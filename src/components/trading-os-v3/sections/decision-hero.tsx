import type { V3DecisionHero } from "@/lib/dashboard/dashboard-v3-view-model";
import { decisionModeClass } from "../v3-radar-utils";

type Props = {
  data: V3DecisionHero;
};

function confidenceLabel(band: V3DecisionHero["confidenceBand"]): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function DecisionHero({ data }: Props) {
  const meterStyle = { width: `${data.confidenceMeterWidth}%` };

  return (
    <section
      className={`tosv3-panel tosv3-hero ${decisionModeClass(data.mode)}`}
      aria-label="Decision hero"
      data-testid="dashboard-v3-decision-hero"
    >
      <div className="tosv3-hero__header">
        <span className="tosv3-kicker">Decision Core</span>
        <p
          className="tosv3-hero__confidence"
          aria-label={`Confidence band ${data.confidenceBand}`}
        >
          <span className="tosv3-hero__confidence-value">{confidenceLabel(data.confidenceBand)}</span>
          <span className="tosv3-hero__confidence-unit"> confidence</span>
        </p>
      </div>

      <div className="tosv3-hero__title-row">
        <h2 className="tosv3-hero__mode">{data.mode}</h2>
        <span className="tosv3-hero__mode-tag">Today&apos;s stance</span>
      </div>

      <p className="tosv3-hero__reason">{data.primaryReason}</p>

      <div
        className="tosv3-meter tosv3-meter--confidence"
        role="img"
        aria-label={`Confidence band ${data.confidenceBand}`}
      >
        <div className="tosv3-meter__fill" style={meterStyle} />
      </div>

      <dl className="tosv3-scan-strip">
        {data.highestQualitySetup ? (
          <div>
            <dt>Top setup</dt>
            <dd>{data.highestQualitySetup}</dd>
          </div>
        ) : null}
        {data.mainRisk ? (
          <div>
            <dt>Main risk</dt>
            <dd>{data.mainRisk}</dd>
          </div>
        ) : null}
        {data.nextAction ? (
          <div className="tosv3-scan-strip__action">
            <dt>Next action</dt>
            <dd>{data.nextAction}</dd>
          </div>
        ) : null}
      </dl>

      <div className="tosv3-hero__grid">
        <div>
          <span>Risk posture</span>
          <strong>{data.riskPosture}</strong>
        </div>
        {data.capitalProtection ? (
          <div>
            <span>Capital protection</span>
            <strong>{data.capitalProtection}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
