"use client";

import Link from "next/link";
import type { PortfolioCardDto } from "@/lib/paper-lab/types/arena-dto";
import { formatArenaVndCompact, formatPctSigned } from "@/lib/paper-lab/ui/arena-format";
import { PaperLabSideDrawer } from "./ui/PaperLabSideDrawer";
import "./paper-lab-workstation.css";

export function AgentDetailDrawer({
  portfolio,
  open,
  onClose,
  onFilterAgent,
}: {
  portfolio: PortfolioCardDto | null;
  open: boolean;
  onClose: () => void;
  onFilterAgent?: (agentId: string) => void;
}) {
  if (!portfolio) return null;

  const pnlClass = portfolio.pnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative";

  return (
    <PaperLabSideDrawer
      open={open}
      title={portfolio.agentName}
      onClose={onClose}
      testId="paper-lab-agent-drawer"
    >
      <p className="text-xs text-[var(--text-tertiary)] mb-3">{portfolio.style}</p>

      <dl className="paper-lab-drawer-grid">
        <div>
          <dt>NAV</dt>
          <dd className="paper-lab-cell-strong">{formatArenaVndCompact(portfolio.navVnd)}</dd>
        </div>
        <div>
          <dt>PnL</dt>
          <dd className={`paper-lab-cell-strong tabular-nums ${pnlClass}`}>
            {formatPctSigned(portfolio.pnlPct)}
          </dd>
        </div>
        <div>
          <dt>Cash</dt>
          <dd>{formatArenaVndCompact(portfolio.cashVnd)}</dd>
        </div>
        <div>
          <dt>Invested</dt>
          <dd>{formatArenaVndCompact(portfolio.investedVnd)}</dd>
        </div>
        <div>
          <dt>Exposure</dt>
          <dd>{portfolio.exposurePct.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Open risk</dt>
          <dd>{formatArenaVndCompact(portfolio.openRiskVnd)}</dd>
        </div>
        <div>
          <dt>Buying power</dt>
          <dd>{formatArenaVndCompact(portfolio.buyingPowerVnd)}</dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd>{(portfolio.winRate * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Max DD</dt>
          <dd>{portfolio.maxDrawdownPct.toFixed(1)}%</dd>
        </div>
      </dl>

      {Object.keys(portfolio.sectorExposure).length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] mb-1">Sector exposure</div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-0.5">
            {Object.entries(portfolio.sectorExposure).map(([k, v]) => (
              <li key={k}>
                {k}: {v.toFixed(0)}%
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {onFilterAgent && (
          <button
            type="button"
            className="paper-lab-json-btn w-full text-center"
            onClick={() => {
              onFilterAgent(portfolio.agentId);
              onClose();
            }}
          >
            Filter positions for this agent
          </button>
        )}
        <Link
          href={`/paper-lab/agents/${portfolio.agentId}`}
          className="paper-lab-link-btn text-sm text-center block"
          onClick={onClose}
        >
          View agent page →
        </Link>
      </div>
    </PaperLabSideDrawer>
  );
}
