import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

function formatVnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B ₫`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export function ArenaOverviewStrip({ overview }: { overview: ArenaOverviewDto }) {
  return (
    <section className="paper-lab-kpi-grid" data-testid="paper-lab-overview">
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Agents</div>
        <div className="paper-lab-kpi__value tabular-nums">{overview.totalAgents}</div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Virtual capital</div>
        <div className="paper-lab-kpi__value tabular-nums">
          {formatVnd(overview.totalVirtualCapitalVnd)}
        </div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Best agent</div>
        <div className="paper-lab-kpi__value">
          {overview.bestAgent.name}{" "}
          <span className="paper-lab-positive tabular-nums">
            +{overview.bestAgent.returnPct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Worst agent</div>
        <div className="paper-lab-kpi__value">
          {overview.worstAgent.name}{" "}
          <span
            className={
              overview.worstAgent.returnPct >= 0 ? "paper-lab-positive" : "paper-lab-negative"
            }
          >
            {overview.worstAgent.returnPct >= 0 ? "+" : ""}
            {overview.worstAgent.returnPct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Open positions</div>
        <div className="paper-lab-kpi__value tabular-nums">{overview.totalOpenPositions}</div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Market regime</div>
        <div className="paper-lab-kpi__value">{overview.marketRegime.level}</div>
      </div>
      <div className="paper-lab-kpi">
        <div className="paper-lab-kpi__label">Last evaluation</div>
        <div className="paper-lab-kpi__value !text-[0.85rem]">
          {overview.latestEvaluationAt
            ? new Date(overview.latestEvaluationAt).toLocaleString("vi-VN")
            : "—"}
        </div>
      </div>
    </section>
  );
}
