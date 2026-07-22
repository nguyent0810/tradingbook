import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import { buildRegimeExplanation, formatRegimeDimension } from "@/lib/paper-lab/ui/arena-copy";
import { PaperLabDetailsDialog } from "./ui/PaperLabDetailsDialog";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

export function MarketRegimeExplanationCard({
  regime,
}: {
  regime: ArenaOverviewDto["marketRegime"];
}) {
  const explanation = buildRegimeExplanation(regime);
  const dimensions = regime.dimensions ?? {};

  return (
    <PaperLabPanel title="Giải thích chế độ thị trường" testId="paper-lab-regime-explanation" tone="soft">
      <p className="text-sm font-medium text-[var(--pl-text)] mb-2">{regime.label}</p>
      <p className="text-xs text-[var(--pl-muted)] line-clamp-3 mb-3">{explanation}</p>
      <PaperLabDetailsDialog title="Các chiều chế độ" triggerLabel="Xem chi tiết chế độ">
        <dl className="text-xs space-y-2 text-[var(--pl-muted)]">
          {Object.entries(dimensions).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--pl-faint)] uppercase tracking-wide text-[0.6rem]">{k}</dt>
              <dd className="text-[var(--pl-text)]">{formatRegimeDimension(v)}</dd>
            </div>
          ))}
          {Object.keys(dimensions).length === 0 && (
            <p>Không có phân tích chi tiết cho phiên này.</p>
          )}
        </dl>
      </PaperLabDetailsDialog>
    </PaperLabPanel>
  );
}
