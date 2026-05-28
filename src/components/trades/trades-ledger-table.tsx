import Link from "next/link";
import { DenseTable } from "@/components/command-deck";
import { SignalBadge } from "@/components/command-deck/signal-badge";
import { OpenPositionReviewCell } from "@/app/(dashboard)/trades/open-position-review-cell";
import { formatVND, formatEquityThousandVndPerShare, formatBarDataDateUtcLong } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import { deriveTradesLedgerRowFields } from "@/lib/trades/trades-ledger-row-derived";
import { TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE } from "@/lib/trades/price-unit-guard";
import { formatSignedPct, type LatestCloseBar } from "@/lib/trades/unrealized-from-close";
import {
  displayScanQualityTier,
  displayTradeDirection,
  displayTradeStatus,
} from "@/lib/trading-display-labels";
import {
  OPERATING_POSTURE_TRADER_LABEL,
} from "@/lib/trades/operating-posture";
import { reviewOutcomeTraderLabel } from "@/lib/trades/review-outcome";
import { POSITION_EVOLUTION_TRADER_LABEL } from "@/lib/trades/position-state-evolution";
import {
  formatBarSessionDate,
  formatQuantityCell,
  formatRMultiple,
  formatSignedVnd,
  formatTradeLedgerDate,
} from "@/lib/trades/trades-ledger-formatters";
import type {
  TradesLedgerOpenRowPack,
  TradesLedgerTableItem,
  TradesLedgerTrade,
} from "@/components/trades/trades-ledger-types";

export type TradesLedgerTableProps = {
  ledgerTableItems: TradesLedgerTableItem[];
  openRowPackByTradeId: Map<string, TradesLedgerOpenRowPack>;
  latestCloseBySymbol: Map<string, LatestCloseBar>;
  expectedSessionDate: Date | null;
  checkedTodayTradeIds: Set<string>;
  now: Date;
  compactReview: boolean;
  reviewSessionActive: boolean;
  sessionFocusId: string | null;
  reviewSessionQueueLength: number;
};

function tradeStatusBadgeVariant(
  status: string
): "ready" | "watching" | "neutral" {
  switch (status) {
    case "OPEN":
      return "ready";
    case "CLOSED":
      return "neutral";
    default:
      return "watching";
  }
}

export function TradesLedgerTable({
  ledgerTableItems,
  openRowPackByTradeId,
  latestCloseBySymbol,
  expectedSessionDate,
  checkedTodayTradeIds,
  now,
  compactReview,
  reviewSessionActive,
  sessionFocusId,
  reviewSessionQueueLength,
}: TradesLedgerTableProps) {
  const ledgerCtx = {
    latestCloseBySymbol,
    expectedSessionDate,
    checkedTodayTradeIds,
    now,
  } as const;

  return (
    <section className="ledger-deck-panel pipeline-deck-panel ledger-deck-table-section">
      <header className="ledger-deck-table-section__header">
        <h2 className="dash-section-title">Trades ledger</h2>
        <p
          className="ledger-deck-table-section__hint"
          data-testid="trades-ledger-scroll-hint"
        >
          Scroll horizontally for the full ledger. The Symbol column stays pinned while you scroll.
        </p>
        <p className="ledger-deck-table-section__units">
          Equity prices are{" "}
          <span className="ledger-deck-table-section__units-em">thousand VND per share</span> (imported
          EOD). P&amp;L uses the same numeric scale × quantity.
        </p>
      </header>

      <DenseTable
        testId="trades-scroll-container"
        minWidth="1840px"
        className="ledger-deck-table-wrap table-sticky trades-ledger-scroll dense-table-scroll--sticky-symbol"
        ariaLabel="Trades ledger table"
        scrollHint="Scroll horizontally for full ledger columns. Symbol column stays pinned."
      >
        <table className="table dense-table ledger-deck-table" data-testid="trades-table">
          <thead data-testid="trades-table-header">
            <tr>
              <th className="ledger-sticky-symbol">Symbol</th>
              <th>Setup</th>
              <th>Direction</th>
              <th>Playbook</th>
              <th>Status</th>
              <th>Position &amp; review</th>
              <th className="table-num">Hold</th>
              <th>Entry Date</th>
              <th className="table-num">
                <span className="block">Entry</span>
                <span className="ledger-deck-table__th-sub">(1000 ₫)</span>
              </th>
              <th className="table-num">
                <span className="block">Session mark</span>
                <span className="ledger-deck-table__th-sub">Open: EOD · Closed: exit</span>
              </th>
              <th className="table-num">Qty</th>
              <th className="table-num">R</th>
              <th className="table-num">
                <span className="block">Stop dist.</span>
                <span className="ledger-deck-table__th-sub">(1000 ₫)</span>
              </th>
              <th className="table-num">
                <span className="block">TP dist.</span>
                <span className="ledger-deck-table__th-sub">(1000 ₫)</span>
              </th>
              <th className="table-num">P&amp;L</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {ledgerTableItems.map((item, rowIndex) => {
              if (
                item !== null &&
                typeof item === "object" &&
                "kind" in item &&
                item.kind === "divider"
              ) {
                return (
                  <tr
                    key={`cluster-divider-${rowIndex}-${item.label}`}
                    data-testid="trades-cluster-divider"
                    className="ledger-deck-table__divider"
                    aria-hidden="true"
                  >
                    <td colSpan={16}>
                      <span className="ledger-deck-table__divider-label">{item.label}</span>
                    </td>
                  </tr>
                );
              }

              const trade = item as TradesLedgerTrade;
              const openPack = openRowPackByTradeId.get(trade.id);
              const {
                latestBar,
                unrealized,
                priceUnitMismatch,
                holdingDays,
                rMultiple,
                distanceToStop,
                distanceToTakeProfit,
              } =
                openPack?.derived ??
                deriveTradesLedgerRowFields(
                  {
                    id: trade.id,
                    symbol: trade.symbol,
                    status: trade.status,
                    direction: trade.direction,
                    entryPrice: trade.entryPrice,
                    quantity: trade.quantity,
                    stopLoss: trade.stopLoss,
                    takeProfit: trade.takeProfit,
                    entryDate: trade.entryDate,
                    exitDate: trade.exitDate,
                  },
                  ledgerCtx
                );

              const reviewDto =
                trade.status === "OPEN" ? (openPack?.reviewDto ?? null) : null;

              const isSessionFocusRow =
                reviewSessionActive &&
                trade.status === "OPEN" &&
                sessionFocusId != null &&
                trade.id === sessionFocusId;

              const rowHandledCalm =
                trade.status === "OPEN" &&
                openPack &&
                checkedTodayTradeIds.has(trade.id) &&
                openPack.priorityTier !== "urgent" &&
                reviewDto != null &&
                reviewDto.surface !== "stop_violated" &&
                reviewDto.stopBand !== "breached";

              const dimNonFocusSessionRow =
                reviewSessionActive &&
                reviewSessionQueueLength > 0 &&
                sessionFocusId != null &&
                !isSessionFocusRow;

              const rowClass = [
                "ledger-deck-table__row",
                isSessionFocusRow ? "ledger-deck-table__row--focus" : "",
                rowHandledCalm ? "ledger-deck-table__row--calm" : "",
                dimNonFocusSessionRow ? "ledger-deck-table__row--dimmed" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr
                  key={trade.id}
                  data-testid="trades-table-row"
                  data-review-session-focus={isSessionFocusRow ? "true" : undefined}
                  className={rowClass}
                >
                  <td className="ledger-sticky-symbol dense-candidate-row__symbol-cell">
                    <span className="ledger-deck-table__symbol mono">{trade.symbol}</span>
                    {priceUnitMismatch ? (
                      <SignalBadge variant="at-risk" className="ledger-deck-table__unit-warn">
                        Unit check needed
                      </SignalBadge>
                    ) : null}
                  </td>
                  <td>
                    {trade.setupCandidate ? (
                      <span className="ledger-deck-table__chip">
                        {displayScanQualityTier(trade.setupCandidate.quality)} ·{" "}
                        {formatPlaybookLabel(trade.setupCandidate.setupType)}
                      </span>
                    ) : (
                      <span className="ledger-deck-table__muted">Manual</span>
                    )}
                  </td>
                  <td>
                    <SignalBadge
                      variant={trade.direction === "LONG" ? "healthy" : "at-risk"}
                    >
                      {displayTradeDirection(trade.direction)}
                    </SignalBadge>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="ledger-deck-table__chip whitespace-nowrap">
                      {formatPlaybookLabel(trade.playbook)}
                    </span>
                  </td>
                  <td>
                    <SignalBadge variant={tradeStatusBadgeVariant(trade.status)}>
                      {displayTradeStatus(trade.status)}
                    </SignalBadge>
                  </td>
                  <td className="align-top">
                    {trade.status === "OPEN" && reviewDto && openPack ? (
                      <OpenPositionReviewCell
                        tradeId={trade.id}
                        compact={
                          compactReview ||
                          (reviewSessionActive && !isSessionFocusRow)
                        }
                        priorityTier={openPack.priorityTier}
                        escalationCues={openPack.escalationCues}
                        memoryLines={openPack.memoryLines}
                        reviewDto={reviewDto}
                        reviewedToday={checkedTodayTradeIds.has(trade.id)}
                        latestBar={latestBar ?? null}
                        formatBarSessionDate={formatBarSessionDate}
                        sessionMode={reviewSessionActive}
                        sessionFocused={Boolean(isSessionFocusRow)}
                        operatingPostureLabel={
                          OPERATING_POSTURE_TRADER_LABEL[openPack.operatingPosture]
                        }
                        latestOutcomeLabel={reviewOutcomeTraderLabel(
                          openPack.latestReviewOutcome
                        )}
                        evolutionStateLabel={
                          POSITION_EVOLUTION_TRADER_LABEL[openPack.positionEvolution]
                        }
                        evolutionExplainLine={openPack.positionEvolutionLine}
                        compactReviewMode={compactReview}
                      />
                    ) : (
                      <span className="ledger-deck-table__muted">—</span>
                    )}
                  </td>
                  <td className="mono table-num">
                    {holdingDays != null ? holdingDays : "—"}
                  </td>
                  <td className="mono">{formatTradeLedgerDate(trade.entryDate)}</td>
                  <td className="mono table-num">
                    {Number.isFinite(trade.entryPrice) && trade.entryPrice > 0 ? (
                      formatEquityThousandVndPerShare(trade.entryPrice)
                    ) : (
                      <span className="ledger-deck-table__muted">—</span>
                    )}
                  </td>
                  <td className="mono table-num">
                    {trade.status === "OPEN" ? (
                      latestBar ? (
                        <div className="ledger-deck-table__stack-end">
                          <span>
                            Latest close:{" "}
                            {formatEquityThousandVndPerShare(latestBar.close)}
                          </span>
                          <span className="ledger-deck-table__sub">
                            Data date: {formatBarDataDateUtcLong(latestBar.date)}
                          </span>
                        </div>
                      ) : (
                        <span className="ledger-deck-table__muted">—</span>
                      )
                    ) : trade.exitPrice !== null && Number.isFinite(trade.exitPrice) ? (
                      <div className="ledger-deck-table__stack-end">
                        <span>
                          Exit price: {formatEquityThousandVndPerShare(trade.exitPrice)}
                        </span>
                        {trade.exitDate ? (
                          <span className="ledger-deck-table__sub">
                            Exit date: {formatBarDataDateUtcLong(trade.exitDate)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="mono table-num">{formatQuantityCell(trade.quantity)}</td>
                  <td className="mono table-num ledger-deck-table__sub">
                    {trade.status === "OPEN" ? formatRMultiple(rMultiple) : "—"}
                  </td>
                  <td className="mono table-num ledger-deck-table__sub align-top">
                    {trade.status === "OPEN" ? (
                      <div className="ledger-deck-table__stack-end">
                        <span>{formatSignedVnd(distanceToStop)}</span>
                        {reviewDto?.cushionPctDisplay ? (
                          <span className="ledger-deck-table__sub tabular-nums">
                            {reviewDto.cushionPctDisplay}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="mono table-num ledger-deck-table__sub">
                    {trade.status === "OPEN"
                      ? formatSignedVnd(distanceToTakeProfit)
                      : "—"}
                  </td>
                  <td className="table-num align-top">
                    {trade.status === "OPEN" ? (
                      latestBar ? (
                        <div className="ledger-deck-table__pnl">
                          <span className="ledger-deck-table__pnl-label">Unrealized</span>
                          <span className="ledger-deck-table__pnl-note">
                            Long bias: (latest close − entry) × qty. Short bias: (entry − latest
                            close) × qty. Same price units as entry (thousand ₫ per share).
                            {latestBar ? (
                              <> Data date: {formatBarDataDateUtcLong(latestBar.date)}.</>
                            ) : null}
                          </span>
                          {priceUnitMismatch ? (
                            <>
                              <span className="ledger-deck-table__pnl-warn">
                                Unit check needed — unrealized P&amp;L not shown as valid.
                              </span>
                              <span className="ledger-deck-table__pnl-note">
                                {TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE}
                              </span>
                              <span className="mono ledger-deck-table__sub">
                                Entry (raw): {trade.entryPrice.toFixed(4)} · Latest close (raw):{" "}
                                {latestBar.close.toFixed(4)}
                              </span>
                            </>
                          ) : unrealized?.pnlAmount != null ? (
                            <span
                              className={`mono ledger-deck-table__pnl-value${
                                unrealized.pnlAmount >= 0
                                  ? " ledger-deck-table__pnl-value--pos"
                                  : " ledger-deck-table__pnl-value--neg"
                              }`}
                            >
                              {unrealized.pnlAmount > 0 ? "+" : ""}
                              {formatVND(unrealized.pnlAmount, false)}
                            </span>
                          ) : (
                            <span className="mono ledger-deck-table__muted">—</span>
                          )}
                          {priceUnitMismatch ? (
                            <span className="mono ledger-deck-table__sub">
                              Raw % (do not use): {formatSignedPct(unrealized?.pnlPct ?? null)}
                            </span>
                          ) : (
                            <span
                              className={`mono ledger-deck-table__sub${
                                unrealized?.pnlPct != null
                                  ? unrealized.pnlPct >= 0
                                    ? " ledger-deck-table__pnl-value--pos"
                                    : " ledger-deck-table__pnl-value--neg"
                                  : ""
                              }`}
                            >
                              {formatSignedPct(unrealized?.pnlPct ?? null)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="ledger-deck-table__muted">—</span>
                      )
                    ) : trade.realizedPnl !== null ? (
                      <div className="ledger-deck-table__stack-end">
                        <span className="ledger-deck-table__pnl-label">Realized</span>
                        <span
                          className={`mono ledger-deck-table__pnl-value${
                            trade.realizedPnl >= 0
                              ? " ledger-deck-table__pnl-value--pos"
                              : " ledger-deck-table__pnl-value--neg"
                          }`}
                        >
                          {trade.realizedPnl > 0 ? "+" : ""}
                          {formatVND(trade.realizedPnl, false)}
                        </span>
                      </div>
                    ) : (
                      <span className="ledger-deck-table__muted">—</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/trades/${trade.id}`} className="btn btn-ghost btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DenseTable>
    </section>
  );
}
