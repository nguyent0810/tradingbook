import "server-only";

import { SetupsTodaysActionBlock } from "@/components/setups-todays-action-block";
import { SetupsPipelineFunnel } from "@/components/setups/setups-pipeline-funnel";
import { SetupsDiagnosticsStack } from "@/components/setups/setups-diagnostics-stack";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { loadGate2BreakdownCached, loadSetupsBaseData } from "./setups-cached-data";
export async function SetupsSidebarAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const { error: breakdownError } = await loadGate2BreakdownCached();
  const dbBanner =
    [base.scanLoadError, base.sessionLoadError, base.equityMaxLoadError, breakdownError]
      .filter(Boolean)
      .join(" ") || null;

  const { latest, notes } = base;
  const nearMissCount = notes?.closestToValidSymbols?.length ?? 0;

  const tradingDecision =
    notes?.decision ??
    computeDailyTradingDecision({
      gate1Level: latest.gate1Level as Gate1Level,
      candidateCountA: latest.candidateCountA,
      candidateCountB: latest.candidateCountB,
    });

  const rejectionBuckets = Object.entries(notes?.topRejectionCategories ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <aside className="pipeline-deck__sidebar space-y-4" data-testid="setups-sidebar">
      {dbBanner ? (
        <ErrorStateWithEvidence
          title="Partial scanner data unavailable"
          message={dbBanner}
          evidence="src/app/(dashboard)/setups/setups-sidebar-async.tsx"
          data-testid="setups-overview-db-banner"
        />
      ) : null}

      {tradingDecision ? (
        <div className="dash-surface-1" data-testid="setups-todays-action">
          <SetupsTodaysActionBlock decision={tradingDecision} />
        </div>
      ) : null}

      <SetupsPipelineFunnel latestScan={latest} nearMissCount={nearMissCount} />

      <SetupsDiagnosticsStack
        rejectionBuckets={rejectionBuckets}
        scanNotes={notes}
        latestScan={latest}
      />
    </aside>
  );
}
