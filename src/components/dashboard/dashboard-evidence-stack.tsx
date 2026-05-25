import type { ActionableBlockerDto, EvidenceChipDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardEvidenceStackProps = {
  chips: EvidenceChipDto[];
  /** Top blockers surfaced as compact context (not full diagnostics). */
  blockers?: ActionableBlockerDto[];
};

export function DashboardEvidenceStack({
  chips,
  blockers = [],
}: DashboardEvidenceStackProps) {
  const alignedChip = chips.find((c) => c.id === "aligned");

  return (
    <section
      className="dash-evidence dash-surface-1"
      data-testid="dashboard-evidence-stack"
      aria-labelledby="dashboard-evidence-heading"
    >
      <header className="dash-evidence__header">
        <h2 id="dashboard-evidence-heading" className="dash-section-title">
          Evidence
        </h2>
        <p className="dash-panel__subtitle">
          Scanner and market facts behind today&apos;s verdict
        </p>
      </header>

      <div className="dash-evidence__chips" data-testid="dashboard-evidence-chips">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className="dash-evidence-chip"
            data-testid={`dashboard-evidence-chip-${chip.id}`}
            title={`Source: ${chip.provenance}`}
          >
            <span className="dash-evidence-chip__label">{chip.label}</span>
            <span className="dash-evidence-chip__value">{chip.display}</span>
          </div>
        ))}
        {blockers.slice(0, 2).map((b) => (
          <div
            key={`blocker-${b.title}`}
            className="dash-evidence-chip dash-evidence-chip--blocker"
            data-testid="dashboard-evidence-blocker-chip"
            title={b.waitFor}
          >
            <span className="dash-evidence-chip__label">{b.title}</span>
            <span className="dash-evidence-chip__value tabular-nums">{b.count}</span>
          </div>
        ))}
      </div>

      {alignedChip ? (
        <p className="dash-evidence__caption" data-testid="dashboard-evidence-caption">
          Data alignment: {alignedChip.display}
        </p>
      ) : null}
    </section>
  );
}
