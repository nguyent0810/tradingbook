"use client";

import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { useMemo, useState } from "react";
import { AgentPortfolioRail } from "./AgentPortfolioRail";
import { DecisionsLogTable } from "./DecisionsLogTable";
import { MarketRegimeExplanationCard } from "./MarketRegimeExplanationCard";
import { PaperLabHeaderGrid } from "./PaperLabHeaderGrid";
import { PaperLabWorkspaceTabs } from "./PaperLabWorkspaceTabs";
import { RecentBattlesCard } from "./RecentBattlesCard";
import "./paper-lab-command-center.css";
import "./paper-lab-workstation.css";

export function PaperLabArenaDeck({ data }: { data: PaperLabPageDto }) {
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  const filteredPositions = useMemo(() => {
    if (!agentFilter) return data.positions;
    return data.positions.filter((p) => p.agentId === agentFilter);
  }, [data.positions, agentFilter]);

  return (
    <div data-testid="paper-lab-arena">
      <PaperLabHeaderGrid overview={data.overview} cio={data.cio} />

      <AgentPortfolioRail
        portfolios={data.portfolios}
        activeAgentId={agentFilter}
        onSelectAgent={(id) => {
          setAgentFilter((prev) => (prev === id ? null : id));
        }}
      />
      {agentFilter && (
        <button
          type="button"
          className="paper-lab-link-btn text-xs mb-3"
          onClick={() => setAgentFilter(null)}
        >
          Clear filter: {data.portfolios.find((p) => p.agentId === agentFilter)?.agentName}
        </button>
      )}

      <div className="paper-lab-recent-battles-strip">
        <RecentBattlesCard battles={data.recentBattles} />
      </div>

      <PaperLabWorkspaceTabs
        positions={filteredPositions}
        battleReplay={data.battleReplay}
      />

      <div className="paper-lab-bottom-grid">
        <DecisionsLogTable decisions={data.decisions} />
        <MarketRegimeExplanationCard regime={data.overview.marketRegime} />
      </div>
    </div>
  );
}
