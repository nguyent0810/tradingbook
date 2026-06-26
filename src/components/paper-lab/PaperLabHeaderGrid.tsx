import type { ArenaOverviewDto, CioPanelDto } from "@/lib/paper-lab/types/arena-dto";
import { CioRecommendationPanel } from "./CioRecommendationPanel";
import { MarketOverviewCard } from "./MarketOverviewCard";
import { MarketRegimeCard } from "./MarketRegimeCard";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

export function PaperLabHeaderGrid({
  overview,
  cio,
}: {
  overview: ArenaOverviewDto;
  cio: CioPanelDto;
}) {
  return (
    <header className="paper-lab-header-grid" data-testid="paper-lab-header-grid">
      <PaperLabPanel className="paper-lab-title-block">
        <span className="paper-lab-paper-only-badge" data-testid="paper-lab-disclaimer">
          Paper only
        </span>
        <h1>AI Trading Arena</h1>
        <p className="paper-lab-title-block__lead">
          Virtual agent competition · regime intelligence · research only
        </p>
        {overview.stale && (
          <p className="text-xs text-[var(--pl-amber)] mt-2 line-clamp-2">
            Market data may be stale — review regime and bar freshness before interpreting
            agent decisions.
          </p>
        )}
      </PaperLabPanel>
      <MarketRegimeCard regime={overview.marketRegime} />
      <MarketOverviewCard pulse={overview.marketPulse} />
      <CioRecommendationPanel cio={cio} variant="compact" />
    </header>
  );
}
