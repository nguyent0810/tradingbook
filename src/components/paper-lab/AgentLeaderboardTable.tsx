import type { LeaderboardRowDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

function formatVnd(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function rankChangeLabel(change: number): { text: string; className: string } {
  if (change > 0) return { text: `▲${change}`, className: "paper-lab-rank-up" };
  if (change < 0) return { text: `▼${Math.abs(change)}`, className: "paper-lab-rank-down" };
  return { text: "—", className: "paper-lab-rank-flat" };
}

export function AgentLeaderboardTable({ rows }: { rows: LeaderboardRowDto[] }) {
  return (
    <div className="paper-lab-table-wrap" data-testid="paper-lab-leaderboard">
      <table className="paper-lab-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Agent</th>
            <th>Style</th>
            <th>NAV</th>
            <th>PnL %</th>
            <th>Realized</th>
            <th>Unrealized</th>
            <th>Win %</th>
            <th>Max DD</th>
            <th>Sharpe</th>
            <th>Trades</th>
            <th>Open</th>
            <th>Δ Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rc = rankChangeLabel(row.rankChange);
            return (
              <tr key={row.agentId} data-testid={`leaderboard-row-${row.agentId}`}>
                <td className="tabular-nums">{row.rank}</td>
                <td>{row.agentName}</td>
                <td>{row.style}</td>
                <td className="tabular-nums">{formatVnd(row.navVnd)}</td>
                <td
                  className={`tabular-nums ${row.pnlPct >= 0 ? "paper-lab-positive" : "paper-lab-negative"}`}
                >
                  {row.pnlPct >= 0 ? "+" : ""}
                  {row.pnlPct.toFixed(2)}%
                </td>
                <td className="tabular-nums">{formatVnd(row.realizedPnlVnd)}</td>
                <td className="tabular-nums">{formatVnd(row.unrealizedPnlVnd)}</td>
                <td className="tabular-nums">{(row.winRate * 100).toFixed(0)}%</td>
                <td className="tabular-nums">{row.maxDrawdownPct.toFixed(1)}%</td>
                <td className="tabular-nums">{row.sharpeLike.toFixed(2)}</td>
                <td className="tabular-nums">{row.tradeCount}</td>
                <td className="tabular-nums">{row.openPositions}</td>
                <td className={rc.className}>{rc.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
