"use client";

import Link from "next/link";
import { useEffect } from "react";
import { V3PageShell, V3Panel } from "@/components/trading-os-v3/layout";

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
    <V3PageShell pageClassName="tosv3-setups-page">
      <V3Panel className="tosv3-route-error" glass={false}>
        <div className="ui-state-panel" role="alert">
          <p className="ui-state-panel__eyebrow">Setups unavailable</p>
          <h1 className="ui-state-panel__title">Setups could not load</h1>
          <p className="ui-state-panel__body">
            Scanner and candidate data are unchanged — retry or return to the dashboard.
          </p>
          {error.digest ? (
            <p className="ui-state-panel__evidence">{error.digest}</p>
          ) : null}
          <div className="ui-state-actions mt-4 flex flex-wrap gap-3">
            <button type="button" className="tosv3-btn tosv3-btn--primary" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/setups" className="tosv3-btn tosv3-btn--secondary">
              Reload setups
            </Link>
            <Link href="/dashboard" className="tosv3-btn tosv3-btn--ghost">
              Dashboard
            </Link>
          </div>
        </div>
      </V3Panel>
    </V3PageShell>
  );
}
