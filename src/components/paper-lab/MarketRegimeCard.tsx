import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import { ConfidenceRing } from "./ui/ConfidenceRing";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

export function MarketRegimeCard({ regime }: { regime: ArenaOverviewDto["marketRegime"] }) {
  const labels = regime.labels?.length ? regime.labels : regime.label.split(" · ").filter(Boolean);
  const confidence = regime.confidence ?? 0;

  return (
    <PaperLabPanel title="Market Regime" testId="paper-lab-regime-card">
      <div className="flex gap-3 items-start">
        <ConfidenceRing pct={confidence} />
        <div className="min-w-0 flex-1">
          <div className="paper-lab-regime-pills">
            {labels.map((l) => (
              <span key={l} className="paper-lab-regime-pill">
                {l}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--pl-muted)] line-clamp-2">{regime.label}</p>
          <p className="text-[0.65rem] text-[var(--pl-faint)] mt-1">
            Gate 1: <span className="text-[var(--pl-text)]">{regime.level}</span>
          </p>
        </div>
      </div>
    </PaperLabPanel>
  );
}
