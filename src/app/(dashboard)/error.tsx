"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] route error:", error);
  }, [error]);

  return (
    <div className="page-container command-deck pb-10">
      <div className="ui-state-panel command-deck-route-error" role="alert">
        <p className="ui-state-panel__eyebrow">Command deck unavailable</p>
        <h1 className="ui-state-panel__title">Something went wrong</h1>
        <p className="ui-state-panel__body">
          The trading command center could not load. Your data and API contracts are unchanged —
          retry or return to a stable route.
        </p>
        {error.digest ? (
          <p className="ui-state-panel__evidence">{error.digest}</p>
        ) : null}
        <div className="ui-state-actions mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Reload dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
