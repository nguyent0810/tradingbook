import type { PortfolioCardDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

function formatVnd(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M ₫`;
}

export function AgentPortfolioCards({ portfolios }: { portfolios: PortfolioCardDto[] }) {
  return (
    <section className="paper-lab-portfolio-scroll" data-testid="paper-lab-portfolios">
      {portfolios.map((p) => (
        <article key={p.agentId} className="paper-lab-portfolio-card">
          <div className="paper-lab-portfolio-card__name">{p.agentName}</div>
          <div className="paper-lab-portfolio-card__style">{p.style}</div>
          <dl className="space-y-1 text-xs text-slate-300">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Starting</dt>
              <dd className="tabular-nums">{formatVnd(p.startingCapitalVnd)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Cash</dt>
              <dd className="tabular-nums">{formatVnd(p.cashVnd)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Invested</dt>
              <dd className="tabular-nums">{formatVnd(p.investedVnd)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">NAV</dt>
              <dd className="tabular-nums font-semibold text-slate-100">
                {formatVnd(p.navVnd)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Exposure</dt>
              <dd className="tabular-nums">{p.exposurePct.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Open risk</dt>
              <dd className="tabular-nums">{formatVnd(p.openRiskVnd)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Buying power</dt>
              <dd className="tabular-nums">{formatVnd(p.buyingPowerVnd)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
