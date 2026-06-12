"use client";

import {
  computeClosestExecutionStatus,
} from "@/lib/scanner/closest-execution-metrics";
import { formatScannerReasonForUser } from "@/lib/dashboard/v3-user-copy";
import { displayNearMissDiagnosticStatus } from "@/lib/trading-display-labels";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { SetupsRsWatchlistV3 } from "@/components/setups/setups-rs-watchlist-v3";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import type { NearMissWatchlistGridProps } from "./types";
import "./setups-workstation.css";

function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NearMissWatchlistGrid({
  closestRows,
  rsBySymbol,
  rsPanel,
}: NearMissWatchlistGridProps) {
  const rsMap =
    rsBySymbol instanceof Map
      ? rsBySymbol
      : new Map(Object.entries(rsBySymbol ?? {}));

  return (
    <div className="space-y-4" data-testid="setups-tail-section">
      <div
        className="sw-glass-panel grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]"
        data-testid="setups-near-miss-panel"
      >
        <div className="min-w-0 border-slate-800/40 lg:border-r">
          <header className="flex items-center justify-between border-b border-slate-800/40 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Near-miss pipeline
            </span>
            <span className="font-mono text-xs tabular-nums text-amber-400/90">
              {closestRows.length}
            </span>
          </header>

          {closestRows.length === 0 ? (
            <div className="p-4">
              <EmptyStateWithReason
                title="No near-miss symbols saved"
                reason="This scan did not persist closest-to-valid rows in notes, or none qualified."
                data-testid="setups-near-miss-empty"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="border-r border-slate-800/40 px-3 py-2">Symbol</th>
                    <th className="border-r border-slate-800/40 px-3 py-2">Status</th>
                    <th className="border-r border-slate-800/40 px-3 py-2 text-right">Close</th>
                    <th className="px-3 py-2">Blocker</th>
                  </tr>
                </thead>
                <tbody>
                  {closestRows.map((row) => {
                    const status = computeClosestExecutionStatus(
                      row.terminalCategory,
                      row.close,
                      row.pullbackZoneLow,
                      row.pullbackZoneHigh
                    );
                    const blocker = row.terminalReasonPreview
                      ? formatScannerReasonForUser(row.terminalReasonPreview)
                      : "Not ready";
                    const isAwaiting = status === "WAIT";

                    return (
                      <tr
                        key={`${row.symbol}-${row.stageRank}`}
                        className={`sw-near-miss-row border-b border-slate-800/30 ${
                          isAwaiting ? "hover:bg-white/5" : ""
                        }`}
                      >
                        <td className="border-r border-slate-800/40 px-3 py-2 font-mono font-semibold text-slate-200">
                          {row.symbol}
                        </td>
                        <td className="border-r border-slate-800/40 px-3 py-2">
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                            {displayNearMissDiagnosticStatus(status)}
                          </span>
                        </td>
                        <td className="border-r border-slate-800/40 px-3 py-2 text-right font-mono tabular-nums text-slate-300">
                          {row.close > 0 ? fmtThousands(row.close) : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-400" title={blocker}>
                          {blocker.length > 48 ? `${blocker.slice(0, 47)}…` : blocker}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="min-w-0 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            RS checklist
          </p>
          {closestRows.length > 0 ? (
            <div className="space-y-3">
              {closestRows.slice(0, 5).map((row) => (
                <RelativeStrengthDiagnosticPanel
                  key={`rs-${row.symbol}`}
                  diagnostic={rsMap.get(row.symbol) ?? null}
                  compact
                  testId={`setups-near-miss-rs-${row.symbol}`}
                />
              ))}
            </div>
          ) : rsPanel && rsPanel.rows.length > 0 ? (
            <SetupsRsWatchlistV3 panel={rsPanel} />
          ) : (
            <p className="text-xs text-slate-500">No RS diagnostics available.</p>
          )}
        </aside>
      </div>

      {rsPanel && rsPanel.rows.length > 0 && closestRows.length > 0 ? (
        <div className="sw-glass-panel p-4">
          <header className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Relative strength watchlist
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {rsPanel.rows.length}
            </span>
          </header>
          <SetupsRsWatchlistV3 panel={rsPanel} />
        </div>
      ) : null}
    </div>
  );
}
