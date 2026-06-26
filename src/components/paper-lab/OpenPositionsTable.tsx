import type { OpenPositionRowDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

export function OpenPositionsTable({ positions }: { positions: OpenPositionRowDto[] }) {
  if (positions.length === 0) {
    return <p className="text-sm text-slate-400">No open positions.</p>;
  }

  return (
    <div className="paper-lab-table-wrap" data-testid="paper-lab-positions">
      <table className="paper-lab-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Symbol</th>
            <th>Entry</th>
            <th>Current</th>
            <th>Stop</th>
            <th>TP</th>
            <th>Qty</th>
            <th>Alloc %</th>
            <th>Risk</th>
            <th>uPnL</th>
            <th>uPnL %</th>
            <th>R</th>
            <th>Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id}>
              <td>{p.agentName}</td>
              <td className="font-mono">{p.symbol}</td>
              <td className="tabular-nums">{p.entryPriceKVnd.toFixed(1)}</td>
              <td className="tabular-nums">{p.currentPriceKVnd.toFixed(1)}</td>
              <td className="tabular-nums">{p.stopLossKVnd.toFixed(1)}</td>
              <td className="tabular-nums">{p.takeProfitKVnd.toFixed(1)}</td>
              <td className="tabular-nums">{p.quantity}</td>
              <td className="tabular-nums">{p.allocationPct.toFixed(1)}%</td>
              <td className="tabular-nums">{(p.riskAmountVnd / 1_000_000).toFixed(2)}M</td>
              <td
                className={`tabular-nums ${p.unrealizedPnlVnd >= 0 ? "paper-lab-positive" : "paper-lab-negative"}`}
              >
                {(p.unrealizedPnlVnd / 1_000_000).toFixed(2)}M
              </td>
              <td
                className={`tabular-nums ${p.unrealizedPnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative"}`}
              >
                {p.unrealizedPnlPct >= 0 ? "+" : ""}
                {p.unrealizedPnlPct.toFixed(2)}%
              </td>
              <td className="tabular-nums">{p.rMultiple.toFixed(2)}R</td>
              <td className="tabular-nums">{p.holdingDays}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
