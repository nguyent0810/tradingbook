import Link from "next/link";
import type { SetupQualityLadderDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardSetupQualityLadderProps = {
  ladder: SetupQualityLadderDto;
};

export function DashboardSetupQualityLadder({ ladder }: DashboardSetupQualityLadderProps) {
  return (
    <section
      className="dash-ladder dash-panel dash-surface-1"
      data-testid="dashboard-setup-quality-ladder"
      aria-labelledby="dashboard-ladder-heading"
    >
      <header className="dash-panel__header">
        <h2 id="dashboard-ladder-heading" className="dash-section-title">
          Setup quality ladder
        </h2>
        <p className="dash-panel__subtitle">
          Where names sit in the pipeline — tradeable through avoid (from scan + health, not
          fabricated)
        </p>
      </header>

      <ol className="dash-ladder__stages" data-testid="dashboard-ladder-stages">
        {ladder.stages.map((group) => (
          <li
            key={group.stage}
            className="dash-ladder__stage"
            data-testid={`dashboard-ladder-stage-${group.stage}`}
          >
            <div className="dash-ladder__stage-head">
              <span className="dash-ladder__stage-label">{group.label}</span>
              <span className="dash-ladder__stage-subtitle">{group.subtitle}</span>
              <span
                className="dash-ladder__count tabular-nums"
                data-testid={`dashboard-ladder-count-${group.stage}`}
              >
                {group.count}
              </span>
            </div>
            {group.sampleSymbols.length > 0 ? (
              <p
                className="dash-ladder__symbols font-mono"
                data-testid={`dashboard-ladder-symbols-${group.stage}`}
              >
                {group.sampleSymbols.join(", ")}
              </p>
            ) : (
              <p className="dash-ladder__empty-stage" data-testid={`dashboard-ladder-empty-${group.stage}`}>
                None in latest scan data
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="dash-ladder__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
        {ladder.totalClassified > 0
          ? `${ladder.totalClassified} symbol${ladder.totalClassified === 1 ? "" : "s"} classified across stages.`
          : "No surfaced or near-miss symbols to classify — run or refresh the daily scan."}
        {" "}
        <Link href="/setups" className="dash-ladder__link">
          Full pipeline on Setups →
        </Link>
      </p>
    </section>
  );
}
