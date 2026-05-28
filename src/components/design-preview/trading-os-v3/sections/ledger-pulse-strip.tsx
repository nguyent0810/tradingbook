import type { LedgerPulseData } from "../types";

type Props = {
  data: LedgerPulseData;
};

export function LedgerPulseStrip({ data }: Props) {
  const pulseBars = [42, 55, 48, 64, 71, 66, 78, 74];
  const outcomePattern = [
    ...Array.from({ length: data.wins }, () => "W" as const),
    ...Array.from({ length: data.losses }, () => "L" as const),
  ];

  return (
    <section className="tosv3-panel tosv3-ledger" aria-label="Ledger pulse strip">
      <div className="tosv3-ledger__outcomes">
        <span className="tosv3-type-label">Recent outcomes</span>
        <div className="tosv3-ledger__chips" aria-label={`${data.wins} wins and ${data.losses} losses`}>
          {outcomePattern.map((chip, index) => (
            <span key={`${chip}-${index}`} className={chip === "W" ? "tosv3-chip--win" : "tosv3-chip--loss"}>
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div>
        <span className="tosv3-type-label">Open trades</span>
        <strong className="tosv3-type-metric tabular-nums">{data.openTrades}</strong>
      </div>

      <div className="tosv3-ledger__pnl">
        <span className="tosv3-type-label">P&amp;L pulse</span>
        <strong className="tosv3-type-metric tosv3-positive">{data.pnlPulse}</strong>
        <div className="tosv3-ledger__bars" aria-hidden>
          {pulseBars.map((value, index) => (
            <i key={`${value}-${index}`} style={{ height: `${value}%` }} />
          ))}
        </div>
      </div>

      <div className={`tosv3-ledger__review ${data.reviewQueue > 0 ? "tosv3-ledger__review--active" : ""}`}>
        <span className="tosv3-type-label">Review queue</span>
        <strong className="tosv3-type-metric tabular-nums">{data.reviewQueue}</strong>
      </div>

      <div className="tosv3-ledger__discipline">
        <span className="tosv3-type-label">Discipline</span>
        <strong className="tosv3-type-metric tabular-nums">{data.disciplineScore}</strong>
        <div className="tosv3-meter tosv3-meter--discipline" role="img" aria-label={`Discipline score ${data.disciplineScore}`}>
          <div className="tosv3-meter__fill" style={{ width: `${data.disciplineScore}%` }} />
        </div>
      </div>
    </section>
  );
}
