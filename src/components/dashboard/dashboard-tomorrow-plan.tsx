import Link from "next/link";
import type { TomorrowPlanDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardTomorrowPlanProps = {
  tomorrow: TomorrowPlanDto;
};

export function DashboardTomorrowPlan({ tomorrow }: DashboardTomorrowPlanProps) {
  const symbols = tomorrow.watchSymbols.value;
  const watchNote = tomorrow.watchNote.value;

  return (
    <section
      className="dash-tomorrow dash-panel dash-surface-1"
      data-testid="dashboard-tomorrow-plan"
      aria-labelledby="dashboard-tomorrow-heading"
    >
      <header className="dash-panel__header">
        <h2 id="dashboard-tomorrow-heading" className="dash-section-title">
          Tomorrow&apos;s plan
        </h2>
        <p className="dash-panel__subtitle">Watch, triggers, and avoid rules for the next session</p>
      </header>

      <dl className="dash-tomorrow__grid">
        <div data-testid="dashboard-tomorrow-watch">
          <dt>Watch</dt>
          <dd>
            {symbols.length > 0 ? (
              <span className="dash-tomorrow__symbols font-mono">{symbols.join(", ")}</span>
            ) : (
              <span className="dash-tomorrow__note">{watchNote}</span>
            )}
          </dd>
        </div>
        <div data-testid="dashboard-tomorrow-trigger">
          <dt>Trigger</dt>
          <dd>{tomorrow.triggerLine.value}</dd>
        </div>
        <div data-testid="dashboard-tomorrow-avoid">
          <dt>Avoid</dt>
          <dd>{tomorrow.avoidLine.value}</dd>
        </div>
        <div data-testid="dashboard-tomorrow-posture">
          <dt>Risk posture</dt>
          <dd className="font-semibold">{tomorrow.postureLine.value}</dd>
        </div>
      </dl>

      {symbols.length === 0 ? (
        <p className="dash-tomorrow__link">
          <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
            Review /setups for pipeline context →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
