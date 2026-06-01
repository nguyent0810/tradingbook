import "server-only";

import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { V3Panel } from "@/components/trading-os-v3/layout";
import { loadSetupsBaseData } from "./setups-cached-data";

/** No-scan and load-error banners only — main pipeline UI lives in sidebar + candidates. */
export async function SetupsOverviewAsync() {
  const base = await loadSetupsBaseData();

  if (base.latest) return null;

  const dbBanner =
    [base.scanLoadError, base.sessionLoadError, base.equityMaxLoadError]
      .filter(Boolean)
      .join(" ") || null;

  return (
    <div className="tosv3-setups-overview-fallback space-y-4" data-testid="setups-overview-no-run-section">
      {dbBanner ? (
        <ErrorStateWithEvidence
          title="Partial scanner data unavailable"
          message={dbBanner}
          evidence="src/app/(dashboard)/setups/setups-overview-async.tsx · loadSetupsBaseData"
          data-testid="setups-overview-db-banner-no-run"
        />
      ) : null}
      <V3Panel className="tosv3-empty-state-wrap">
        <EmptyStateWithReason
          title="No scanner runs yet"
          reason="No daily scan run in the database yet. Production uses the GitHub Actions “Production bar import” workflow (import + scan); locally run npx tsx scripts/run-daily-scanner.ts after bars are imported."
          data-testid="setups-overview-no-scan-run"
        />
      </V3Panel>
    </div>
  );
}
