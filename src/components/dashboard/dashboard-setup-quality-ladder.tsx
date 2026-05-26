import Link from "next/link";
import type { SetupQualityLadderDto } from "@/lib/dashboard/decision-cockpit-dto";
import { SETUP_LADDER_STAGE_ORDER } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardSetupQualityLadderProps = {
  ladder: SetupQualityLadderDto;
};

export function DashboardSetupQualityLadder({ ladder }: DashboardSetupQualityLadderProps) {
  const maxCount = Math.max(...ladder.stages.map((s) => s.count), 1);

  return (
    <section
      className="dash-ladder dash-panel dash-surface-1"
      data-testid="dashboard-setup-quality-ladder"
      aria-labelledby="dashboard-ladder-heading"
    >
      <header className="dash-panel__header dash-ladder__header">
        <div>
          <h2 id="dashboard-ladder-heading" className="dash-section-title">
            Setup quality ladder
          </h2>
          <p className="dash-panel__subtitle">Pipeline distribution from latest scan</p>
        </div>
        <span className="dash-ladder__total tabular-nums">
          {ladder.totalClassified} classified
        </span>
      </header>

      <div
        className="dash-ladder__distribution"
        data-testid="dashboard-ladder-distribution"
        role="img"
        aria-label={`Pipeline distribution: ${ladder.stages.map((s) => `${s.label} ${s.count}`).join(", ")}`}
      >
        {SETUP_LADDER_STAGE_ORDER.map((stageId) => {
          const group = ladder.stages.find((s) => s.stage === stageId)!;
          return (
            <div
              key={stageId}
              className={`dash-ladder__bar-seg dash-ladder__bar-seg--${stageId}${group.count === 0 ? " dash-ladder__bar-seg--empty" : ""}`}
              style={{ flexGrow: group.count > 0 ? group.count : 0.15 }}
              title={`${group.label}: ${group.count}`}
              data-testid={`dashboard-ladder-bar-${stageId}`}
            />
          );
        })}
      </div>

      <ol className="dash-ladder__stages dash-ladder__stages--compact" data-testid="dashboard-ladder-stages">
        {ladder.stages.map((group) => (
          <li
            key={group.stage}
            className="dash-ladder__stage"
            data-testid={`dashboard-ladder-stage-${group.stage}`}
          >
            <div className="dash-ladder__stage-head">
              <span className={`dash-ladder__stage-dot dash-ladder__stage-dot--${group.stage}`} />
              <span className="dash-ladder__stage-label">{group.label}</span>
              <span
                className="dash-ladder__count tabular-nums"
                data-testid={`dashboard-ladder-count-${group.stage}`}
              >
                {group.count}
              </span>
            </div>
            <div
              className="dash-ladder__micro-bar"
              aria-hidden
              style={{
                width: `${Math.max((group.count / maxCount) * 100, group.count > 0 ? 8 : 0)}%`,
              }}
            />
            {group.sampleSymbols.length > 0 ? (
              <p
                className="dash-ladder__symbols font-mono"
                data-testid={`dashboard-ladder-symbols-${group.stage}`}
              >
                {group.sampleSymbols.slice(0, 2).join(", ")}
              </p>
            ) : (
              <p className="dash-ladder__empty-stage" data-testid={`dashboard-ladder-empty-${group.stage}`}>
                —
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="dash-ladder__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/setups" className="dash-ladder__link">
          Full pipeline on Setups →
        </Link>
      </p>
    </section>
  );
}
