"use client";

import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { useState } from "react";
import { PaperOnlyDisclaimerBanner } from "./PaperOnlyDisclaimerBanner";
import { AgentExecutionModeBanner } from "./AgentExecutionModeBanner";
import { RegimeBanner } from "./RegimeBanner";
import { ArenaOverviewStrip } from "./ArenaOverviewStrip";
import { AgentLeaderboardTable } from "./AgentLeaderboardTable";
import { AgentPortfolioCards } from "./AgentPortfolioCards";
import { OpenPositionsTable } from "./OpenPositionsTable";
import { DecisionsLogTable } from "./DecisionsLogTable";
import { CioRecommendationPanel } from "./CioRecommendationPanel";
import "./paper-lab-workstation.css";

type TabId = "positions" | "decisions" | "replay";

export function PaperLabArenaDeck({ data }: { data: PaperLabPageDto }) {
  const [tab, setTab] = useState<TabId>("positions");

  return (
    <div data-testid="paper-lab-arena">
      <PaperOnlyDisclaimerBanner />
      {data.overview.executionMode && (
        <AgentExecutionModeBanner mode={data.overview.executionMode} />
      )}
      <RegimeBanner regime={data.overview.marketRegime} />
      <ArenaOverviewStrip overview={data.overview} />

      <div className="paper-lab-grid-2 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
            Agent Leaderboard
          </h2>
          <AgentLeaderboardTable rows={data.leaderboard} />
        </div>
        <CioRecommendationPanel cio={data.cio} />
      </div>

      <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
        Agent Portfolios
      </h2>
      <AgentPortfolioCards portfolios={data.portfolios} />

      <div className="paper-lab-tabs">
        {(
          [
            ["positions", "Open Positions"],
            ["decisions", "Decisions Log"],
            ["replay", "Battle Replay"],
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

      {tab === "positions" && <OpenPositionsTable positions={data.positions} />}
      {tab === "decisions" && <DecisionsLogTable decisions={data.decisions} />}
      {tab === "replay" && (
        <div data-testid="paper-lab-battle-replay">
          <p className="text-sm text-slate-400 mb-2">
            {data.battleReplay.sessionDate} — {data.battleReplay.symbol}
          </p>
          <div className="paper-lab-table-wrap">
            <table className="paper-lab-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Conf</th>
                  <th>Reasoning</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {data.battleReplay.rows.map((row) => (
                  <tr key={row.agentId}>
                    <td>{row.agentName}</td>
                    <td>{row.action}</td>
                    <td className="tabular-nums">{(row.confidence * 100).toFixed(0)}%</td>
                    <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{row.reasoning}</td>
                    <td>{row.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
