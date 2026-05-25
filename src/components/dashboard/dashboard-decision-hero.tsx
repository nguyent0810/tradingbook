import type { DailyTradingDecision } from "@/lib/scanner/trading-decision";
import { formatDecisionLevelForDisplay } from "@/lib/scanner/trading-decision";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import type { Gate1Level } from "@/lib/scanner/gate2/types";

export type DashboardDecisionHeroProps = {
  decision: DailyTradingDecision;
  gate1Level: Gate1Level | string;
  surfacedCount: number;
  vnindexLine: string;
};

function decisionModifier(level: DailyTradingDecision["level"]): string {
  switch (level) {
    case "NO_TRADE":
      return "dash-decision-hero--no-trade";
    case "PROBE":
      return "dash-decision-hero--probe";
    default:
      return "dash-decision-hero--normal";
  }
}

export function DashboardDecisionHero({
  decision,
  gate1Level,
  surfacedCount,
  vnindexLine,
}: DashboardDecisionHeroProps) {
  return (
    <section
      className={`dash-decision-hero dash-surface-2 ${decisionModifier(decision.level)}`}
      data-testid="dashboard-decision-hero"
      aria-labelledby="dashboard-decision-heading"
    >
      <p className="dash-eyebrow">Today&apos;s action</p>
      <h2 id="dashboard-decision-heading" className="dash-decision-hero__title">
        {formatDecisionLevelForDisplay(decision.level)}
      </h2>
      <p className="dash-decision-hero__allocation">
        Max exposure guidance{" "}
        <span className="font-semibold tabular-nums">{decision.allocation}</span>
      </p>
      <p className="dash-decision-hero__explanation">{decision.explanation}</p>
      <dl className="dash-decision-hero__meta">
        <div>
          <dt>Gate 1</dt>
          <dd>{displayGate1ScanLevel(String(gate1Level))}</dd>
        </div>
        <div>
          <dt>Surfaced</dt>
          <dd className="tabular-nums">{surfacedCount}</dd>
        </div>
      </dl>
      <p className="dash-decision-hero__footnote">{vnindexLine}</p>
    </section>
  );
}
