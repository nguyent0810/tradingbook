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
          error: "getLatestDailyScanRun() thất bại: " + String(e),
        };
      }),
    getExpectedLatestSessionFromIndexBars(prisma)
      .then((session) => ({ session, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] expectedLatestSession lookup failed:", e);
        return {
          session: null,
          error: "getExpectedLatestSessionFromIndexBars() thất bại: " + String(e),
        };
      }),
    prisma.stockDailyBar
      .aggregate({ _max: { date: true } })
      .then((r) => ({ maxDate: r._max.date, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] equity max bar date failed:", e);
        return {
          maxDate: null as Date | null,
          error: "prisma.stockDailyBar.aggregate({ _max: { date } }) thất bại: " + String(e),
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

/**
 * Full-universe Gate 2 diagnostic — the most expensive read on this page. Persisted
 * until the next daily scan rather than deduped per-request, since it is derived
 * entirely from bars that only change when `daily-scan` is revalidated.
 *
 * Errors deliberately propagate: a throw is not cached, so a transient DB failure
 * can't pin the sidebar to an error state for the whole revalidate window.
 */
async function computeGate2BreakdownCached(
  expectedSession: Date
): Promise<Gate2CategoryBreakdownRow[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  return fetchGate2InvalidBreakdown(prisma, expectedSession);
}

export const loadGate2BreakdownCached = cache(
  async (): Promise<{ breakdown: Gate2CategoryBreakdownRow[]; error: string | null }> => {
    const { expectedSession } = await loadSetupsBaseData();
    if (!expectedSession) return { breakdown: [], error: null };
    try {
      const breakdown = await computeGate2BreakdownCached(expectedSession);
      return { breakdown, error: null };
    } catch (e) {
      console.error("[setups] fetchGate2InvalidBreakdown failed:", e);
      return {
        breakdown: [],
        error: "fetchGate2InvalidBreakdown() thất bại: " + String(e),
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
        error: "SELECT … FROM setup_outcomes GROUP BY setup_type, setup_tier_at_entry thất bại: " + String(e),
      };
    }
  }
);

/** Batch D1 — RS vs VNINDEX on demand; does not affect Gate 2 or persistence. */
export const loadRsDiagnosticsForSetupsCached = cache(
  async (
    symbols: string[]
  ): Promise<{ map: Map<string, RsDiagnosticUi | null>; error: string | null }> => {
    const base = await loadSetupsBaseData();
    const session = base.expectedSession;
    if (!session || symbols.length === 0) {
      return { map: new Map(), error: null };
    }
    try {
      return { map: await loadRsDiagnosticUiForSymbols(prisma, symbols, session), error: null };
    } catch (e) {
      // Nuốt lỗi ở đây sẽ khiến RS20 hiện gap "—" y như khi mã thật sự chưa đủ
      // dữ liệu; người dùng không phân biệt được thiếu dữ liệu với hỏng truy vấn.
      console.error("[setups] loadRsDiagnosticUiForSymbols failed:", e);
      return {
        map: new Map(),
        error: "loadRsDiagnosticUiForSymbols() thất bại: " + String(e),
      };
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
        error: "computeRsNearMissWatchlistFromDb() thất bại: " + String(e),
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
      healthError: "prepareSurfacedCandidatesHealthView() thất bại: " + String(e),
    };
  }
});
