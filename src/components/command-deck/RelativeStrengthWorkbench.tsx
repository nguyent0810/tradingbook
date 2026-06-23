"use client";

import { Fragment, useMemo, useState } from "react";
import type { RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { EarlyEntryHelpPanel } from "./EarlyEntryHelpPanel";
import { WorkbenchRowQuickActions } from "./WorkbenchRowQuickActions";
import {
  countWorkbenchRowsByFilter,
  filterEmptyStateMessage,
  filterWorkbenchRows,
  formatReasonChip,
  hasAnyEarlyEntryRows,
  RS_WORKBENCH_SORT_OPTIONS,
  sortWorkbenchRows,
  visibleFilterOptions,
  type RsWorkbenchFilterId,
  type RsWorkbenchSortId,
} from "@/lib/dashboard/rs-workbench-ui";
import {
  WORKBENCH_COLUMN_TOOLTIPS,
  formatMa20DistPct,
  formatRiskReward,
  formatWorkbenchPrice,
} from "@/lib/dashboard/rs-workbench-format";
import {
  earlyResearchBadgeTone,
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  setupBadgeTone,
  setupStateTooltip,
  earlyStateTooltip,
  workbenchActionLabel,
  workbenchActionTooltip,
} from "@/lib/dashboard/rs-status-display";
import { isExtendedDoNotChase } from "@/lib/dashboard/early-entry-ui";

type Props = {
  rows: RelativeStrengthRow[];
  contextNote?: string;
  selectedSymbol?: string | null;
  onSelectSymbol?: (symbol: string | null) => void;
  onHoverSymbol?: (symbol: string | null) => void;
};

function formatPp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
}

export function RelativeStrengthWorkbench({
  rows,
  contextNote,
  selectedSymbol,
  onSelectSymbol,
  onHoverSymbol,
}: Props) {
  const [filter, setFilter] = useState<RsWorkbenchFilterId>("all");
  const [sort, setSort] = useState<RsWorkbenchSortId>("rs20_desc");
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [hoveredRowSymbol, setHoveredRowSymbol] = useState<string | null>(null);

  const showEarlyEntry = hasAnyEarlyEntryRows(rows);
  const filterOptions = useMemo(() => visibleFilterOptions(rows), [rows]);
  const filterCounts = useMemo(() => countWorkbenchRowsByFilter(rows), [rows]);

  const displayRows = useMemo(
    () => sortWorkbenchRows(filterWorkbenchRows(rows, filter), sort),
    [rows, filter, sort]
  );

  const emptyMessage = filterEmptyStateMessage(filter, displayRows.length);

  const showSector = rows.some((r) => r.sectorLabel && r.sectorLabel !== "Other");
  const baseCols = 4 + (showSector ? 1 : 0);
  const earlyCols = showEarlyEntry ? 5 : 0;
  const detailColSpan = baseCols + earlyCols;

  function toggleRow(symbol: string) {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol));
    onSelectSymbol?.(symbol);
  }

  function handleRowMouseEnter(symbol: string) {
    setHoveredRowSymbol(symbol);
    onHoverSymbol?.(symbol);
  }

  function handleRowMouseLeave() {
    setHoveredRowSymbol(null);
    onHoverSymbol?.(null);
  }

  return (
    <Card className="cd-workbench p-4" data-testid="command-deck-rs-workbench">
      <CardHeader
        title="Relative Strength Workbench"
        subtitle="Primary workspace — leaders vs VNINDEX not yet cleared for entry"
      />

      {contextNote ? (
        <p
          className="text-xs m-0 mb-2 leading-relaxed"
          style={{ color: "var(--cd-text-muted)" }}
          data-testid="dashboard-rs-context-banner"
        >
          {contextNote}
        </p>
      ) : null}

      {showEarlyEntry ? (
        <div className="cd-rs-early-compact mb-2" data-testid="command-deck-rs-early-research-section">
          <p className="m-0 text-xs cd-rs-early-compact__line">
            Early Entry Research · research-only · not a buy signal · paper validation enabled
          </p>
          <EarlyEntryHelpPanel />
        </div>
      ) : null}

      <div className="cd-workbench__toolbar mb-2">
        <div className="cd-workbench__filters" role="group" aria-label="RS filters">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`cd-workbench__chip ${filter === opt.id ? "cd-workbench__chip--active" : ""}`}
              onClick={() => setFilter(opt.id)}
              data-testid={`rs-filter-${opt.id}`}
            >
              {opt.label} {filterCounts[opt.id]}
            </button>
          ))}
        </div>
        <label className="cd-workbench__sort">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RsWorkbenchSortId)}
            className="cd-workbench__sort-select"
            aria-label="Sort RS workbench"
          >
            {RS_WORKBENCH_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {emptyMessage ? (
        <p
          className="text-xs m-0 mb-2 cd-workbench-empty"
          data-testid="rs-workbench-empty-state"
          style={{ color: "var(--cd-text-muted)" }}
        >
          {emptyMessage}
        </p>
      ) : null}

      <div className="cd-workbench-scroll" role="region" aria-label="Relative strength workbench">
        <table className="cd-rs-table cd-workbench-table">
          <thead>
            <tr>
              <th>Symbol</th>
              {showSector ? <th>Sector</th> : null}
              <th>Action</th>
              <th>Main Setup</th>
              {showEarlyEntry ? (
                <th className="cd-rs-table__col--hide-mobile">Early Research</th>
              ) : null}
              <th className="text-right">RS20</th>
              <th className="text-right cd-rs-table__col--hide-mobile">RS50</th>
              {showEarlyEntry ? (
                <th
                  className="text-right cd-rs-table__col--hide-mobile"
                  title={WORKBENCH_COLUMN_TOOLTIPS.earlyScore}
                >
                  Early Score
                </th>
              ) : null}
              {showEarlyEntry ? (
                <th
                  className="text-right cd-rs-table__col--hide-mobile"
                  title={WORKBENCH_COLUMN_TOOLTIPS.rr}
                >
                  R:R
                </th>
              ) : null}
              {showEarlyEntry ? (
                <th
                  className="text-right cd-rs-table__col--hide-mobile"
                  title={WORKBENCH_COLUMN_TOOLTIPS.ma20Dist}
                >
                  MA20 Dist
                </th>
              ) : null}
              {showEarlyEntry ? (
                <th
                  className="text-right cd-rs-table__col--hide-mobile"
                  title={WORKBENCH_COLUMN_TOOLTIPS.target}
                >
                  Target
                </th>
              ) : null}
              {showEarlyEntry ? (
                <th
                  className="text-right cd-rs-table__col--hide-mobile"
                  title={WORKBENCH_COLUMN_TOOLTIPS.invalid}
                >
                  Invalid
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const extended =
                row.earlyEntry != null &&
                isExtendedDoNotChase(row.earlyEntry.proposedTradeState);
              const isSelected = selectedSymbol === row.symbol;
              const isExpanded = expandedSymbol === row.symbol;
              const isHovered = hoveredRowSymbol === row.symbol;
              const action = workbenchActionLabel(row);
              const actionTip = workbenchActionTooltip(row);
              const setupTip = setupStateTooltip(row.setupState);
              const earlyTip = row.earlyEntry
                ? earlyStateTooltip(row.earlyEntry.proposedTradeState)
                : null;

              return (
                <Fragment key={row.symbol}>
                  <tr
                    data-testid={`rs-workbench-row-${row.symbol}`}
                    className={[
                      extended ? "cd-rs-table__row--extended" : "",
                      isSelected ? "cd-workbench-table__row--selected" : "",
                      isHovered ? "cd-workbench-table__row--hover" : "",
                      "cd-workbench-table__row",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleRow(row.symbol)}
                    onMouseEnter={() => handleRowMouseEnter(row.symbol)}
                    onMouseLeave={handleRowMouseLeave}
                  >
                    <td className="cd-rs-table__symbol cd-mono">{row.symbol}</td>
                    {showSector ? (
                      <td className="text-xs" style={{ color: "var(--cd-text-muted)" }}>
                        {row.sectorLabel}
                      </td>
                    ) : null}
                    <td
                      className="text-xs cd-workbench-action"
                      style={{ color: "var(--cd-text)" }}
                      title={actionTip}
                      data-testid={`rs-action-${row.symbol}`}
                    >
                      {action}
                    </td>
                    <td title={setupTip ?? undefined}>
                      <Badge
                        tone={setupBadgeTone(row.setupState)}
                        size="compact"
                        titleCase
                      >
                        {friendlySetupStateLabel(row.setupState)}
                      </Badge>
                    </td>
                    {showEarlyEntry ? (
                      <td className="cd-rs-table__col--hide-mobile" title={earlyTip ?? undefined}>
                        {row.earlyEntry ? (
                          <Badge
                            tone={earlyResearchBadgeTone(row.earlyEntry.proposedTradeState)}
                            size="compact"
                            titleCase
                            data-testid={
                              extended ? "extended-warning" : undefined
                            }
                          >
                            {friendlyEarlyStateLabel(row.earlyEntry.proposedTradeState)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    <td className="cd-mono text-right tabular-nums">{formatPp(row.rs20)}</td>
                    <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                      {formatPp(row.rs50)}
                    </td>
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {row.earlyEntry?.earlyReversalScore ?? "—"}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {formatRiskReward(row.earlyEntry?.estimatedRiskReward)}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {formatMa20DistPct(row.earlyEntry?.distFromMa20Pct)}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td
                        className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile"
                        title={WORKBENCH_COLUMN_TOOLTIPS.target}
                      >
                        {formatWorkbenchPrice(row.earlyEntry?.targetPrice)}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td
                        className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile"
                        title={WORKBENCH_COLUMN_TOOLTIPS.invalid}
                      >
                        {formatWorkbenchPrice(row.earlyEntry?.invalidLevel)}
                      </td>
                    ) : null}
                  </tr>
                  {isHovered || isExpanded ? (
                    <tr className="cd-workbench-quick-row">
                      <td colSpan={detailColSpan}>
                        <WorkbenchRowQuickActions symbol={row.symbol} />
                      </td>
                    </tr>
                  ) : null}
                  {isExpanded && row.earlyEntry ? (
                    <tr className="cd-workbench-detail-row">
                      <td colSpan={detailColSpan}>
                        <div
                          className="cd-workbench-detail"
                          data-testid="rs-workbench-detail"
                        >
                          <p className="m-0 mb-1 text-xs" style={{ color: "var(--cd-text-muted)" }}>
                            {row.reason}
                          </p>
                          {row.earlyEntry.reasonCodes.length > 0 ? (
                            <div className="cd-workbench-detail__chips">
                              {row.earlyEntry.reasonCodes.map((code) => (
                                <span key={code} className="cd-workbench-chip">
                                  {formatReasonChip(code)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {row.earlyEntry.targetReason ? (
                            <p className="m-0 mt-1 text-xs">
                              Target: {row.earlyEntry.targetReason}
                            </p>
                          ) : null}
                          {row.earlyEntry.invalidLevelReason ? (
                            <p className="m-0 mt-1 text-xs">
                              Invalid: {row.earlyEntry.invalidLevelReason}
                            </p>
                          ) : null}
                          {row.earlyEntry.whyNotPilotYet ? (
                            <p className="m-0 mt-1 text-xs cd-tone-warning">
                              Why not pilot: {row.earlyEntry.whyNotPilotYet}
                            </p>
                          ) : null}
                          <p className="m-0 mt-1 text-[10px]" style={{ color: "var(--cd-text-dim)" }}>
                            Paper validation: log daily, validate weekly — see safety details above.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs m-0 mt-2" style={{ color: "var(--cd-text-dim)" }}>
          No RS leaders on this session.
        </p>
      ) : null}
    </Card>
  );
}
