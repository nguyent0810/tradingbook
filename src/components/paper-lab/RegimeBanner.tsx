import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

export function RegimeBanner({ regime }: { regime: ArenaOverviewDto["marketRegime"] }) {
  const pills = regime.labels?.length
    ? regime.labels
    : [regime.level];

  return (
    <section className="paper-lab-regime-banner mb-4" data-testid="paper-lab-regime-banner">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Market regime</span>
        {pills.map((label) => (
          <span key={label} className="paper-lab-regime-pill">
            {label}
          </span>
        ))}
        {regime.confidence != null && (
          <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
            {(regime.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-tertiary)] mt-1">{regime.label}</p>
    </section>
  );
}
