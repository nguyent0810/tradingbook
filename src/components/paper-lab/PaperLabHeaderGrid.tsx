import type { ArenaOverviewDto, CioPanelDto } from "@/lib/paper-lab/types/arena-dto";
import { formatArenaVndCompact } from "@/lib/paper-lab/ui/arena-format";
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
  const modeLabel =
    overview.executionMode?.label ?? "Rule Agents Active · LLM Disabled";

  return (
    <header className="paper-lab-header-grid" data-testid="paper-lab-header-grid">
      <PaperLabPanel className="paper-lab-title-block">
        <h1>AI Trading Arena</h1>
        <div className="paper-lab-title-block__chips">
          <span className="paper-lab-title-chip paper-lab-title-chip--paper" data-testid="paper-lab-disclaimer">
            Paper Only
          </span>
          <span className="paper-lab-title-chip">{overview.totalAgents} Agents</span>
          <span className="paper-lab-title-chip">
            {formatArenaVndCompact(overview.totalVirtualCapitalVnd)} virtual capital
          </span>
          <span className="paper-lab-title-chip paper-lab-title-chip--mode">{modeLabel}</span>
        </div>
        <p className="paper-lab-title-block__status">
          Virtual funds competing under identical market data.
        </p>
        <p className="paper-lab-title-block__lead">
          Regime intelligence · agent battles · research only
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
