"use client";

import { useState } from "react";
import { Sparkline } from "@/components/command-deck/ui/sparkline";
import type { PortfolioCardDto } from "@/lib/paper-lab/types/arena-dto";
import { formatArenaVndCompact, formatPctSigned } from "@/lib/paper-lab/ui/arena-format";
import { AgentDetailDrawer } from "./AgentDetailDrawer";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function styleInitial(style: string): string {
  return style.slice(0, 2).toUpperCase();
}

export function AgentPortfolioRail({
  portfolios,
  activeAgentId,
  onSelectAgent,
}: {
  portfolios: PortfolioCardDto[];
  activeAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
}) {
  const [drawerAgentId, setDrawerAgentId] = useState<string | null>(null);
  const drawerPortfolio = portfolios.find((p) => p.agentId === drawerAgentId) ?? null;

  return (
    <>
      <section className="paper-lab-portfolio-section" data-testid="paper-lab-portfolios">
        <div className="paper-lab-portfolio-section__head">
          <h2 className="paper-lab-panel__title" style={{ marginBottom: 0 }}>
            Agent Portfolios ({portfolios.length})
          </h2>
          <span className="text-xs text-[var(--pl-faint)]">Click to filter · i for details</span>
        </div>
        <div className="paper-lab-agent-rail">
        {portfolios.map((p) => {
          const pnlClass = p.pnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative";
          const sparkColor = p.pnlPct >= 0 ? "rgb(74,222,128)" : "rgb(248,113,113)";
          const isActive = activeAgentId === p.agentId;

          return (
            <article
              key={p.agentId}
              className={`paper-lab-agent-tile ${isActive ? "paper-lab-agent-tile--active" : ""}`}
              data-agent-id={p.agentId}
              onClick={() => onSelectAgent?.(p.agentId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectAgent?.(p.agentId);
                }
              }}
              role={onSelectAgent ? "button" : undefined}
              tabIndex={onSelectAgent ? 0 : undefined}
            >
              <button
                type="button"
                className="paper-lab-agent-tile__details-btn"
                aria-label={`Details for ${p.agentName}`}
                data-testid={`agent-details-btn-${p.agentId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerAgentId(p.agentId);
                }}
              >
                i
              </button>

              <div className="paper-lab-agent-tile__head">
                <span className="paper-lab-agent-tile__avatar" aria-hidden>
                  {styleInitial(p.style)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="paper-lab-agent-tile__name paper-lab-truncate">{p.agentName}</div>
                  <span className="paper-lab-agent-tile__style">{p.style}</span>
                </div>
                <Sparkline values={p.navSparkline} color={sparkColor} width={48} height={16} />
              </div>
              <div className="paper-lab-agent-tile__metrics">
                <div className="min-w-0">
                  <span className="paper-lab-agent-tile__label">NAV</span>
                  <span className="paper-lab-agent-tile__value paper-lab-truncate">
                    {formatArenaVndCompact(p.navVnd)}
                  </span>
                </div>
                <div className="text-right min-w-0">
                  <span className="paper-lab-agent-tile__label">PnL</span>
                  <span className={`paper-lab-agent-tile__value tabular-nums ${pnlClass}`}>
                    {formatPctSigned(p.pnlPct)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </section>

      <AgentDetailDrawer
        portfolio={drawerPortfolio}
        open={drawerPortfolio !== null}
        onClose={() => setDrawerAgentId(null)}
        onFilterAgent={onSelectAgent}
      />
    </>
  );
}
