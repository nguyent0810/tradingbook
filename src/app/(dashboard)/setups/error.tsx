"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SetupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[setups] route error:", error);
  }, [error]);

  return (
    <div className="page-container command-deck pipeline-deck pb-10">
      <div className="ui-state-panel command-deck-route-error" role="alert">
        <p className="ui-state-panel__eyebrow">Pipeline deck unavailable</p>
        <h1 className="ui-state-panel__title">Setups could not load</h1>
        <p className="ui-state-panel__body">
          Scanner and candidate data are unchanged — retry or return to the command center.
        </p>
        {error.digest ? (
          <p className="ui-state-panel__evidence">{error.digest}</p>
        ) : null}
        <div className="ui-state-actions mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/setups" className="btn btn-secondary">
            Reload setups
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Command center
          </Link>
        </div>
      </div>
    </div>
  );
}
