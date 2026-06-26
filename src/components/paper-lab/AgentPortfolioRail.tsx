"use client";

import Link from "next/link";
import { Sparkline } from "@/components/command-deck/ui/sparkline";
import type { PortfolioCardDto } from "@/lib/paper-lab/types/arena-dto";
import { formatArenaVndCompact, formatPctSigned } from "@/lib/paper-lab/ui/arena-format";
import "./paper-lab-workstation.css";

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
  return (
    <section className="paper-lab-agent-rail" data-testid="paper-lab-portfolios">
      {portfolios.map((p) => {
        const pnlClass = p.pnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative";
        const sparkColor = p.pnlPct >= 0 ? "rgb(74,222,128)" : "rgb(248,113,113)";
        const isActive = activeAgentId === p.agentId;

        return (
          <article
            key={p.agentId}
            className={`paper-lab-agent-tile group relative ${isActive ? "paper-lab-agent-tile--active" : ""}`}
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
            <div className="paper-lab-agent-tile__head">
              <span className="paper-lab-agent-tile__avatar" aria-hidden>
                {styleInitial(p.style)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="paper-lab-agent-tile__name truncate">{p.agentName}</div>
                <span className="paper-lab-agent-tile__style">{p.style}</span>
              </div>
              <Sparkline values={p.navSparkline} color={sparkColor} width={56} height={18} />
            </div>
            <div className="paper-lab-agent-tile__metrics">
              <div>
                <span className="paper-lab-agent-tile__label">NAV</span>
                <span className="paper-lab-agent-tile__value">{formatArenaVndCompact(p.navVnd)}</span>
              </div>
              <div className="text-right">
                <span className="paper-lab-agent-tile__label">PnL</span>
                <span className={`paper-lab-agent-tile__value tabular-nums ${pnlClass}`}>
                  {formatPctSigned(p.pnlPct)}
                </span>
              </div>
            </div>

            <div className="paper-lab-agent-popover" role="tooltip">
              <div className="paper-lab-agent-popover__title">{p.agentName}</div>
              <dl className="paper-lab-agent-popover__grid">
                <div><dt>Cash</dt><dd>{formatArenaVndCompact(p.cashVnd)}</dd></div>
                <div><dt>Invested</dt><dd>{formatArenaVndCompact(p.investedVnd)}</dd></div>
                <div><dt>Exposure</dt><dd>{p.exposurePct.toFixed(1)}%</dd></div>
                <div><dt>Open risk</dt><dd>{formatArenaVndCompact(p.openRiskVnd)}</dd></div>
                <div><dt>Buying power</dt><dd>{formatArenaVndCompact(p.buyingPowerVnd)}</dd></div>
                <div><dt>Win rate</dt><dd>{(p.winRate * 100).toFixed(0)}%</dd></div>
                <div><dt>Max DD</dt><dd>{p.maxDrawdownPct.toFixed(1)}%</dd></div>
              </dl>
              {Object.keys(p.sectorExposure).length > 0 && (
                <p className="paper-lab-agent-popover__sectors text-xs text-slate-400 mt-2">
                  Sectors:{" "}
                  {Object.entries(p.sectorExposure)
                    .slice(0, 3)
                    .map(([k, v]) => `${k} ${v.toFixed(0)}%`)
                    .join(" · ")}
                </p>
              )}
              <Link
                href={`/paper-lab/agents/${p.agentId}`}
                className="paper-lab-agent-popover__link"
                onClick={(e) => e.stopPropagation()}
              >
                View agent →
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}
