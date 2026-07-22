import Link from "next/link";
import type { OpportunityBoardDto, OpportunityCandidateDto } from "@/lib/dashboard/decision-cockpit-dto";
import { formatSetupLadderStageLabel } from "@/lib/dashboard/decision-cockpit-dto";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export type DashboardOpportunityCandidatesProps = {
  opportunity: OpportunityBoardDto;
};

function healthLevelToBadgeTone(level: string): BadgeTone {
  switch (level) {
    case "HEALTHY":
      return "success";
    case "WARNING":
      return "warning";
    case "AT_RISK":
      return "at-risk";
    case "DEAD":
      return "dead";
    case "NO_DATA":
      return "dead";
    default:
      return "neutral";
  }
}

const TIER_ACCENT: Record<OpportunityCandidateDto["quality"], string> = {
  A: "var(--cd-success, var(--success))",
  B: "var(--cd-warning, var(--warning))",
};

function CandidateCard({ row }: { row: OpportunityCandidateDto }) {
  const hasWhy = row.primaryReasons.length > 0 || Boolean(row.healthSummary);

  return (
    <li
      className="dash-card dash-card--interactive dash-tile"
      data-testid={`dashboard-opportunity-${row.symbol}`}
      style={{ ["--dash-card-accent" as string]: TIER_ACCENT[row.quality] }}
    >
      <div className="dash-tile__head">
        <span className="dash-tile__symbol font-mono">{row.symbol}</span>
        <Badge tone={row.quality === "A" ? "tier-a" : "tier-b"} size="compact">
          {row.quality}
        </Badge>
        <Badge tone={healthLevelToBadgeTone(row.healthLevel)} size="compact">
          {row.healthLevel}
        </Badge>
        <span
          className="dash-tile__score tabular-nums"
          data-testid={`dashboard-opportunity-score-${row.symbol}`}
          title="Gate 2 rank score at time of scan"
        >
          {Math.round(row.rankScore)}
        </span>
      </div>
      <div className="dash-tile__meta-row">
        <span className="dash-chip dash-chip--muted text-xs">
          {formatSetupLadderStageLabel(row.ladderStage)}
        </span>
      </div>
      {row.rankSummary ? <p className="dash-tile__insight text-sm font-medium">{row.rankSummary}</p> : null}
      <p className="dash-tile__action text-xs" data-testid={`dashboard-opportunity-action-${row.symbol}`}>
        {row.actionHint}
      </p>
      <div className="dash-tile__rs">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          detail="summary"
          testId={`dashboard-opportunity-rs-${row.symbol}`}
        />
      </div>
      {hasWhy ? (
        <details className="dash-tile__why">
          <summary className="dash-tile__why-toggle">Vì sao Hạng {row.quality}</summary>
          {row.primaryReasons.length > 0 ? (
            <p className="dash-tile__why-line text-xs">{row.primaryReasons.slice(0, 2).join(" · ")}</p>
          ) : null}
          {row.healthSummary ? <p className="dash-tile__why-line text-xs">{row.healthSummary}</p> : null}
        </details>
      ) : null}
    </li>
  );
}

/** Opportunity Board — Tier A/B surfaced candidates, max 5 (UX spec §5.1). */
export function DashboardOpportunityCandidates({
  opportunity,
}: DashboardOpportunityCandidatesProps) {
  const rows = opportunity.candidates.slice(0, 5);

  return (
    <div className="dash-card dash-card--muted" data-testid="dashboard-opportunity-candidates-panel">
      <header className="dash-card__header">
        <h3 className="dash-card__title">Cơ hội tốt nhất</h3>
        <p className="dash-card__lead">
          Ứng viên Hạng A/B đã lọc — đã xác thực, sẵn sàng xem xét.
        </p>
      </header>

      <ul className="dash-tile-grid">
        {rows.map((row) => (
          <CandidateCard key={row.candidateId} row={row} />
        ))}
      </ul>

      <p className="dash-near-miss__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
        Toàn bộ đường ống &amp; định cỡ vị thế tại{" "}
        <Link href="/setups" className="dash-v2-link">
          Thiết lập
        </Link>
        .
      </p>
    </div>
  );
}
