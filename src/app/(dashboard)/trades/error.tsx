"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function TradesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[trades] route error:", error);
  }, [error]);

  return (
    <div className="page-container command-deck ledger-deck pb-10">
      <div className="ui-state-panel command-deck-route-error" role="alert">
        <p className="ui-state-panel__eyebrow">Ledger deck unavailable</p>
        <h1 className="ui-state-panel__title">Trades ledger could not load</h1>
        <p className="ui-state-panel__body">
          Your trade records and review session are unchanged — retry or return to a stable route.
        </p>
        {error.digest ? (
          <p className="ui-state-panel__evidence">{error.digest}</p>
        ) : null}
        <div className="ui-state-actions mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/trades" className="btn btn-secondary">
            Reload ledger
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Command center
          </Link>
        </div>
      </div>
    </div>
  );
}
