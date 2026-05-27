import Link from "next/link";
import type { OpportunityBoardDto, OpportunityNearMissDto } from "@/lib/dashboard/decision-cockpit-dto";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardNearMissRejectionsPanelProps = {
  opportunity: OpportunityBoardDto;
};

function nearMissTraderNote(row: OpportunityNearMissDto): string | null {
  if (row.symbol === "VND" && row.terminalCategory === "pullback_zone_interaction") {
    return "Near-miss — price is above the pullback box, not actionable in the current breakout-pullback template.";
  }
  if (row.symbol === "PDR" && row.terminalCategory === "breakout_recency") {
    return "Gate2 failed breakout-recency; may still appear in Momentum Watch (observational fresh breakout, not a validated setup).";
  }
  return null;
}

function NearMissCard({ row }: { row: OpportunityNearMissDto }) {
  const note = nearMissTraderNote(row);
  const dist =
    row.distanceToZonePct != null
      ? `${row.distanceToZonePct.toFixed(1)}% from pullback zone`
      : null;

  return (
    <li className="dash-near-miss__card" data-testid={`dashboard-near-miss-${row.symbol}`}>
      <div className="dash-near-miss__head">
        <span className="font-mono font-semibold">{row.symbol}</span>
        <span className="dash-chip dash-chip--muted text-xs">
          {rejectionBucketLabel(row.terminalCategory)}
        </span>
      </div>
      {note ? <p className="dash-near-miss__note text-sm font-medium">{note}</p> : null}
      <p className="dash-near-miss__wait text-sm">{row.waitFor}</p>
      {dist ? <p className="dash-near-miss__meta text-xs tabular-nums">{dist}</p> : null}
    </li>
  );
}

/** Near-miss / Gate2 rejection explainer (Command Center v1). */
export function DashboardNearMissRejectionsPanel({
  opportunity,
}: DashboardNearMissRejectionsPanelProps) {
  const rows = opportunity.nearMiss;

  return (
    <section
      className="dash-near-miss dash-panel dash-surface-1"
      data-testid="dashboard-near-miss-panel"
    >
      <header className="dash-panel__header">
        <h3 className="dash-section-title">Near miss / rejection reasons</h3>
        <p className="dash-panel__subtitle">
          Closest names from the latest scan that did not become Tier A/B setups.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyStateWithReason
          title="No near-miss ranking in latest scan"
          reason={
            opportunity.emptyReason ??
            "Scanner notes did not include closest-to-valid symbols for this run."
          }
          data-testid="dashboard-near-miss-empty"
        >
          <Link href="/setups" className="btn btn-secondary text-xs">
            Open Setups pipeline
          </Link>
        </EmptyStateWithReason>
      ) : (
        <>
          <ul className="dash-near-miss__list">
            {rows.map((row) => (
              <NearMissCard key={row.symbol} row={row} />
            ))}
          </ul>
          <p className="dash-near-miss__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
            Full rejection buckets and symbol lists are on{" "}
            <Link href="/setups" className="font-medium text-[var(--accent-text)]">
              Setups
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}
