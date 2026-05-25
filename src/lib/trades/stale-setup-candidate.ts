/** Result of comparing a prefilled candidate's scan run to the latest non-smoke scan. */
export type StaleSetupCandidateNotice =
  | { kind: "none" }
  | {
      kind: "stale";
      candidateScanRunId: string;
      latestScanRunId: string;
    }
  | { kind: "lookup_unavailable" };

export function scanRunIdPrefix(id: string, length = 12): string {
  const trimmed = id.trim();
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length)}…`;
}

/**
 * Soft stale check for `/trades/new?setupCandidateId=` — warn only, never block prefill.
 */
export function resolveStaleSetupCandidateNotice(params: {
  candidateScanRunId: string | null | undefined;
  latestScanRunId: string | null | undefined;
  latestScanLookupFailed?: boolean;
}): StaleSetupCandidateNotice {
  if (!params.candidateScanRunId?.trim()) {
    return { kind: "none" };
  }
  if (params.latestScanLookupFailed) {
    return { kind: "lookup_unavailable" };
  }
  if (!params.latestScanRunId?.trim()) {
    return { kind: "lookup_unavailable" };
  }
  if (params.candidateScanRunId === params.latestScanRunId) {
    return { kind: "none" };
  }
  return {
    kind: "stale",
    candidateScanRunId: params.candidateScanRunId,
    latestScanRunId: params.latestScanRunId,
  };
}
