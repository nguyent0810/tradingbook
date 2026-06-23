"use client";

import { Fragment, useMemo, useState } from "react";
import type { RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { EarlyEntryHelpPanel } from "./EarlyEntryHelpPanel";
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
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  statusTooltipForRow,
  workbenchActionLabel,
} from "@/lib/dashboard/rs-status-display";
import { isExtendedDoNotChase } from "@/lib/dashboard/early-entry-ui";

type Props = {
  rows: RelativeStrengthRow[];
  contextNote?: string;
  selectedSymbol?: string | null;
  onSelectSymbol?: (symbol: string | null) => void;
  onHoverSymbol?: (symbol: string | null) => void;
};

function setupStateTone(setupState: string): "success" | "warning" | "danger" | "neutral" {
  const friendly = friendlySetupStateLabel(setupState);
  if (friendly === "Bad Zone" || friendly === "Below MA50" || friendly === "Too Extended") {
    return "danger";
  }
  if (friendly === "Wait Breakout") return "warning";
  return "neutral";
}

function earlyEntryTone(state: string): "success" | "warning" | "danger" | "neutral" {
  const friendly = friendlyEarlyStateLabel(state);
  if (friendly === "Pilot Research" || friendly === "Add Watch" || friendly === "Watch") {
    return "warning";
  }
  if (friendly === "Too Extended") return "danger";
  return "neutral";
}

function formatPp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
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
              <th>Setup</th>
              {showEarlyEntry ? <th className="cd-rs-table__col--hide-mobile">Early</th> : null}
              <th className="text-right">RS20</th>
              <th className="text-right cd-rs-table__col--hide-mobile">RS50</th>
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Score</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">R:R</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">MA20 Dist</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Target</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Invalid</th>
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
              const tooltip = statusTooltipForRow(row);

              return (
                <Fragment key={row.symbol}>
                  <tr
                    data-testid={`rs-workbench-row-${row.symbol}`}
                    className={[
                      extended ? "cd-rs-table__row--extended" : "",
                      isSelected ? "cd-workbench-table__row--selected" : "",
                      "cd-workbench-table__row",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleRow(row.symbol)}
                    onMouseEnter={() => onHoverSymbol?.(row.symbol)}
                    onMouseLeave={() => onHoverSymbol?.(null)}
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
                      title={tooltip ?? undefined}
                    >
                      {workbenchActionLabel(row)}
                    </td>
                    <td title={tooltip ?? undefined}>
                      <Badge
                        tone={setupStateTone(row.setupState)}
                        pulse={row.setupState.startsWith("Watch")}
                        size="compact"
                      >
                        {friendlySetupStateLabel(row.setupState)}
                      </Badge>
                    </td>
                    {showEarlyEntry ? (
                      <td className="cd-rs-table__col--hide-mobile" title={tooltip ?? undefined}>
                        {row.earlyEntry ? (
                          <Badge
                            tone={earlyEntryTone(row.earlyEntry.proposedTradeState)}
                            size="compact"
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
                    <td
                      className={`cd-mono text-right tabular-nums ${row.rs20 >= 0 ? "cd-tone-success" : "cd-tone-danger"}`}
                    >
                      {formatPp(row.rs20)}
                    </td>
                    <td
                      className={`cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile ${row.rs50 != null && row.rs50 >= 0 ? "cd-tone-success" : row.rs50 != null ? "cd-tone-danger" : ""}`}
                    >
                      {formatPp(row.rs50)}
                    </td>
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {row.earlyEntry?.earlyReversalScore ?? "—"}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {row.earlyEntry?.estimatedRiskReward != null
                          ? `${row.earlyEntry.estimatedRiskReward.toFixed(2)}:1`
                          : "—"}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {formatPct(row.earlyEntry?.distFromMa20Pct)}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {row.earlyEntry?.targetPrice?.toFixed(2) ?? "—"}
                      </td>
                    ) : null}
                    {showEarlyEntry ? (
                      <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                        {row.earlyEntry?.invalidLevel?.toFixed(2) ?? "—"}
                      </td>
                    ) : null}
                  </tr>
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
