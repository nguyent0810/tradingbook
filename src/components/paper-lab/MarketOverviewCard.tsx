import type { MarketPulseDto } from "@/lib/paper-lab/types/arena-dto";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

function formatIndex(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function MarketOverviewCard({ pulse }: { pulse: MarketPulseDto }) {
  return (
    <PaperLabPanel title="Market Overview" testId="paper-lab-market-overview">
      <div className="paper-lab-market-stat">
        <span className="paper-lab-market-stat__label">VNINDEX</span>
        <span className="tabular-nums">
          {formatIndex(pulse.vnindexClose)}{" "}
          <span className={pulse.vnindexChangePct != null && pulse.vnindexChangePct >= 0 ? "text-[var(--pl-green)]" : "text-[var(--pl-red)]"}>
            ({formatPct(pulse.vnindexChangePct)})
          </span>
        </span>
      </div>
      <div className="paper-lab-market-stat">
        <span className="paper-lab-market-stat__label" title="Breadth regime proxy — not exchange adv/dec">
          Breadth
        </span>
        <span className="truncate-1">{pulse.breadthLabel}</span>
      </div>
      <div className="paper-lab-market-stat">
        <span className="paper-lab-market-stat__label">Liquidity</span>
        <span>{pulse.liquidityLabel}</span>
      </div>
      <div className="paper-lab-market-stat">
        <span className="paper-lab-market-stat__label">Volatility</span>
        <span>{pulse.volatilityLabel}</span>
      </div>
    </PaperLabPanel>
  );
}
