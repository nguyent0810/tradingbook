"use client";

import { useState } from "react";
import { Sparkline } from "@/components/command-deck/ui/sparkline";
import type { PortfolioCardDto } from "@/lib/paper-lab/types/arena-dto";
import { formatArenaVndCompact, formatPctSigned } from "@/lib/paper-lab/ui/arena-format";
import { AgentDetailDrawer } from "./AgentDetailDrawer";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function styleInitial(style: string): string {
  return style.slice(0, 2).toUpperCase();
}

function styleSlug(style: string): string {
  return style.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function AgentPortfolioRail({
  portfolios,
  activeAgentId,
  onSelectAgent,
  variant = "default",
}: {
  portfolios: PortfolioCardDto[];
  activeAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  variant?: "default" | "fund-strip";
}) {
  const [drawerAgentId, setDrawerAgentId] = useState<string | null>(null);
  const drawerPortfolio = portfolios.find((p) => p.agentId === drawerAgentId) ?? null;

  return (
    <>
      <section
        className={`paper-lab-portfolio-section ${variant === "fund-strip" ? "paper-lab-portfolio-section--fund-strip" : ""}`}
        data-testid="paper-lab-portfolios"
      >
        <div className="paper-lab-portfolio-section__head">
          <h2 className="paper-lab-panel__title" style={{ marginBottom: 0 }}>
            {variant === "fund-strip" ? "Agent League" : `Agent Portfolios (${portfolios.length})`}
          </h2>
          <span className="text-xs text-[var(--pl-faint)]">Click to filter · i for details</span>
        </div>
        <div className="paper-lab-agent-rail paper-lab-agent-rail--wide">
          {portfolios.map((p) => {
            const pnlClass = p.pnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative";
            const sparkColor = p.pnlPct >= 0 ? "rgb(74,222,128)" : "rgb(248,113,113)";
            const isActive = activeAgentId === p.agentId;

            return (
              <article
                key={p.agentId}
                className={`paper-lab-agent-tile paper-lab-agent-tile--wide ${isActive ? "paper-lab-agent-tile--active" : ""}`}
                data-agent-id={p.agentId}
                data-style={styleSlug(p.style)}
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

                {/* Select/filter affordance — a sibling of the details button (not an
                    ancestor) so no control contains another focusable control. */}
                <div
                  className="paper-lab-agent-tile__select"
                  style={{ display: "contents" }}
                  onClick={() => onSelectAgent?.(p.agentId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectAgent?.(p.agentId);
                    }
                  }}
                  role={onSelectAgent ? "button" : undefined}
                  tabIndex={onSelectAgent ? 0 : undefined}
                  aria-label={onSelectAgent ? `Select ${p.agentName} to filter` : undefined}
                >
                  <div className="paper-lab-agent-tile__head paper-lab-agent-tile__head--wide">
                    <span className="paper-lab-agent-tile__avatar" aria-hidden title={p.style}>
                      {styleInitial(p.style)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="paper-lab-agent-tile__name paper-lab-agent-tile__name--full">
                        {p.agentName}
                      </div>
                      <span className="paper-lab-agent-tile__style">{p.style}</span>
                    </div>
                    <Sparkline values={p.navSparkline} color={sparkColor} width={52} height={18} />
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
