import type { PrismaClient } from "@/generated/prisma/client";
import {
  categorizeTerminalReason,
  terminalGate2Reason,
  type Gate2DiagnosticEvaluationRow,
  type TerminalCategory,
} from "@/lib/scanner/gate2-scan-diagnostics";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "@/lib/scanner/gate2/breakout-pullback";
import type { BreakoutPullbackEvaluation } from "@/lib/scanner/gate2/types";
import {
  computeDistanceToPullbackZoneFrac,
  computeRiskToStopFrac,
} from "@/lib/scanner/closest-execution-metrics";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "@/lib/scanner/tradability";
import { sma } from "@/lib/playbook/indicators";

/** Read-only diagnostic copy — not a trade suggestion. */
export const NEAR_MISS_WATCHLIST_DISCLAIMER =
  "Near-miss rows are Gate 2 diagnostics only. They are not setups and must not be traded on alone.";

export type NearMissWatchlistRow = {
  symbol: string;
  terminalCategory: TerminalCategory | "N/A";
  watchlistDiagnosticCategory: string;
  failedReasons: string[];
  close: number;
  ma20: number | null;
  ma50: number | null;
  maRelationship: "ma20_gte_ma50" | "ma20_lt_ma50" | "unknown";
  riskToStopFrac: number | null;
  distanceToPullbackZoneFrac: number | null;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  stageRank: number;
  rankScore: number;
};

/** Gate 2 INVALID paths often clear pullback zone fields; recover bounds from reason text when present. */
function tryExtractPullbackZoneFromReason(reason: string): {
  low: number;
  high: number;
} | null {
  const m = reason.match(/\(([0-9]+\.?[0-9]*)\s*[–—\-]\s*([0-9]+\.?[0-9]*)\)/);
  if (!m) return null;
  const a = Number.parseFloat(m[1]!);
  const b = Number.parseFloat(m[2]!);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function maAtLastBar(
  bars: Parameters<typeof sortDedupeGate2Bars>[0]
): { ma20: number | null; ma50: number | null } {
  const sorted = sortDedupeGate2Bars(bars);
  if (sorted.length < 50) return { ma20: null, ma50: null };
  const closes = sorted.map((b) => b.close);
  const ma20s = sma(closes, 20);
  const ma50s = sma(closes, 50);
  const L = sorted.length - 1;
  const m20 = ma20s[L];
  const m50 = ma50s[L];
  return {
    ma20:
      m20 !== undefined && Number.isFinite(m20) && !Number.isNaN(m20) ? m20 : null,
    ma50:
      m50 !== undefined && Number.isFinite(m50) && !Number.isNaN(m50) ? m50 : null,
  };
}

/**
 * Human-facing bucket for watchlist CLI/docs (diagnostic only — does not change Gate 2).
 */
export function nearMissWatchlistDiagnosticLabel(
  terminalCategory: TerminalCategory | "N/A",
  distanceToPullbackZoneFrac: number | null
): string {
  if (terminalCategory === "pullback_zone_interaction") {
    if (
      distanceToPullbackZoneFrac != null &&
      Number.isFinite(distanceToPullbackZoneFrac) &&
      distanceToPullbackZoneFrac > 0
    ) {
      return "Above pullback zone — wait";
    }
    return "Near pullback zone — watch confirmation";
  }
  if (terminalCategory === "trend_below_ma50") {
    return "Trend not aligned — ignore for now";
  }
  if (terminalCategory === "trend_ma20_below_ma50") {
    return "MA weak — watch later";
  }
  if (terminalCategory === "stop_structure") {
    return "Risk/reward invalid — avoid";
  }
  return "Other near-miss — review reasons";
}

export type BarRow = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Map one INVALID Gate 2 evaluation to a watchlist row (shared audit + CLI). */
export function invalidGate2EvaluationToWatchlistRow(params: {
  symbol: string;
  ev: BreakoutPullbackEvaluation;
  bars: readonly BarRow[];
}): NearMissWatchlistRow {
  const { symbol, ev, bars } = params;
  if (ev.quality !== "INVALID") {
    throw new Error("watchlist row expects INVALID Gate 2 evaluation");
  }
  const term = terminalGate2Reason(ev);
  const { category: terminalCategory, stageRank } = categorizeTerminalReason(term);
  const { ma20, ma50 } = maAtLastBar(bars);

  const zoneFromEv =
    ev.pullbackZoneLow > 0 && ev.pullbackZoneHigh > 0
      ? { low: ev.pullbackZoneLow, high: ev.pullbackZoneHigh }
      : tryExtractPullbackZoneFromReason(term);

  const riskRaw =
    ev.stopLevel > 0 ? computeRiskToStopFrac(ev.close, ev.stopLevel) : null;
  const distRaw =
    zoneFromEv != null
      ? computeDistanceToPullbackZoneFrac(
          ev.close,
          zoneFromEv.low,
          zoneFromEv.high
        )
      : null;

  const riskToStopFrac =
    riskRaw != null && Number.isFinite(riskRaw)
      ? Number(riskRaw.toFixed(6))
      : null;
  const distanceToPullbackZoneFrac =
    distRaw != null && Number.isFinite(distRaw)
      ? Number(distRaw.toFixed(6))
      : null;

  const maRelationship =
    ma20 != null && ma50 != null
      ? ma20 >= ma50
        ? "ma20_gte_ma50"
        : "ma20_lt_ma50"
      : "unknown";

  const watchlistDiagnosticCategory = nearMissWatchlistDiagnosticLabel(
    terminalCategory,
    distanceToPullbackZoneFrac
  );

  const zoneLow = zoneFromEv?.low ?? ev.pullbackZoneLow;
  const zoneHigh = zoneFromEv?.high ?? ev.pullbackZoneHigh;

  return {
    symbol,
    terminalCategory,
    watchlistDiagnosticCategory,
    failedReasons: [...ev.reasons],
    close: ev.close,
    ma20,
    ma50,
    maRelationship,
    riskToStopFrac,
    distanceToPullbackZoneFrac,
    breakoutLevel: ev.breakoutLevel,
    pullbackZoneLow: zoneLow,
    pullbackZoneHigh: zoneHigh,
    stopLevel: ev.stopLevel,
    stageRank,
    rankScore: ev.rankScore,
  };
}

/**
 * INVALID Gate 2 evaluations for tradable actives, sorted by deepest pipeline stage first.
 */
export async function computeNearMissWatchlistFromDb(
  prisma: PrismaClient,
  limit: number
): Promise<{
  expectedLatestSession: Date;
  tradabilityPassedCount: number;
  rows: NearMissWatchlistRow[];
}> {
  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    throw new Error("No VNINDEX IndexDailyBar — cannot resolve session.");
  }

  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const tradable: { id: string; symbol: string }[] = [];
  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(
      prisma,
      s.id,
      expectedLatestSession
    );
    if (tr.passed) tradable.push({ id: s.id, symbol: s.symbol });
  }

  const diagnosticRows: Gate2DiagnosticEvaluationRow[] = [];
  const barsBySymbol = new Map<string, BarRow[]>();

  for (const t of tradable) {
    const rows = await prisma.stockDailyBar.findMany({
      where: { symbolId: t.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });
    barsBySymbol.set(t.symbol, rows);
    const ev = evaluateBreakoutPullbackCandidate(rows, expectedLatestSession);
    diagnosticRows.push({
      symbol: t.symbol,
      symbolId: t.id,
      evaluation: ev,
    });
  }

  const invalidRows = diagnosticRows.filter((r) => r.evaluation.quality === "INVALID");
  const invalidWithRank = invalidRows.map((r) => {
    const term = terminalGate2Reason(r.evaluation);
    const { stageRank } = categorizeTerminalReason(term);
    return { row: r, stageRank };
  });

  invalidWithRank.sort(
    (a, b) =>
      b.stageRank - a.stageRank ||
      a.row.symbol.localeCompare(b.row.symbol)
  );

  const capped = Math.max(0, Math.min(limit, 500));
  const rows = invalidWithRank.slice(0, capped).map(({ row }) =>
    invalidGate2EvaluationToWatchlistRow({
      symbol: row.symbol,
      ev: row.evaluation,
      bars: barsBySymbol.get(row.symbol) ?? [],
    })
  );

  return {
    expectedLatestSession,
    tradabilityPassedCount: tradable.length,
    rows,
  };
}
