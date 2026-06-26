"use client";

import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { useMemo, useState } from "react";
import { PaperOnlyDisclaimerBanner } from "./PaperOnlyDisclaimerBanner";
import { AgentExecutionModeBanner } from "./AgentExecutionModeBanner";
import { RegimeBanner } from "./RegimeBanner";
import { ArenaOverviewStrip } from "./ArenaOverviewStrip";
import { AgentLeaderboardTable } from "./AgentLeaderboardTable";
import { AgentPortfolioRail } from "./AgentPortfolioRail";
import { OpenPositionsTable } from "./OpenPositionsTable";
import { DecisionsLogTable } from "./DecisionsLogTable";
import { CioRecommendationPanel } from "./CioRecommendationPanel";
import { BattleReplayPanel } from "./BattleReplayPanel";
import "./paper-lab-workstation.css";

type TabId = "workspace" | "decisions";

export function PaperLabArenaDeck({ data }: { data: PaperLabPageDto }) {
  const [tab, setTab] = useState<TabId>("workspace");
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  const filteredPositions = useMemo(() => {
    if (!agentFilter) return data.positions;
    return data.positions.filter((p) => p.agentId === agentFilter);
  }, [data.positions, agentFilter]);

  const leaderboardRows = leaderboardExpanded
    ? data.leaderboard
    : data.leaderboard.slice(0, 5);

  return (
    <div data-testid="paper-lab-arena">
      <PaperOnlyDisclaimerBanner />
      {data.overview.executionMode && (
        <AgentExecutionModeBanner mode={data.overview.executionMode} />
      )}
      {data.overview.stale && (
        <p className="paper-lab-stale-banner text-xs text-amber-200 mb-3 px-3 py-2 rounded border border-amber-500/30 bg-amber-950/20">
          Market data may be stale — review regime and bar freshness before interpreting agent decisions.
        </p>
      )}
      <RegimeBanner regime={data.overview.marketRegime} />
      <ArenaOverviewStrip overview={data.overview} />

      <div className="paper-lab-grid-2 mb-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Agent Leaderboard
            </h2>
            {data.leaderboard.length > 5 && (
              <button
                type="button"
                className="paper-lab-link-btn text-xs"
                onClick={() => setLeaderboardExpanded((v) => !v)}
              >
                {leaderboardExpanded ? "Show top 5" : `View all ${data.leaderboard.length}`}
              </button>
            )}
          </div>
          <AgentLeaderboardTable rows={leaderboardRows} />
        </div>
        <CioRecommendationPanel cio={data.cio} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Agent Portfolios
        </h2>
        <span className="text-xs text-slate-500">
          Click card to filter · Details icon for portfolio breakdown
        </span>
      </div>
      <AgentPortfolioRail
        portfolios={data.portfolios}
        activeAgentId={agentFilter}
        onSelectAgent={(id) => {
          setAgentFilter((prev) => (prev === id ? null : id));
          setTab("workspace");
        }}
      />
      {agentFilter && (
        <button
          type="button"
          className="paper-lab-link-btn text-xs mt-2 mb-4"
          onClick={() => setAgentFilter(null)}
        >
          Clear filter: {data.portfolios.find((p) => p.agentId === agentFilter)?.agentName}
        </button>
      )}
      {!agentFilter && <div className="mb-4" />}

      <div className="paper-lab-tabs">
        {(
          [
            ["workspace", "Positions & Battle"],
            ["decisions", "Decisions Log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`paper-lab-tab ${tab === id ? "paper-lab-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "workspace" && (
        <div className="arena-bottom-grid">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Open Positions
            </h3>
            <OpenPositionsTable positions={filteredPositions} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Battle Replay
            </h3>
            <BattleReplayPanel battleReplay={data.battleReplay} />
          </div>
        </div>
      )}
      {tab === "decisions" && <DecisionsLogTable decisions={data.decisions} />}
    </div>
  );
}
