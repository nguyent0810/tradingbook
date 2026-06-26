"use client";

import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";

export default function PaperLabError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorStateWithEvidence
      title="Arena failed to load"
      message={error.message}
      evidence={`digest: ${error.digest ?? "none"}`}
    >
      <button type="button" className="tosv3-btn tosv3-btn--secondary" onClick={reset}>
        Retry
      </button>
    </ErrorStateWithEvidence>
  );
}
