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
    overview.executionMode?.label ?? "Agent theo quy tắc đang hoạt động · LLM tắt";

  return (
    <header className="paper-lab-header-grid" data-testid="paper-lab-header-grid">
      <PaperLabPanel className="paper-lab-title-block">
        <h1>Đấu trường</h1>
        <div className="paper-lab-title-block__chips">
          <span className="paper-lab-title-chip paper-lab-title-chip--paper" data-testid="paper-lab-disclaimer">
            Chỉ mô phỏng
          </span>
          <span className="paper-lab-title-chip">{overview.totalAgents} Agent</span>
          <span className="paper-lab-title-chip">
            {formatArenaVndCompact(overview.totalVirtualCapitalVnd)} vốn mô phỏng
          </span>
          <span className="paper-lab-title-chip paper-lab-title-chip--mode">{modeLabel}</span>
        </div>
        <p className="paper-lab-title-block__status">
          Các agent cạnh tranh trên cùng dữ liệu thị trường.
        </p>
        <p className="paper-lab-title-block__lead">
          Thông tin chế độ thị trường · đối đầu agent · chỉ mô phỏng
        </p>
        {overview.stale && (
          <p className="text-xs text-[var(--pl-amber)] mt-2 line-clamp-2">
            Dữ liệu thị trường có thể bị trễ — kiểm tra chế độ thị trường và độ mới của dữ liệu
            trước khi diễn giải quyết định của agent.
          </p>
        )}
      </PaperLabPanel>
      <MarketRegimeCard regime={overview.marketRegime} />
      <MarketOverviewCard pulse={overview.marketPulse} />
      <CioRecommendationPanel cio={cio} variant="compact" />
    </header>
  );
}
