import type { ReactNode } from "react";
import { Suspense } from "react";
import { V3PageShell, V3Panel, V3Section } from "@/components/trading-os-v3/layout";
import { TradesPageHeader } from "@/components/trades/trades-page-header";
import { TradesLedgerCockpit } from "@/components/trades/trades-ledger-cockpit";
import { TradesLedgerTable } from "@/components/trades/trades-ledger-table";
import { TradesLedgerEmpty } from "@/components/trades/trades-ledger-empty";
import { TradeFilters, TradeFiltersSkeleton } from "@/components/trades/trades-ledger-filters";
import { MarketDataAlignmentBanner } from "@/components/market-data-alignment-banner";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { MarketDataAlignmentAnalysis } from "@/lib/market/market-data-alignment";
import type { ReviewQueueModel } from "@/lib/trades/review-priority-queue";
import type { BookOperatingContext } from "@/lib/trades/book-operating-context";
import type { SessionBriefingModel } from "@/lib/trades/session-briefing";
import type { TradesLedgerOpenRowPack, TradesLedgerTableItem } from "@/components/trades/trades-ledger-types";
import type { LatestCloseBar } from "@/lib/trades/unrealized-from-close";

export type TradesLedgerDeckProps = {
  marketFreshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  sessionBriefing: SessionBriefingModel | null;
  reviewQueueModel: ReviewQueueModel | null;
  bookOperatingContext: BookOperatingContext | null;
  bookOperatingBalanceLines: string[];
  sinceLastVisitLines: string[];
  compactReview: boolean;
  hasOpenTrades: boolean;
  dbLoadError: string | null;
  search: string;
  statusFilter: string;
  sortParam: string | undefined;
  reviewSessionActive: boolean;
  alignmentAnalysis: MarketDataAlignmentAnalysis;
  barsLoadFailed: boolean;
  tradesEmpty: boolean;
  ledgerTableItems: TradesLedgerTableItem[];
  openRowPackByTradeId: Map<string, TradesLedgerOpenRowPack>;
  latestCloseBySymbol: Map<string, LatestCloseBar>;
  expectedSessionDate: Date | null;
  checkedTodayTradeIds: Set<string>;
  now: Date;
  sessionFocusId: string | null;
  reviewSessionQueueLength: number;
  reviewSessionChrome: ReactNode;
  focusReviewWorkspace: ReactNode;
  operatingSnapshotPersist: ReactNode;
};

export function TradesLedgerDeck({
  marketFreshness,
  latestScan,
  scanDelayedBackdrop,
  sessionBriefing,
  reviewQueueModel,
  bookOperatingContext,
  bookOperatingBalanceLines,
  sinceLastVisitLines,
  compactReview,
  hasOpenTrades,
  dbLoadError,
  search,
  statusFilter,
  sortParam,
  reviewSessionActive,
  alignmentAnalysis,
  barsLoadFailed,
  tradesEmpty,
  ledgerTableItems,
  openRowPackByTradeId,
  latestCloseBySymbol,
  expectedSessionDate,
  checkedTodayTradeIds,
  now,
  sessionFocusId,
  reviewSessionQueueLength,
  reviewSessionChrome,
  focusReviewWorkspace,
  operatingSnapshotPersist,
}: TradesLedgerDeckProps) {
  const filteredEmpty = Boolean(search || statusFilter);

  return (
    <div className="tosv3-page-shell__flow tosv3-workstation-flow">
      <TradesLedgerCockpit
        marketFreshness={marketFreshness}
        latestScan={latestScan}
        scanDelayedBackdrop={scanDelayedBackdrop}
        sessionBriefing={sessionBriefing}
        reviewQueueModel={reviewQueueModel}
        bookOperatingContext={bookOperatingContext}
        bookOperatingBalanceLines={bookOperatingBalanceLines}
        sinceLastVisitLines={sinceLastVisitLines}
        compactReview={compactReview}
        hasOpenTrades={hasOpenTrades}
      />

      {dbLoadError ? (
        <ErrorStateWithEvidence
          className="tosv3-ledger-alert"
          title="Partial trades data unavailable"
          message={dbLoadError}
          evidence="src/app/(dashboard)/trades/page.tsx · trade list and/or position marks load failed; ledger may be incomplete."
          data-testid="trades-db-load-error"
        />
      ) : null}

      <Suspense fallback={<TradeFiltersSkeleton />}>
        <TradeFilters
          currentSearch={search}
          currentStatus={statusFilter}
          currentSort={sortParam || "newest"}
          currentCompactReview={compactReview}
          currentReviewSession={reviewSessionActive}
        />
      </Suspense>

      {reviewSessionChrome}
      {focusReviewWorkspace}

      {alignmentAnalysis.showBanner ? (
        <V3Panel className="tosv3-ledger-alignment-banner">
          <MarketDataAlignmentBanner
            analysis={alignmentAnalysis}
            mentionOpenPositionMarks={hasOpenTrades}
          />
        </V3Panel>
      ) : null}

      {barsLoadFailed && hasOpenTrades ? (
        <V3Panel className="tosv3-ledger-open-risk">
          <V3Section
            eyebrow="Data"
            title="Position marks incomplete"
            lead="Latest closes could not be loaded. Open-position marks may be incomplete until bars load."
          >
            {null}
          </V3Section>
        </V3Panel>
      ) : null}

      {tradesEmpty ? (
        <TradesLedgerEmpty filtered={filteredEmpty} />
      ) : (
        <TradesLedgerTable
          ledgerTableItems={ledgerTableItems}
          openRowPackByTradeId={openRowPackByTradeId}
          latestCloseBySymbol={latestCloseBySymbol}
          expectedSessionDate={expectedSessionDate}
          checkedTodayTradeIds={checkedTodayTradeIds}
          now={now}
          compactReview={compactReview}
          reviewSessionActive={reviewSessionActive}
          sessionFocusId={sessionFocusId}
          reviewSessionQueueLength={reviewSessionQueueLength}
        />
      )}

      {operatingSnapshotPersist}
    </div>
  );
}

export function TradesLedgerPageShell({
  children,
  tradeCount,
  openCount,
  closedCount,
}: {
  children: ReactNode;
  tradeCount: number;
  openCount: number;
  closedCount: number;
}) {
  return (
    <V3PageShell pageClassName="tosv3-trades-page" testId="trades-workstation">
      <TradesPageHeader
        tradeCount={tradeCount}
        openCount={openCount}
        closedCount={closedCount}
      />
      {children}
    </V3PageShell>
  );
}
