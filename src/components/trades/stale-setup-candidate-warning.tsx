import Link from "next/link";
import { StaleDataWarning } from "@/components/ui/stale-data-warning";
import {
  scanRunIdPrefix,
  type StaleSetupCandidateNotice,
} from "@/lib/trades/stale-setup-candidate";

export type StaleSetupCandidateWarningProps = {
  notice: StaleSetupCandidateNotice;
};

/**
 * Soft warning when a prefilled setup candidate is not from the latest non-smoke scan (Slice 4B).
 */
export function StaleSetupCandidateWarning({ notice }: StaleSetupCandidateWarningProps) {
  if (notice.kind === "none") {
    return null;
  }

  if (notice.kind === "lookup_unavailable") {
    return (
      <div
        className="ui-state-panel mb-4"
        role="status"
        data-testid="trades-new-scan-lookup-unavailable"
      >
        <p className="ui-state-panel__eyebrow">Setup scan check</p>
        <p className="ui-state-panel__title">Latest scan could not be verified</p>
        <p className="ui-state-panel__body">
          The prefilled setup was loaded, but the app could not compare it to today&apos;s latest
          scan. You can still log the trade — review levels on Setups or Dashboard if unsure.
        </p>
      </div>
    );
  }

  return (
    <StaleDataWarning
      title="Setup from an older scan"
      message="This prefilled setup is linked to a previous daily scan, not the latest production run. Levels and context may be outdated."
      detail={`Candidate scan ${scanRunIdPrefix(notice.candidateScanRunId)} · Latest scan ${scanRunIdPrefix(notice.latestScanRunId)}`}
      className="mb-4"
      data-testid="trades-new-stale-candidate-warning"
    >
      <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
        You can continue with this prefill, clear fields and enter manually, or open the current
        pipeline on Setups.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/setups" className="btn btn-secondary text-xs">
          View latest Setups
        </Link>
        <Link href="/dashboard" className="btn btn-secondary text-xs">
          Dashboard
        </Link>
      </div>
    </StaleDataWarning>
  );
}
