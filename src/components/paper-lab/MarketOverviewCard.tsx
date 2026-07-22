import type { MarketPulseDto } from "@/lib/paper-lab/types/arena-dto";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-command-center.css";

function formatIndex(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function formatPct(n: number | null): { text: string; up: boolean | null } {
  if (n == null) return { text: "—", up: null };
  const sign = n >= 0 ? "+" : "";
  return { text: `${sign}${n.toFixed(2)}%`, up: n >= 0 };
}

export function MarketOverviewCard({ pulse }: { pulse: MarketPulseDto }) {
  const delta = formatPct(pulse.vnindexChangePct);

  return (
    <PaperLabPanel title="Tổng quan thị trường" testId="paper-lab-market-overview">
      <div className="paper-lab-market-grid">
        <div className="paper-lab-market-grid__cell paper-lab-market-grid__cell--hero">
          <div className="paper-lab-label">VNINDEX</div>
          <div>
            <span className="paper-lab-market-grid__value">{formatIndex(pulse.vnindexClose)}</span>
            {delta.up != null && (
              <span
                className={`paper-lab-market-grid__delta ${
                  delta.up ? "paper-lab-market-grid__delta--up" : "paper-lab-market-grid__delta--down"
                }`}
              >
                {delta.up ? "▲" : "▼"} {delta.text}
              </span>
            )}
          </div>
        </div>
        <div className="paper-lab-market-grid__cell">
          <div className="paper-lab-label" title="Chỉ báo độ rộng thị trường — không phải số mã tăng/giảm sàn">
            Độ rộng
          </div>
          <div className="text-sm truncate-1">{pulse.breadthLabel}</div>
        </div>
        <div className="paper-lab-market-grid__cell">
          <div className="paper-lab-label">Thanh khoản</div>
          <div className="text-sm">{pulse.liquidityLabel}</div>
        </div>
        <div className="paper-lab-market-grid__cell">
          <div className="paper-lab-label">Biến động</div>
          <div className="text-sm">{pulse.volatilityLabel}</div>
        </div>
      </div>
    </PaperLabPanel>
  );
}
