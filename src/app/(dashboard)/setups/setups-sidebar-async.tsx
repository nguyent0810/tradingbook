import "server-only";

import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { IntelligenceSidebarLazy as IntelligenceSidebar } from "@/components/setups-workstation/IntelligenceSidebar-lazy";
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
    <>
      {dbBanner ? (
        <ErrorStateWithEvidence
          className="tosv3-setups-cockpit__banner"
          title="Dữ liệu bộ quét không đầy đủ"
          message={dbBanner}
          evidence="src/app/(dashboard)/setups/setups-sidebar-async.tsx"
          data-testid="setups-overview-db-banner"
        />
      ) : null}
      <IntelligenceSidebar
        tradingDecision={tradingDecision}
        latestScan={latest}
        nearMissCount={nearMissCount}
        rejectionBuckets={rejectionBuckets}
        scanNotes={notes}
      />
    </>
  );
}
