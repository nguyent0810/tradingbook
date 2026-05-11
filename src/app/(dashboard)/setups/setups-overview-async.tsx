import "server-only";

import { SetupsInsightBlock } from "@/components/setups-insight-block";
import { SetupsRejectionAccordion } from "@/components/setups-rejection-accordion";
import { SetupsTodaysActionBlock } from "@/components/setups-todays-action-block";
import { REJECTION_SYMBOLS_PER_BUCKET_CAP } from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { buildSetupsInsightCopy } from "@/lib/scanner/setups-trader-copy";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import { loadGate2BreakdownCached, loadSetupsBaseData } from "./setups-cached-data";
import { buildDiagnosticsAccordionItems, dominantCategoryFromNotes, fmtRunDate } from "./setups-shared-helpers";

export async function SetupsOverviewAsync() {
  const base = await loadSetupsBaseData();

  if (!base.latest) {
    const dbBanner =
      [base.scanLoadError, base.sessionLoadError].filter(Boolean).join(" ") || null;
    return (
      <>
        {dbBanner ? (
          <div
            role="alert"
            className="card border px-4 py-3 text-sm"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            {dbBanner}
          </div>
        ) : null}
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="empty-state-title">No scanner runs yet</div>
            <div className="empty-state-description">
              Run{" "}
              <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-xs">
                npx tsx scripts/run-daily-scanner.ts
              </code>{" "}
              after importing bars.
            </div>
          </div>
        </div>
      </>
    );
  }

  const { breakdown, error: breakdownError } = await loadGate2BreakdownCached();
  const dbBanner =
    [base.scanLoadError, base.sessionLoadError, breakdownError].filter(Boolean).join(" ") || null;

  const { latest, notes } = base;

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
        <div
          role="alert"
          className="card border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {dbBanner}
        </div>
      ) : null}

      {tradingDecision ? <SetupsTodaysActionBlock decision={tradingDecision} /> : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Market &amp; setup insight
        </h2>
        <SetupsInsightBlock
          insight={insight}
          runAtLabel={fmtRunDate(latest.runAt)}
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
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="empty-state-title">Setup diagnostics unavailable</div>
            <div className="empty-state-description">
              Detailed rejection breakdown needs a latest benchmark session (e.g. VNINDEX bars) or saved scan notes.
              Import index bars and run{" "}
              <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-xs">
                npx tsx scripts/run-daily-scanner.ts
              </code>
              .
            </div>
          </div>
        </div>
      ) : null}

      {accordionItems.length > 0 ? (
        <SetupsRejectionAccordion sectionIntro={accordionIntro} items={accordionItems} />
      ) : null}
    </>
  );
}
