import "server-only";

import { SetupsInsightBlock } from "@/components/setups-insight-block";
import { SetupsRejectionAccordion } from "@/components/setups-rejection-accordion";
import { SetupsTodaysActionBlock } from "@/components/setups-todays-action-block";
import { REJECTION_SYMBOLS_PER_BUCKET_CAP } from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { buildSetupsInsightCopy } from "@/lib/scanner/setups-trader-copy";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import { MarketDataAlignmentBanner } from "@/components/market-data-alignment-banner";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { loadGate2BreakdownCached, loadSetupsBaseData } from "./setups-cached-data";
import { buildDiagnosticsAccordionItems, dominantCategoryFromNotes, fmtRunDate } from "./setups-shared-helpers";

export async function SetupsOverviewAsync() {
  const base = await loadSetupsBaseData();

  if (!base.latest) {
    const dbBanner =
      [base.scanLoadError, base.sessionLoadError, base.equityMaxLoadError]
        .filter(Boolean)
        .join(" ") || null;
    return (
      <>
        {dbBanner ? (
          <ErrorStateWithEvidence
            title="Partial scanner data unavailable"
            message={dbBanner}
            evidence="src/app/(dashboard)/setups/setups-overview-async.tsx · loadSetupsBaseData"
            data-testid="setups-overview-db-banner-no-run"
          />
        ) : null}
        <div className="card p-0">
          <EmptyStateWithReason
            title="No scanner runs yet"
            reason="Run npx tsx scripts/run-daily-scanner.ts after importing bars."
            data-testid="setups-overview-no-scan-run"
          />
        </div>
      </>
    );
  }

  const { breakdown, error: breakdownError } = await loadGate2BreakdownCached();
  const dbBanner =
    [base.scanLoadError, base.sessionLoadError, base.equityMaxLoadError, breakdownError]
      .filter(Boolean)
      .join(" ") || null;

  const { latest, notes } = base;

  const marketAlignment = analyzeMarketDataAlignment({
    benchmarkSessionDate: base.expectedSession,
    latestEquityBarSessionDate: base.latestEquityBarSession,
    latestScanRunAt: latest.runAt,
  });

  const dominantCategoryKey =
    (breakdown[0]?.categoryKey as string | undefined) ??
    dominantCategoryFromNotes(notes?.topRejectionCategories);

  const insight = buildSetupsInsightCopy({
    surfacedCount: latest.candidateCountSurfaced,
    dominantCategoryKey,
    tradableCount: latest.symbolCountAfterTradability,
  });

  const accordionItems = buildDiagnosticsAccordionItems(breakdown, notes);

  const tradingDecision =
    notes?.decision ??
    computeDailyTradingDecision({
      gate1Level: latest.gate1Level as Gate1Level,
      candidateCountA: latest.candidateCountA,
      candidateCountB: latest.candidateCountB,
    });

  const gate1TraderLabel = displayGate1ScanLevel(String(latest.gate1Level));

  const accordionIntro =
    "Grouped by why setups fell short — not buy signals. Expand each row for context and sample symbols. " +
    `Saved scan notes include up to ${REJECTION_SYMBOLS_PER_BUCKET_CAP} symbols per bucket (bucket totals can be larger).`;

  return (
    <>
      {dbBanner ? (
        <ErrorStateWithEvidence
          title="Partial scanner data unavailable"
          message={dbBanner}
          evidence="src/app/(dashboard)/setups/setups-overview-async.tsx · loadSetupsBaseData / loadGate2BreakdownCached"
          data-testid="setups-overview-db-banner"
        />
      ) : null}

      {marketAlignment.showBanner ? (
        <MarketDataAlignmentBanner analysis={marketAlignment} />
      ) : null}

      {tradingDecision ? <SetupsTodaysActionBlock decision={tradingDecision} /> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Market &amp; setup insight
        </h2>
        <SetupsInsightBlock
          insight={insight}
          runAtLabel={fmtRunDate(latest.runAt)}
          benchmarkSessionDate={
            base.expectedSession
              ? base.expectedSession.toISOString().slice(0, 10)
              : null
          }
          equityBarsLatestSession={
            base.latestEquityBarSession
              ? base.latestEquityBarSession.toISOString().slice(0, 10)
              : null
          }
          delayedMarketBackdrop={notes?.benchmarkBackdrop?.delayedBackdrop === true}
          gate1DisplayLabel={gate1TraderLabel}
          status={latest.status}
          tradabilityPassed={latest.symbolCountAfterTradability}
          tradabilityTotal={latest.symbolCountTotal}
          filteredOut={latest.symbolCountFilteredOut}
          candidateCountA={latest.candidateCountA}
          candidateCountB={latest.candidateCountB}
          candidateCountSurfaced={latest.candidateCountSurfaced}
          errorSummary={latest.status === "FAILED" ? latest.errorSummary : null}
        />
      </section>

      {!base.expectedSession && accordionItems.length === 0 ? (
        <div className="card p-0">
          <EmptyStateWithReason
            title="Setup diagnostics unavailable"
            reason="Detailed rejection breakdown needs a latest benchmark session (e.g. VNINDEX bars) or saved scan notes. Import index bars and run npx tsx scripts/run-daily-scanner.ts."
            data-testid="setups-overview-diagnostics-unavailable"
          />
        </div>
      ) : null}

      {accordionItems.length > 0 ? (
        <SetupsRejectionAccordion sectionIntro={accordionIntro} items={accordionItems} />
      ) : null}
    </>
  );
}
