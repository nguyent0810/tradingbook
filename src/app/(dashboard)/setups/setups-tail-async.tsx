import "server-only";

import { NearMissWatchlistGrid } from "@/components/setups-workstation";
import { TerminalFilterLogLazy as TerminalFilterLog } from "@/components/setups-workstation/TerminalFilterLog-lazy";
import { compareClosestRowsExecutionOrder } from "@/lib/scanner/closest-execution-metrics";
import {
  loadRsDiagnosticsForSetupsCached,
  loadRsNearMissWatchlistForSetupsCached,
  loadSetupsBaseData,
} from "./setups-cached-data";

export async function SetupsTailAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const closestRows = [...(base.notes?.closestToValidSymbols ?? [])].sort((a, b) =>
    compareClosestRowsExecutionOrder(
      {
        rankScore: a.rankScore,
        close: a.close,
        pullbackZoneLow: a.pullbackZoneLow,
        pullbackZoneHigh: a.pullbackZoneHigh,
        symbol: a.symbol,
        partialPipelineScore: a.partialPipelineScore,
        stageRank: a.stageRank,
        reasonLineCount: a.reasonLineCount,
      },
      {
        rankScore: b.rankScore,
        close: b.close,
        pullbackZoneLow: b.pullbackZoneLow,
        pullbackZoneHigh: b.pullbackZoneHigh,
        symbol: b.symbol,
        partialPipelineScore: b.partialPipelineScore,
        stageRank: b.stageRank,
        reasonLineCount: b.reasonLineCount,
      }
    )
  );

  const breakdown = base.latest.tradabilityBreakdown;

  const nearMissSymbols = closestRows.map((r) => r.symbol);
  const [rsMap, rsWatchlistRes] = await Promise.all([
    loadRsDiagnosticsForSetupsCached(nearMissSymbols),
    loadRsNearMissWatchlistForSetupsCached(),
  ]);

  const hasBreakdown =
    breakdown && typeof breakdown === "object" && breakdown !== null;
  const hasTail =
    closestRows.length > 0 ||
    rsWatchlistRes.panel.rows.length > 0 ||
    hasBreakdown;

  if (!hasTail) return null;

  return (
    <div className="space-y-4">
      <NearMissWatchlistGrid
        closestRows={closestRows}
        rsBySymbol={rsMap}
        rsPanel={rsWatchlistRes.panel.rows.length > 0 ? rsWatchlistRes.panel : null}
      />

      {rsWatchlistRes.error ? (
        <p className="text-sm text-rose-400" role="status">
          {rsWatchlistRes.error}
        </p>
      ) : null}

      {hasBreakdown ? (
        <TerminalFilterLog breakdown={breakdown as Record<string, number>} />
      ) : null}
    </div>
  );
}
