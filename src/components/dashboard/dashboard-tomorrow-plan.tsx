import Link from "next/link";
import type { TomorrowPlanDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardTomorrowPlanProps = {
  tomorrow: TomorrowPlanDto;
  /** Promoted beside verdict in primary action row (S8). */
  promoted?: boolean;
};

export function DashboardTomorrowPlan({
  tomorrow,
  promoted = false,
}: DashboardTomorrowPlanProps) {
  const symbols = tomorrow.watchSymbols.value;
  const watchNote = tomorrow.watchNote.value;

  return (
    <section
      className={`dash-tomorrow dash-card${promoted ? " dash-tomorrow--promoted" : ""}`}
      data-testid="dashboard-tomorrow-plan"
      aria-labelledby="dashboard-tomorrow-heading"
    >
      <header className="dash-card__header">
        <h2 id="dashboard-tomorrow-heading" className="dash-section-title">
          {promoted ? "What next" : "Tomorrow's plan"}
        </h2>
        <p className="dash-card__lead">
          {promoted
            ? "Watch · trigger · avoid · posture for the next session"
            : "Watch, triggers, and avoid rules for the next session"}
        </p>
      </header>

      <dl className={`dash-tomorrow__grid${promoted ? " dash-tomorrow__grid--promoted" : ""}`}>
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
          <dd className={promoted ? "dash-tomorrow__line-clamp" : undefined} title={tomorrow.triggerLine.value}>
            {tomorrow.triggerLine.value}
          </dd>
        </div>
        <div data-testid="dashboard-tomorrow-avoid">
          <dt>Avoid</dt>
          <dd className={promoted ? "dash-tomorrow__line-clamp" : undefined} title={tomorrow.avoidLine.value}>
            {tomorrow.avoidLine.value}
          </dd>
        </div>
        <div data-testid="dashboard-tomorrow-posture">
          <dt>Posture</dt>
          <dd className="font-semibold">{tomorrow.postureLine.value}</dd>
        </div>
      </dl>

      {symbols.length === 0 && !promoted ? (
        <p className="dash-tomorrow__link">
          <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
            Review /setups for pipeline context →
          </Link>
        </p>
      ) : null}
    </section>
  );
}
