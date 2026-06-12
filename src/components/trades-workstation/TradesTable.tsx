"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Fragment, useCallback, useState } from "react";
import { DenseTable } from "@/components/command-deck/dense-table";
import { SignalBadge } from "@/components/command-deck/signal-badge";
import { formatVND, formatEquityThousandVndPerShare, formatBarDataDateUtcLong } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import { TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE } from "@/lib/trades/price-unit-guard";
import {
  displayScanQualityTier,
  displayTradeDirection,
  displayTradeStatus,
} from "@/lib/trading-display-labels";
import { POSITION_EVOLUTION_TRADER_LABEL } from "@/lib/trades/position-state-evolution";
import {
  formatBarSessionDate,
  formatQuantityCell,
  formatRMultiple,
  formatSignedVnd,
  formatTradeLedgerDate,
} from "@/lib/trades/trades-ledger-formatters";
import type {
  TradeLedgerOpenRowPack,
  TradeLedgerRow,
  TradesTableProps,
} from "./types";
import { ExpandableTradeHUD } from "./ExpandableTradeHUD";
import { FlashText } from "./FlashText";
import { ReviewStatusDots } from "./ReviewStatusDots";
import "./trades-workstation.css";

function formatSignedPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function holdingDaysForTrade(
  status: string,
  entryDate: Date,
  exitDate: Date | null,
  now: Date
): number | null {
  const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const start = dayMs(entryDate);
  const end = status === "CLOSED" && exitDate ? dayMs(exitDate) : dayMs(now);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function fallbackRowFields(
  trade: TradeLedgerRow,
  latestCloseBySymbol: Map<string, { close: number; date: Date }>,
  now: Date
) {
  const latestBar =
    trade.status === "OPEN" ? (latestCloseBySymbol.get(trade.symbol.toUpperCase()) ?? null) : null;
  return {
    latestBar,
    unrealized: null as TradeLedgerOpenRowPack["derived"]["unrealized"],
    priceUnitMismatch: false,
    holdingDays: holdingDaysForTrade(trade.status, trade.entryDate, trade.exitDate, now),
    rMultiple: null as number | null,
    distanceToStop: null as number | null,
    distanceToTakeProfit: null as number | null,
  };
}

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

export function TradesTable({
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
}: TradesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const toggleExpand = useCallback((tradeId: string) => {
    setExpandedId((prev) => (prev === tradeId ? null : tradeId));
  }, []);

  return (
    <section className="tw-glass-panel overflow-hidden" data-testid="trades-ledger-table-section">
      <header className="border-b border-slate-800/50 px-4 py-3">
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          Trades ledger
        </h2>
        <p
          className="mt-1 text-xs text-slate-600"
          data-testid="trades-ledger-scroll-hint"
        >
          Scroll horizontally for the full ledger. Click a row to expand the position HUD. Symbol
          column stays pinned.
        </p>
        <p className="mt-0.5 text-[10px] text-slate-600">
          Equity prices are{" "}
          <span className="text-slate-500">thousand VND per share</span> (imported EOD).
        </p>
      </header>

      <DenseTable
        testId="trades-scroll-container"
        minWidth="1840px"
        className="ledger-deck-table-wrap table-sticky trades-ledger-scroll dense-table-scroll--sticky-symbol"
        ariaLabel="Trades ledger table"
        scrollHint="Scroll horizontally for full ledger columns. Symbol column stays pinned."
      >
        <table
          className="table dense-table ledger-deck-table ledger-deck-table--dense ledger-deck-table--financial"
          data-testid="trades-table"
        >
          <colgroup>
            <col className="ledger-col-symbol" />
            <col className="ledger-col-setup" />
            <col className="ledger-col-direction" />
            <col className="ledger-col-playbook" />
            <col className="ledger-col-status" />
            <col className="ledger-col-review" />
            <col className="ledger-col-hold" />
            <col className="ledger-col-entry" />
            <col className="ledger-col-price" />
            <col className="ledger-col-mark" />
            <col className="ledger-col-qty" />
            <col className="ledger-col-r" />
            <col className="ledger-col-stop" />
            <col className="ledger-col-tp" />
            <col className="ledger-col-pnl" />
            <col className="ledger-col-actions" />
          </colgroup>
          <thead data-testid="trades-table-header">
            <tr>
              <th className="ledger-sticky-symbol ledger-deck-table__th--text">Symbol</th>
              <th className="ledger-deck-table__th--text">Setup</th>
              <th className="ledger-deck-table__th--center">Direction</th>
              <th className="ledger-deck-table__th--text">Playbook</th>
              <th className="ledger-deck-table__th--center">Status</th>
              <th className="ledger-deck-table__th--center">Review</th>
              <th className="ledger-deck-table__th--center table-num">Hold</th>
              <th className="ledger-deck-table__th--center">Entry</th>
              <th className="ledger-deck-table__th--num table-num">
                <span className="block">Entry ₫</span>
                <span className="ledger-deck-table__th-sub">k per share</span>
              </th>
              <th className="ledger-deck-table__th--num table-num">
                <span className="block">Mark</span>
                <span className="ledger-deck-table__th-sub">EOD / exit</span>
              </th>
              <th className="ledger-deck-table__th--num table-num">Qty</th>
              <th className="ledger-deck-table__th--num table-num">R</th>
              <th className="ledger-deck-table__th--num table-num">Stop</th>
              <th className="ledger-deck-table__th--num table-num">TP</th>
              <th className="ledger-deck-table__th--num table-num">P&amp;L</th>
              <th className="ledger-deck-table__th--center" aria-label="Actions" />
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

              const trade = item as TradeLedgerRow;
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
                fallbackRowFields(trade, latestCloseBySymbol, now);

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

              const isExpanded = expandedId === trade.id;
              const isHovered = hoverId === trade.id;

              const rowClass = [
                "ledger-deck-table__row tw-ledger-row cursor-pointer py-2.5",
                isSessionFocusRow ? "ledger-deck-table__row--focus" : "",
                rowHandledCalm ? "ledger-deck-table__row--calm" : "",
                dimNonFocusSessionRow ? "ledger-deck-table__row--dimmed" : "",
                isExpanded ? "tw-ledger-row--expanded" : "",
                isHovered && !isExpanded ? "tw-ledger-row--hover" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const markDisplay =
                trade.status === "OPEN" && latestBar
                  ? formatEquityThousandVndPerShare(latestBar.close)
                  : trade.exitPrice != null && Number.isFinite(trade.exitPrice)
                    ? formatEquityThousandVndPerShare(trade.exitPrice)
                    : null;

              return (
                <Fragment key={trade.id}>
                  <tr
                    data-testid="trades-table-row"
                    data-review-session-focus={isSessionFocusRow ? "true" : undefined}
                    className={rowClass}
                    onClick={() => toggleExpand(trade.id)}
                    onMouseEnter={() => setHoverId(trade.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <td className="ledger-sticky-symbol ledger-deck-table__td--text dense-candidate-row__symbol-cell">
                      <span
                        className={`ledger-deck-table__symbol mono font-semibold ${
                          trade.direction === "LONG" ? "tw-symbol-long" : "tw-symbol-short"
                        }`}
                      >
                        {trade.symbol}
                      </span>
                      {priceUnitMismatch ? (
                        <SignalBadge variant="at-risk" className="ledger-deck-table__unit-warn">
                          Unit issue
                        </SignalBadge>
                      ) : null}
                    </td>
                    <td className="ledger-deck-table__td--text">
                      {trade.setupCandidate ? (
                        <span className="ledger-deck-table__chip">
                          {displayScanQualityTier(trade.setupCandidate.quality)} ·{" "}
                          {formatPlaybookLabel(trade.setupCandidate.setupType)}
                        </span>
                      ) : (
                        <span className="ledger-deck-table__muted">Manual</span>
                      )}
                    </td>
                    <td className="ledger-deck-table__td--center">
                      <SignalBadge
                        variant={trade.direction === "LONG" ? "healthy" : "at-risk"}
                      >
                        {displayTradeDirection(trade.direction)}
                      </SignalBadge>
                    </td>
                    <td className="ledger-deck-table__td--text whitespace-nowrap">
                      <span className="ledger-deck-table__chip whitespace-nowrap">
                        {formatPlaybookLabel(trade.playbook)}
                      </span>
                    </td>
                    <td className="ledger-deck-table__td--center">
                      <SignalBadge variant={tradeStatusBadgeVariant(trade.status)}>
                        {displayTradeStatus(trade.status)}
                      </SignalBadge>
                    </td>
                    <td
                      className="ledger-deck-table__td--center ledger-deck-table__review-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {trade.status === "OPEN" && reviewDto && openPack ? (
                        <ReviewStatusDots
                          tradeId={trade.id}
                          priorityTier={openPack.priorityTier}
                          reviewDto={reviewDto}
                          reviewedToday={checkedTodayTradeIds.has(trade.id)}
                          escalationCues={openPack.escalationCues}
                          evolutionStateLabel={
                            POSITION_EVOLUTION_TRADER_LABEL[
                              openPack.positionEvolution as keyof typeof POSITION_EVOLUTION_TRADER_LABEL
                            ]
                          }
                          evolutionExplainLine={openPack.positionEvolutionLine}
                          compact={
                            compactReview ||
                            (reviewSessionActive && !isSessionFocusRow)
                          }
                          sessionMode={reviewSessionActive}
                          sessionFocused={Boolean(isSessionFocusRow)}
                        />
                      ) : (
                        <span className="ledger-deck-table__muted">—</span>
                      )}
                    </td>
                    <td className="ledger-deck-table__td--center mono table-num tabular-nums">
                      {holdingDays != null ? holdingDays : "—"}
                    </td>
                    <td className="ledger-deck-table__td--center mono">
                      {formatTradeLedgerDate(trade.entryDate)}
                    </td>
                    <td className="ledger-deck-table__td--num mono table-num tabular-nums">
                      {Number.isFinite(trade.entryPrice) && trade.entryPrice > 0 ? (
                        formatEquityThousandVndPerShare(trade.entryPrice)
                      ) : (
                        <span className="ledger-deck-table__muted">—</span>
                      )}
                    </td>
                    <td className="ledger-deck-table__td--num mono table-num ledger-deck-table__mark tabular-nums">
                      {trade.status === "OPEN" ? (
                        latestBar ? (
                          <span title={`Data date: ${formatBarDataDateUtcLong(latestBar.date)}`}>
                            <FlashText value={latestBar.close} className="ledger-deck-table__mark-value">
                              {markDisplay}
                            </FlashText>
                          </span>
                        ) : (
                          <span className="ledger-deck-table__muted">—</span>
                        )
                      ) : trade.exitPrice !== null && Number.isFinite(trade.exitPrice) ? (
                        <span
                          className="ledger-deck-table__mark-value tabular-nums"
                          title={
                            trade.exitDate
                              ? `Exit ${formatBarDataDateUtcLong(trade.exitDate)}`
                              : undefined
                          }
                        >
                          {markDisplay}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="ledger-deck-table__td--num mono table-num tabular-nums">
                      {formatQuantityCell(trade.quantity)}
                    </td>
                    <td className="ledger-deck-table__td--num mono table-num ledger-deck-table__sub tabular-nums">
                      {trade.status === "OPEN" ? formatRMultiple(rMultiple) : "—"}
                    </td>
                    <td className="ledger-deck-table__td--num mono table-num ledger-deck-table__sub tabular-nums">
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
                    <td className="ledger-deck-table__td--num mono table-num ledger-deck-table__sub tabular-nums">
                      {trade.status === "OPEN"
                        ? formatSignedVnd(distanceToTakeProfit)
                        : "—"}
                    </td>
                    <td className="ledger-deck-table__td--num table-num ledger-deck-table__pnl-cell tabular-nums">
                      {trade.status === "OPEN" ? (
                        latestBar ? (
                          <div
                            className="ledger-deck-table__pnl ledger-deck-table__pnl--compact"
                            title={
                              priceUnitMismatch
                                ? TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE
                                : `Unrealized · ${formatBarDataDateUtcLong(latestBar.date)}`
                            }
                          >
                            {priceUnitMismatch ? (
                              <span className="ledger-deck-table__pnl-warn">Unit check</span>
                            ) : unrealized?.pnlAmount != null ? (
                              <>
                                <FlashText
                                  value={unrealized.pnlAmount}
                                  className={`ledger-deck-table__pnl-value${
                                    unrealized.pnlAmount >= 0
                                      ? " ledger-deck-table__pnl-value--pos"
                                      : " ledger-deck-table__pnl-value--neg"
                                  }`}
                                >
                                  {unrealized.pnlAmount > 0 ? "+" : ""}
                                  {formatVND(unrealized.pnlAmount, false)}
                                </FlashText>
                                <span
                                  className={`mono ledger-deck-table__pnl-pct tabular-nums${
                                    unrealized.pnlPct != null
                                      ? unrealized.pnlPct >= 0
                                        ? " ledger-deck-table__pnl-value--pos"
                                        : " ledger-deck-table__pnl-value--neg"
                                      : ""
                                  }`}
                                >
                                  {formatSignedPct(unrealized?.pnlPct ?? null)}
                                </span>
                              </>
                            ) : (
                              <span className="mono ledger-deck-table__muted">—</span>
                            )}
                          </div>
                        ) : (
                          <span className="ledger-deck-table__muted">—</span>
                        )
                      ) : trade.realizedPnl !== null ? (
                        <span
                          className={`mono ledger-deck-table__pnl-value tabular-nums${
                            trade.realizedPnl >= 0
                              ? " ledger-deck-table__pnl-value--pos"
                              : " ledger-deck-table__pnl-value--neg"
                          }`}
                        >
                          {trade.realizedPnl > 0 ? "+" : ""}
                          {formatVND(trade.realizedPnl, false)}
                        </span>
                      ) : (
                        <span className="ledger-deck-table__muted">—</span>
                      )}
                    </td>
                    <td
                      className="ledger-deck-table__td--center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/trades/${trade.id}`} className="btn btn-ghost btn-sm">
                        Edit
                      </Link>
                    </td>
                  </tr>

                  <AnimatePresence initial={false}>
                    {isExpanded && trade.status === "OPEN" && openPack ? (
                      <tr>
                        <td colSpan={16} className="p-0">
                          <motion.div
                            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <ExpandableTradeHUD
                              trade={trade}
                              openPack={openPack}
                              latestBar={latestBar ?? null}
                              formatBarSessionDate={formatBarSessionDate}
                            />
                          </motion.div>
                        </td>
                      </tr>
                    ) : null}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </DenseTable>
    </section>
  );
}
