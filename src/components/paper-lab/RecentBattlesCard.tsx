import Link from "next/link";
import type { RecentBattleSummaryDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import { StatusPill } from "./ui/StatusPill";
import { VoteSegmentBar } from "./ui/VoteSegmentBar";
import "./paper-lab-command-center.css";

export function RecentBattlesCard({
  battles,
  variant = "panel",
}: {
  battles: RecentBattleSummaryDto[];
  variant?: "panel" | "compact";
}) {
  const primary = battles[0];

  if (!primary) {
    if (variant === "compact") {
      return (
        <div className="paper-lab-recent-battles-compact" data-testid="paper-lab-recent-battles">
          <p className="text-sm text-[var(--pl-muted)]">Chưa có trận đối đầu nào được ghi nhận.</p>
        </div>
      );
    }
    return (
      <PaperLabPanel title="Đối đầu gần đây" testId="paper-lab-recent-battles">
        <p className="text-sm text-[var(--pl-muted)]">Chưa có trận đối đầu nào được ghi nhận.</p>
      </PaperLabPanel>
    );
  }

  const statusPill =
    primary.status === "RESOLVED" || primary.status === "CLOSED" ? (
      <StatusPill status="CLOSED_TP" />
    ) : (
      <StatusPill status="OPEN" />
    );

  const body = (
    <>
      <div className="paper-lab-recent-battles-compact__head">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-mono font-semibold text-sm">{primary.symbol}</span>
          {statusPill}
          <span className="text-xs text-[var(--pl-muted)]">{primary.agentCount} agent</span>
          <span className="text-xs text-[var(--pl-faint)]">{primary.sessionDate}</span>
        </div>
        <Link href={`/paper-lab/battles/${primary.id}`} className="paper-lab-link-btn text-xs shrink-0">
          Xem đối đầu →
        </Link>
      </div>

      {primary.consensusAction && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
          <span className="text-[var(--pl-muted)]">Đồng thuận</span>
          <ActionBadge action={primary.consensusAction} />
          {primary.consensusConfidence != null && (
            <span className="paper-lab-tabular">{formatConfidencePct(primary.consensusConfidence)}</span>
          )}
        </div>
      )}

      <VoteSegmentBar votes={primary.voteCounts} />

      <p className="text-xs text-[var(--pl-muted)] line-clamp-2 mt-2">{primary.insight}</p>
    </>
  );

  if (variant === "compact") {
    return (
      <div className="paper-lab-recent-battles-compact" data-testid="paper-lab-recent-battles">
        <div className="paper-lab-recent-battles-compact__label">Đối đầu gần đây</div>
        {body}
      </div>
    );
  }

  return (
    <PaperLabPanel title="Đối đầu gần đây" testId="paper-lab-recent-battles">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-mono font-semibold text-base">{primary.symbol}</span>
        {statusPill}
        <span className="text-xs text-[var(--pl-muted)]">{primary.agentCount} agent</span>
      </div>

      {primary.consensusAction && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
          <span className="text-[var(--pl-muted)]">Đồng thuận</span>
          <ActionBadge action={primary.consensusAction} />
          {primary.consensusConfidence != null && (
            <span className="paper-lab-tabular">{formatConfidencePct(primary.consensusConfidence)}</span>
          )}
        </div>
      )}

      <VoteSegmentBar votes={primary.voteCounts} />

      <p className="text-xs text-[var(--pl-muted)] line-clamp-3 mb-3">{primary.insight}</p>

      <Link href={`/paper-lab/battles/${primary.id}`} className="paper-lab-link-btn text-xs">
        View Battle →
      </Link>
    </PaperLabPanel>
  );
}
