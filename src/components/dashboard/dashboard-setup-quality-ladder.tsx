import Link from "next/link";
import type { SetupQualityLadderDto } from "@/lib/dashboard/decision-cockpit-dto";
import { SETUP_LADDER_STAGE_ORDER } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardSetupQualityLadderProps = {
  ladder: SetupQualityLadderDto;
  /** Nested inside a Signals rail row, which already renders an icon +
   *  title + count for this widget — drop the duplicate header/card chrome. */
  embedded?: boolean;
};

/**
 * "Today's scan pulse" — a market-temperature read, distinct from the
 * Opportunity board above it (which already shows the actual actionable
 * symbols with reasons). The plain-language summary line is the payoff;
 * the funnel + breakdown below are supporting detail, demoted in size vs
 * Tomorrow's plan since this widget answers "how active was the scan?",
 * not "what should I do?".
 */
export function DashboardSetupQualityLadder({
  ladder,
  embedded = false,
}: DashboardSetupQualityLadderProps) {
  const actionableStages = ladder.stages.filter((s) => s.count > 0);

  return (
    <section
      className={`dash-ladder dash-ladder--pulse${embedded ? " dash-ladder--embedded" : " dash-card"}`}
      data-testid="dashboard-setup-quality-ladder"
      aria-labelledby={embedded ? undefined : "dashboard-ladder-heading"}
    >
      {!embedded ? (
        <header className="dash-pulse-header">
          <h2 id="dashboard-ladder-heading" className="dash-pulse-title">
            Nhịp quét hôm nay
          </h2>
          <span className="dash-ladder__total tabular-nums">
            {ladder.totalClassified} đã phân loại
          </span>
        </header>
      ) : null}

      <p className="dash-pulse-summary" data-testid="dashboard-ladder-summary">
        {ladder.summary}
      </p>

      <div
        className="dash-pulse-funnel"
        data-testid="dashboard-ladder-distribution"
        role="img"
        aria-label={`Pipeline distribution: ${ladder.stages.map((s) => `${s.label} ${s.count}`).join(", ")}`}
      >
        {SETUP_LADDER_STAGE_ORDER.map((stageId) => {
          const group = ladder.stages.find((s) => s.stage === stageId)!;
          const isEmpty = group.count === 0;
          return (
            <div
              key={stageId}
              className={`dash-pulse-funnel__seg dash-pulse-funnel__seg--${stageId}${isEmpty ? " dash-pulse-funnel__seg--empty" : ""}`}
              style={{ flexGrow: group.count > 0 ? group.count : 0.3 }}
              title={`${group.label}: ${group.count}`}
              data-testid={`dashboard-ladder-bar-${stageId}`}
            >
              {isEmpty ? null : group.count}
            </div>
          );
        })}
      </div>

      <ul className="dash-pulse-legend" data-testid="dashboard-ladder-stages">
        {ladder.stages.map((group) => (
          <li key={group.stage} className="dash-pulse-legend__item" data-testid={`dashboard-ladder-stage-${group.stage}`}>
            <span className={`dash-pulse-legend__dot dash-pulse-legend__dot--${group.stage}`} />
            {group.label}
            <span className="dash-pulse-legend__count tabular-nums" data-testid={`dashboard-ladder-count-${group.stage}`}>
              {group.count}
            </span>
          </li>
        ))}
      </ul>

      {actionableStages.length > 0 ? (
        <ul className="dash-pulse-actionable">
          {actionableStages.map((group) => (
            <li
              key={group.stage}
              className={`dash-pulse-actionable__item dash-pulse-actionable__item--${group.stage}`}
              data-testid={`dashboard-ladder-symbols-${group.stage}`}
            >
              <span className="dash-pulse-actionable__label">{group.label}</span>
              <span className="dash-pulse-actionable__syms font-mono">
                {group.sampleSymbols.join(", ")}
                {group.count > group.sampleSymbols.length
                  ? ` +${group.count - group.sampleSymbols.length} more`
                  : ""}
              </span>
              <span className="dash-pulse-actionable__count tabular-nums">
                {group.count} symbol{group.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="dash-ladder__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/setups" className="dash-ladder__link">
          Xem toàn bộ đường ống tại Thiết lập →
        </Link>
      </p>
    </section>
  );
}
