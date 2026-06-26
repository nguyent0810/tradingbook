import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct, confidenceBand } from "@/lib/paper-lab/ui/arena-format";
import { BattleReplayCardList } from "./BattleReplayCardList";
import { ActionBadge } from "./ui/ActionBadge";
import { StatusPill } from "./ui/StatusPill";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function BattleVoteSummary({ rows }: { rows: PaperLabPageDto["battleReplay"]["rows"] }) {
  const buy = rows.filter((r) => r.action === "BUY" || r.action === "ADD").length;
  const hold = rows.filter((r) => r.action === "HOLD").length;
  const sell = rows.filter(
    (r) => r.action === "SELL" || r.action === "EXIT" || r.action === "REDUCE"
  ).length;

  return (
    <div className="paper-lab-battle-votes flex flex-wrap gap-3 text-xs mb-3">
      <span className="paper-lab-battle-vote paper-lab-battle-vote--buy">BUY {buy}</span>
      <span className="paper-lab-battle-vote paper-lab-battle-vote--hold">HOLD {hold}</span>
      <span className="paper-lab-battle-vote paper-lab-battle-vote--sell">SELL/REDUCE {sell}</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "WIN") return <StatusPill status="CLOSED_TP" />;
  if (outcome === "LOSS") return <StatusPill status="CLOSED_SL" />;
  if (outcome === "OPEN") return <StatusPill status="OPEN" />;
  return <span className="text-slate-500 text-xs">{outcome}</span>;
}

export function BattleReplayPanel({
  battleReplay,
}: {
  battleReplay: PaperLabPageDto["battleReplay"];
}) {
  const { sessionDate, symbol, insight, rows } = battleReplay;

  if (rows.length === 0) {
    return (
      <PaperLabPanel title="Battle Replay" testId="paper-lab-battle-replay">
        <p className="text-sm text-slate-400">No battle replay data for this session.</p>
      </PaperLabPanel>
    );
  }

  return (
    <PaperLabPanel title="Battle Replay" testId="paper-lab-battle-replay">
      <div className="mb-3">
        <p className="text-sm text-slate-300 font-medium">
          {sessionDate} — <span className="font-mono">{symbol}</span>
        </p>
        <p className="text-xs text-slate-400 mt-1 paper-lab-line-clamp-3">{insight}</p>
      </div>
      <BattleVoteSummary rows={rows} />

      <div className="paper-lab-battle-cards-wrap">
        <BattleReplayCardList rows={rows} />
      </div>

      <div className="paper-lab-battle-table-wrap paper-lab-table-wrap paper-lab-battle-table--wide">
        <table className="paper-lab-table paper-lab-table--battle">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Action</th>
              <th>Conf</th>
              <th>Why it likes the trade</th>
              <th>Why it hesitates</th>
              <th>Style lens</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agentId}>
                <td>
                  <div className="paper-lab-truncate max-w-[120px]">{row.agentName}</div>
                  <span className="paper-lab-agent-tile__style">{row.style}</span>
                </td>
                <td><ActionBadge action={row.action} /></td>
                <td className="tabular-nums">
                  {formatConfidencePct(row.confidence)}
                  <span className="block text-[0.65rem] text-slate-500">{confidenceBand(row.confidence)}</span>
                </td>
                <td className="paper-lab-reasoning-cell">
                  {row.explanation.supporting.length > 0 ? (
                    <ul className="text-xs text-emerald-300/85 list-disc list-inside">
                      {row.explanation.supporting.slice(0, 3).map((s) => (
                        <li key={s} className="paper-lab-line-clamp-2">{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="paper-lab-reasoning-cell">
                  {row.explanation.opposing.length > 0 ? (
                    <ul className="text-xs text-amber-200/85 list-disc list-inside">
                      {row.explanation.opposing.slice(0, 3).map((s) => (
                        <li key={s} className="paper-lab-line-clamp-2">{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="text-xs text-slate-400 paper-lab-line-clamp-2 max-w-[180px]">
                  {row.explanation.styleLens}
                </td>
                <td><OutcomeBadge outcome={row.outcome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
