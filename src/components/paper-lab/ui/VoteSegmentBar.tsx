import "../paper-lab-command-center.css";

export type VoteCounts = {
  buy: number;
  hold: number;
  sell: number;
  reduce?: number;
};

export function VoteSegmentBar({
  votes,
  showLabels = true,
  className = "",
}: {
  votes: VoteCounts;
  showLabels?: boolean;
  className?: string;
}) {
  const sellTotal = votes.sell + (votes.reduce ?? 0);
  const total = votes.buy + votes.hold + sellTotal || 1;
  const buyPct = (votes.buy / total) * 100;
  const holdPct = (votes.hold / total) * 100;
  const sellPct = (sellTotal / total) * 100;

  return (
    <div className={`paper-lab-vote-segment ${className}`.trim()}>
      <div className="paper-lab-vote-bar" aria-hidden>
        <div className="paper-lab-vote-bar__seg paper-lab-vote-bar__seg--buy" style={{ width: `${buyPct}%` }} />
        <div className="paper-lab-vote-bar__seg paper-lab-vote-bar__seg--hold" style={{ width: `${holdPct}%` }} />
        <div className="paper-lab-vote-bar__seg paper-lab-vote-bar__seg--sell" style={{ width: `${sellPct}%` }} />
      </div>
      {showLabels && (
        <div className="paper-lab-vote-segment__labels">
          <span className="paper-lab-vote-segment__label paper-lab-vote-segment__label--buy">
            MUA {votes.buy}
          </span>
          <span className="paper-lab-vote-segment__label paper-lab-vote-segment__label--hold">
            GIỮ {votes.hold}
          </span>
          <span className="paper-lab-vote-segment__label paper-lab-vote-segment__label--sell">
            BÁN/GIẢM {sellTotal}
          </span>
        </div>
      )}
    </div>
  );
}
