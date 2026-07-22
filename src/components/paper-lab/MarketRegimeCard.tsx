import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import { ConfidenceRing } from "./ui/ConfidenceRing";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

function gatePillClass(level: ArenaOverviewDto["marketRegime"]["level"]) {
  if (level === "PASS") return "paper-lab-gate-pill paper-lab-gate-pill--pass";
  if (level === "FAIL") return "paper-lab-gate-pill paper-lab-gate-pill--fail";
  return "paper-lab-gate-pill paper-lab-gate-pill--warning";
}

export function MarketRegimeCard({ regime }: { regime: ArenaOverviewDto["marketRegime"] }) {
  const labels = regime.labels?.length ? regime.labels : regime.label.split(" · ").filter(Boolean);
  const confidence = regime.confidence ?? 0;

  return (
    <PaperLabPanel title="Chế độ thị trường" testId="paper-lab-regime-card">
      <div className="flex gap-4 items-start">
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
          <span className={gatePillClass(regime.level)}>Gate 1: {regime.level}</span>
        </div>
      </div>
    </PaperLabPanel>
  );
}
