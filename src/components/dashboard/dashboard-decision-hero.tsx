import type { VerdictDto, VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type DashboardDecisionHeroProps = {
  verdict: VerdictDto;
  surfacedCount: number;
};

function decisionModifier(uxLevel: VerdictUxLevel): string {
  switch (uxLevel) {
    case "NO_TRADE":
      return "dash-decision-hero--no-trade";
    case "PROBE":
      return "dash-decision-hero--probe";
    default:
      return "dash-decision-hero--normal";
  }
}

function formatUxVerdictTitle(uxLevel: VerdictUxLevel): string {
  return uxLevel.replace(/_/g, " ");
}

function formatConfidenceBand(band: "high" | "medium" | "low"): string {
  const label = band.charAt(0).toUpperCase() + band.slice(1);
  return label;
}

export function DashboardDecisionHero({ verdict, surfacedCount }: DashboardDecisionHeroProps) {
  const ux = verdict.uxLevel.value;
  const { gate1Resolution } = verdict;
  const perTrade = verdict.perTradeGuidance.value;
  const showPerTrade = perTrade.toLowerCase() !== "none";

  return (
    <section
      className={`dash-decision-hero dash-surface-2 ${decisionModifier(ux)}`}
      data-testid="dashboard-decision-hero"
      aria-labelledby="dashboard-decision-heading"
    >
      <p className="dash-eyebrow">Today&apos;s verdict</p>
      <h2 id="dashboard-decision-heading" className="dash-decision-hero__title">
        {formatUxVerdictTitle(ux)}
      </h2>
      {ux === "NO_TRADE" ? (
        <p className="dash-decision-hero__preservation" data-testid="dashboard-verdict-preservation">
          Capital preservation — no new swing risk today.
        </p>
      ) : null}
      <p className="dash-decision-hero__allocation">
        Max book guidance{" "}
        <span className="font-semibold tabular-nums">{verdict.allocation.value}</span>
        {showPerTrade ? (
          <>
            {" "}
            · Per trade{" "}
            <span className="font-semibold tabular-nums">{perTrade}</span>
          </>
        ) : null}
      </p>
      <p className="dash-decision-hero__explanation">{verdict.explanation.value}</p>
      <p
        className="dash-decision-hero__confidence"
        data-testid="dashboard-verdict-confidence"
      >
        Evidence strength:{" "}
        <span className="font-semibold">{formatConfidenceBand(verdict.confidenceBand.value)}</span>
      </p>
      <dl className="dash-decision-hero__meta">
        <div>
          <dt>Gate 1 (verdict)</dt>
          <dd data-testid="dashboard-verdict-gate1">
            {displayGate1ScanLevel(gate1Resolution.canonical)}
          </dd>
        </div>
        {gate1Resolution.mismatch ? (
          <div>
            <dt>Gate 1 (live)</dt>
            <dd
              className="dash-decision-hero__meta-live"
              data-testid="dashboard-verdict-gate1-live"
              title={gate1Resolution.note}
            >
              {displayGate1ScanLevel(gate1Resolution.liveRegimeGate1)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Surfaced</dt>
          <dd className="tabular-nums" data-testid="dashboard-verdict-surfaced">
            {surfacedCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}
