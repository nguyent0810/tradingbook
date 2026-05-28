import Link from "next/link";
import type { V3LedgerPulse } from "@/lib/dashboard/dashboard-v3-view-model";

type Props = {
  data: V3LedgerPulse;
};

export function LedgerPulseStrip({ data }: Props) {
  return (
    <section
      className="tosv3-panel tosv3-ledger"
      aria-label="Ledger pulse strip"
      data-testid="dashboard-v3-ledger-pulse"
    >
      <div className="tosv3-ledger__outcomes">
        <span className="tosv3-type-label">Recent outcomes</span>
        {data.outcomeChips.length > 0 ? (
          <div
            className="tosv3-ledger__chips"
            aria-label={`${data.outcomeChips.filter((c) => c === "W").length} wins, ${data.outcomeChips.filter((c) => c === "L").length} losses`}
          >
            {data.outcomeChips.map((chip, index) => (
              <span
                key={`${chip}-${index}`}
                className={chip === "W" ? "tosv3-chip--win" : "tosv3-chip--loss"}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <strong className="tosv3-type-metric">No closed trades yet</strong>
        )}
      </div>

      <div className="tosv3-ledger__open">
        <span className="tosv3-type-label">Open trades</span>
        <strong className="tosv3-type-metric tabular-nums">{data.openTrades}</strong>
      </div>

      <div className="tosv3-ledger__pnl">
        <span className="tosv3-type-label">P&amp;L pulse</span>
        <strong className="tosv3-type-metric">{data.pnlPulse ?? "—"}</strong>
        {data.pulseBarHeights.length > 0 ? (
          <div className="tosv3-ledger__bars" aria-hidden>
            {data.pulseBarHeights.map((value, index) => (
              <i key={`pulse-${index}`} style={{ height: `${value}%` }} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="tosv3-ledger__review">
        <span className="tosv3-type-label">Trade review</span>
        <Link href={data.reviewHref} className="tosv3-type-metric tosv3-ledger__review-link">
          {data.reviewLabel}
        </Link>
      </div>
    </section>
  );
}
