import Link from "next/link";
import type { ActionableDiagnosticsDto } from "@/lib/dashboard/decision-cockpit-dto";
import { formatBlockerSeverity } from "@/lib/dashboard/decision-cockpit-dto";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardActionableBlockersProps = {
  diagnostics: ActionableDiagnosticsDto;
};

export function DashboardActionableBlockers({ diagnostics }: DashboardActionableBlockersProps) {
  const { blockers, emptyReason } = diagnostics;

  return (
    <section
      className="dash-panel dash-surface-1"
      data-testid="dashboard-diagnostics-panel"
      aria-labelledby="dashboard-actionable-blockers-heading"
    >
      <header className="dash-panel__header">
        <h2 id="dashboard-actionable-blockers-heading" className="dash-section-title">
          Actionable blockers
        </h2>
        <p className="dash-panel__subtitle">
          Top conditions blocking new swing entries — full detail on Setups
        </p>
      </header>

      {blockers.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="No actionable blockers"
            reason={emptyReason ?? "Rejection summary unavailable for this scan."}
            data-testid="dashboard-diagnostics-empty"
          >
            <Link href="/setups" className="btn btn-secondary text-xs">
              Open Setups pipeline
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : (
        <ul className="dash-actionable-blockers" data-testid="dashboard-diagnostics-stack">
          {blockers.map((b) => (
            <li
              key={`${b.severity}-${b.title}`}
              className={`dash-actionable-blockers__item dash-actionable-blockers__item--${b.severity}`}
              data-testid="dashboard-actionable-blocker"
            >
              <div className="dash-actionable-blockers__head">
                <span className="dash-actionable-blockers__severity">
                  {formatBlockerSeverity(b.severity)}
                </span>
                <span className="dash-actionable-blockers__title">{b.title}</span>
                {b.count > 0 ? (
                  <span className="dash-actionable-blockers__count tabular-nums">{b.count}</span>
                ) : null}
              </div>
              <p className="dash-actionable-blockers__meaning">{b.meaning}</p>
              <p className="dash-actionable-blockers__wait">
                <span className="font-medium">Next:</span> {b.waitFor}
              </p>
              {b.sampleSymbols.length > 0 ? (
                <p className="dash-actionable-blockers__symbols">
                  Sample: {b.sampleSymbols.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="dash-actionable-blockers__footer">
        <Link href="/setups" className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          Full rejection diagnostics on Setups →
        </Link>
      </p>
    </section>
  );
}
