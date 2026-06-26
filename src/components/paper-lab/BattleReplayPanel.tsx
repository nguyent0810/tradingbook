import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { BattleReplayCardList } from "./BattleReplayCardList";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import { VoteSegmentBar } from "./ui/VoteSegmentBar";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function countVotes(rows: PaperLabPageDto["battleReplay"]["rows"]) {
  const buy = rows.filter((r) => r.action === "BUY" || r.action === "ADD").length;
  const hold = rows.filter((r) => r.action === "HOLD").length;
  const sell = rows.filter(
    (r) => r.action === "SELL" || r.action === "EXIT" || r.action === "REDUCE"
  ).length;
  return { buy, hold, sell, reduce: 0 };
}

function BattleReplayContent({
  battleReplay,
}: {
  battleReplay: PaperLabPageDto["battleReplay"];
}) {
  const { sessionDate, symbol, insight, rows } = battleReplay;

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No battle replay data for this session.</p>;
  }

  const votes = countVotes(rows);

  return (
    <div data-testid="paper-lab-battle-replay">
      <div className="mb-3">
        <p className="text-sm text-slate-300 font-medium">
          {sessionDate} — <span className="font-mono">{symbol}</span>
        </p>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{insight}</p>
      </div>
      <VoteSegmentBar votes={votes} />
      <div className="paper-lab-battle-cards-wrap paper-lab-battle-cards-wrap--tab">
        <BattleReplayCardList rows={rows} />
      </div>
    </div>
  );
}

export function BattleReplayPanel({
  battleReplay,
  embedded = false,
}: {
  battleReplay: PaperLabPageDto["battleReplay"];
  embedded?: boolean;
}) {
  if (embedded) {
    return <BattleReplayContent battleReplay={battleReplay} />;
  }

  if (battleReplay.rows.length === 0) {
    return (
      <PaperLabPanel title="Battle Replay" testId="paper-lab-battle-replay">
        <p className="text-sm text-slate-400">No battle replay data for this session.</p>
      </PaperLabPanel>
    );
  }

  return (
    <PaperLabPanel title="Battle Replay" testId="paper-lab-battle-replay">
      <BattleReplayContent battleReplay={battleReplay} />
    </PaperLabPanel>
  );
}
