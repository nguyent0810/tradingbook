import "server-only";

import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDailyScanGate2Notes } from "@/lib/scanner/parse-daily-scan-notes";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  getLatestDailyScanRun,
  toCandidateRows,
  type LatestScanWithCandidates,
} from "@/lib/scanner/setups-queries";
import type { Gate2CategoryBreakdownRow } from "@/lib/scanner/setups-gate2-breakdown";
import { fetchGate2InvalidBreakdown } from "@/lib/scanner/setups-gate2-breakdown";
import { ScanQuality, ScanSetupType } from "@/generated/prisma/client";
import { prepareSurfacedCandidatesHealthView } from "@/lib/setup-health";
import { loadRsDiagnosticUiForSymbols } from "@/lib/scanner/gate2/load-rs-diagnostics";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import {
  buildRsNearMissWatchlistPanel,
  getCachedRsNearMissWatchlist,
  type RsNearMissWatchlistPanelDto,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";

export type SetupsBaseData = {
  latest: LatestScanWithCandidates | null;
  candidateRows: ReturnType<typeof toCandidateRows>;
  notes: ReturnType<typeof parseDailyScanGate2Notes>;
  expectedSession: Date | null;
  /** Max `StockDailyBar.date` in DB (UTC calendar). */
  latestEquityBarSession: Date | null;
  scanLoadError: string | null;
  sessionLoadError: string | null;
  equityMaxLoadError: string | null;
};

/** Latest scan + index session in parallel, cached across requests until the next daily scan. */
export async function loadSetupsBaseData(): Promise<SetupsBaseData> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  const [scanRes, sessionRes, equityRes] = await Promise.all([
    getLatestDailyScanRun()
      .then((latest) => ({ latest, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] getLatestDailyScanRun failed:", e);
        return {
          latest: null,
          error: "Database temporarily unavailable (scanner data).",
        };
      }),
    getExpectedLatestSessionFromIndexBars(prisma)
      .then((session) => ({ session, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] expectedLatestSession lookup failed:", e);
        return {
          session: null,
          error: "Database temporarily unavailable (benchmark session).",
        };
      }),
    prisma.stockDailyBar
      .aggregate({ _max: { date: true } })
      .then((r) => ({ maxDate: r._max.date, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] equity max bar date failed:", e);
        return {
          maxDate: null as Date | null,
          error: "Database temporarily unavailable (equity bar dates).",
        };
      }),
  ]);

  const notes = parseDailyScanGate2Notes(scanRes.latest?.notes ?? null);
  const candidateRows = toCandidateRows(scanRes.latest);

  return {
    latest: scanRes.latest,
    candidateRows,
    notes,
    expectedSession: sessionRes.session,
    latestEquityBarSession: equityRes.maxDate,
    scanLoadError: scanRes.error,
    sessionLoadError: sessionRes.error,
    equityMaxLoadError: equityRes.error,
  };
}

export const loadGate2BreakdownCached = cache(
  async (): Promise<{ breakdown: Gate2CategoryBreakdownRow[]; error: string | null }> => {
    const { expectedSession } = await loadSetupsBaseData();
    if (!expectedSession) return { breakdown: [], error: null };
    try {
      const breakdown = await fetchGate2InvalidBreakdown(prisma, expectedSession);
      return { breakdown, error: null };
    } catch (e) {
      console.error("[setups] fetchGate2InvalidBreakdown failed:", e);
      return {
        breakdown: [],
        error: "Database temporarily unavailable (setup diagnostics).",
      };
    }
  }
);

export type SetupPerfRowRaw = {
  setup_type: ScanSetupType;
  setup_tier_at_entry: ScanQuality;
  trade_count: bigint | number;
  win_count: bigint | number;
  avg_r: number | null;
};

export const loadSetupPerfRowsCached = cache(
  async (): Promise<{ rows: SetupPerfRowRaw[]; error: string | null }> => {
    try {
      const rows = await prisma.$queryRaw<SetupPerfRowRaw[]>`
        SELECT
          setup_type,
          setup_tier_at_entry,
          COUNT(*) AS trade_count,
          SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) AS win_count,
          AVG(r_multiple) AS avg_r
        FROM setup_outcomes
        GROUP BY setup_type, setup_tier_at_entry
      `;
      return { rows, error: null };
    } catch (e) {
      console.error("[setups] setupPerfRows query failed:", e);
      return {
        rows: [],
        error: "Database temporarily unavailable (setup performance stats).",
      };
    }
  }
);

/** Batch D1 — RS vs VNINDEX on demand; does not affect Gate 2 or persistence. */
export const loadRsDiagnosticsForSetupsCached = cache(
  async (symbols: string[]): Promise<Map<string, RsDiagnosticUi | null>> => {
    const base = await loadSetupsBaseData();
    const session = base.expectedSession;
    if (!session || symbols.length === 0) {
      return new Map();
    }
    try {
      return await loadRsDiagnosticUiForSymbols(prisma, symbols, session);
    } catch (e) {
      console.error("[setups] loadRsDiagnosticUiForSymbols failed:", e);
      return new Map();
    }
  }
);

/** Batch D2.3 — RS near-miss watchlist (read-only; excludes latest scan Tier A/B). */
export const loadRsNearMissWatchlistForSetupsCached = cache(
  async (): Promise<{
    panel: RsNearMissWatchlistPanelDto;
    error: string | null;
  }> => {
    const base = await loadSetupsBaseData();
    if (!base.expectedSession) {
      return {
        panel: buildRsNearMissWatchlistPanel([]),
        error: base.sessionLoadError,
      };
    }
    const excludeSymbols = base.candidateRows.map((c) => c.symbolKey);
    try {
      const { rows, earlyEntryBySymbol } = await getCachedRsNearMissWatchlist({
        limit: 15,
        excludeSymbols,
      });
      const rsMap = await loadRsDiagnosticUiForSymbols(
        prisma,
        rows.map((r) => r.symbol),
        base.expectedSession
      );
      return {
        panel: buildRsNearMissWatchlistPanel(rows, rsMap, earlyEntryBySymbol),
        error: null,
      };
    } catch (e) {
      console.error("[setups] computeRsNearMissWatchlistFromDb failed:", e);
      return {
        panel: buildRsNearMissWatchlistPanel([]),
        error: "Database temporarily unavailable (RS watchlist).",
      };
    }
  }
);

export const loadSurfacedCandidatesHealthCached = cache(async () => {
  const base = await loadSetupsBaseData();
  if (!base.latest) {
    return {
      candidatesWithHealth: [] as Awaited<ReturnType<typeof prepareSurfacedCandidatesHealthView>>,
      healthError: null as string | null,
    };
  }

  const candidates = base.candidateRows;
  const evalBarDateForHealth =
    base.expectedSession ??
    (candidates.length > 0
      ? candidates.reduce(
          (latestDate, c) => (c.barDate > latestDate ? c.barDate : latestDate),
          candidates[0]!.barDate
        )
      : null);

  if (candidates.length === 0 || !evalBarDateForHealth) {
    return { candidatesWithHealth: [], healthError: null };
  }

  try {
    const candidatesWithHealth = await prepareSurfacedCandidatesHealthView(
      prisma,
      candidates,
      evalBarDateForHealth
    );
    return { candidatesWithHealth, healthError: null };
  } catch (e) {
    console.error("[setups] prepareSurfacedCandidatesHealthView failed:", e);
    return {
      candidatesWithHealth: [],
      healthError: "Database temporarily unavailable (candidate health).",
    };
  }
});
