import type { PrismaClient } from "@/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import {
  terminalGate2Reason,
  type Gate2DiagnosticEvaluationRow,
} from "@/lib/scanner/gate2-scan-diagnostics";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "@/lib/scanner/gate2/breakout-pullback";
import type { BreakoutPullbackEvaluation, Gate2Quality } from "@/lib/scanner/gate2/types";
import {
  invalidGate2EvaluationToWatchlistRow,
  type BarRow,
} from "@/lib/scanner/near-miss-watchlist";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolIdsBatched } from "@/lib/scanner/tradability";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { loadVnindexBarsForRs } from "./load-rs-diagnostics";
import {
  computeRelativeStrengthDiagnostic,
  RS_LOOKBACK_20,
  RS_LOOKBACK_50,
  type RelativeStrengthDiagnostic,
} from "./relative-strength";
import {
  resolveTerminalClassification,
  type Gate2RejectionCode,
} from "./rejection-codes";
import { formatRelativeStrengthDiagnosticForUi, type RsDiagnosticUi } from "./rs-diagnostic-format";
import {
  evaluateEarlyEntryForSymbol,
  isEarlyEntryV1Enabled,
  type EarlyEntryDisplayMetadata,
} from "@/lib/scanner/early-entry";

/** Primary UI title — diagnostic lane only. */
export const RS_NEAR_MISS_WATCHLIST_TITLE = "Danh sách theo dõi sức mạnh tương đối";

export const RS_NEAR_MISS_WATCHLIST_COPY = {
  diagnosticOnly: "Chỉ chẩn đoán",
  notSetupCandidate: "Không phải SetupCandidate Gate 2",
  notInTradingDecision: "Không dùng trong quyết định giao dịch hiện tại",
} as const;

export const RS_NEAR_MISS_WATCHLIST_DISCLAIMER = [
  RS_NEAR_MISS_WATCHLIST_TITLE,
  RS_NEAR_MISS_WATCHLIST_COPY.diagnosticOnly,
  RS_NEAR_MISS_WATCHLIST_COPY.notSetupCandidate,
  RS_NEAR_MISS_WATCHLIST_COPY.notInTradingDecision,
].join(" · ");

/**
 * Watchlist ranking (diagnostic only — does not use Gate 2 `rankScore`):
 * 1. RS20 spread descending (strongest vs VNINDEX first)
 * 2. stageRank descending (deepest pipeline progress among INVALID)
 * 3. distanceToPullbackZoneFrac ascending (closer to pullback zone first; missing → last)
 * 4. RS50 spread descending
 * 5. lastVolume descending (liquidity context)
 * 6. symbol ascending (stable tie-break)
 */
export const RS_NEAR_MISS_WATCHLIST_SORT_DOC =
  "RS20 desc → stageRank desc → distanceToZone asc → RS50 desc → volume desc → symbol asc";

/** INVALID terminal codes useful for RS leader monitoring (not a hard filter elsewhere). */
export const RS_NEAR_MISS_MONITOR_TERMINAL_CODES: readonly Gate2RejectionCode[] = [
  "breakout_recency",
  "pullback_zone_interaction",
  "volume_ratio",
  "trend_below_ma50",
] as const;

const MONITOR_CODE_SET = new Set<string>(RS_NEAR_MISS_MONITOR_TERMINAL_CODES);

export type RsNearMissWatchlistRow = {
  symbol: string;
  sessionDate: string;
  rs20SpreadPct: number;
  rs50SpreadPct: number | null;
  terminalCode: Gate2RejectionCode | null;
  terminalCategory: string;
  failedGate2Because: string;
  topRejectionReason: string;
  stageRank: number;
  distanceToPullbackZoneFrac: number | null;
  /** Gate 2 rankScore for reference only — not used for watchlist ordering. */
  rankScore: number;
  lastVolume: number | null;
  rsDiagnosticSummary: string;
};

export type RsNearMissWatchlistEntryDto = {
  symbol: string;
  sessionDate: string;
  rs20SpreadPct: number;
  rs50SpreadPct: number | null;
  terminalCode: string | null;
  failedGate2Because: string;
  topRejectionReason: string;
  stageRank: number;
  distanceToPullbackZoneFrac: number | null;
  /** Feeds the RS-scoring-v1 liquidity component (feature-flagged, display-only). */
  lastVolume?: number | null;
  rsDiagnostic: RsDiagnosticUi | null;
  disclaimerLines: readonly string[];
  actionHint: string;
  /** Display-only when EARLY_ENTRY_V1_ENABLED — does not affect Gate 2 or trade decisions. */
  earlyEntry?: EarlyEntryDisplayMetadata | null;
};

export type RsNearMissWatchlistPanelDto = {
  title: string;
  subtitle: string;
  disclaimerLines: readonly string[];
  actionHint: string;
  rows: RsNearMissWatchlistEntryDto[];
  emptyReason: string | null;
};

export function rsNearMissWatchlistActionHint(): string {
  return `${RS_NEAR_MISS_WATCHLIST_TITLE} — ${RS_NEAR_MISS_WATCHLIST_COPY.diagnosticOnly}. ${RS_NEAR_MISS_WATCHLIST_COPY.notSetupCandidate}. ${RS_NEAR_MISS_WATCHLIST_COPY.notInTradingDecision}.`;
}

export function formatRsNearMissFailedGate2Because(
  terminalCode: Gate2RejectionCode | null,
  terminalCategory: string
): string {
  const label = rejectionBucketLabel(terminalCategory);
  const codeSuffix = terminalCode ? ` (${terminalCode})` : "";
  return `Trượt Gate 2 vì: ${label}${codeSuffix}`;
}

export function rs20SpreadFromDiagnostic(
  rsDiagnostic: RelativeStrengthDiagnostic | null
): number | null {
  const r20 = rsDiagnostic?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_20);
  return r20?.rsSpreadPct ?? null;
}

export function rs50SpreadFromDiagnostic(
  rsDiagnostic: RelativeStrengthDiagnostic | null
): number | null {
  const r50 = rsDiagnostic?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_50);
  return r50?.rsSpreadPct ?? null;
}

function lastBarVolume(bars: readonly BarRow[]): number | null {
  const sorted = sortDedupeGate2Bars(bars);
  const last = sorted[sorted.length - 1];
  if (!last || !(last.volume > 0)) return null;
  return last.volume;
}

function sessionDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when RS20 is computable, positive, session-aligned, and terminal is in the monitor set. */
export function isRsNearMissWatchlistEligible(params: {
  symbol: string;
  ev: BreakoutPullbackEvaluation;
  rsDiagnostic: RelativeStrengthDiagnostic | null;
  excludeSymbols?: ReadonlySet<string>;
}): boolean {
  const { symbol, ev, rsDiagnostic, excludeSymbols } = params;
  if (ev.quality !== "INVALID") return false;
  if (excludeSymbols?.has(symbol)) return false;

  const { code, category } = resolveTerminalClassification({
    terminalCode: ev.terminalCode,
    terminalMessage: terminalGate2Reason(ev),
  });
  if (category === "stale_or_session_mismatch" || category === "insufficient_bars") {
    return false;
  }
  if (code == null || !MONITOR_CODE_SET.has(code)) return false;

  const rs20 = rs20SpreadFromDiagnostic(rsDiagnostic);
  if (rs20 == null || !Number.isFinite(rs20) || rs20 <= 0) return false;

  return true;
}

export function compareRsNearMissWatchlist(
  a: RsNearMissWatchlistRow,
  b: RsNearMissWatchlistRow
): number {
  if (b.rs20SpreadPct !== a.rs20SpreadPct) return b.rs20SpreadPct - a.rs20SpreadPct;
  if (b.stageRank !== a.stageRank) return b.stageRank - a.stageRank;

  const distA =
    a.distanceToPullbackZoneFrac != null && Number.isFinite(a.distanceToPullbackZoneFrac)
      ? a.distanceToPullbackZoneFrac
      : Number.POSITIVE_INFINITY;
  const distB =
    b.distanceToPullbackZoneFrac != null && Number.isFinite(b.distanceToPullbackZoneFrac)
      ? b.distanceToPullbackZoneFrac
      : Number.POSITIVE_INFINITY;
  if (distA !== distB) return distA - distB;

  const rs50a = a.rs50SpreadPct ?? Number.NEGATIVE_INFINITY;
  const rs50b = b.rs50SpreadPct ?? Number.NEGATIVE_INFINITY;
  if (rs50b !== rs50a) return rs50b - rs50a;

  const volA = a.lastVolume ?? 0;
  const volB = b.lastVolume ?? 0;
  if (volB !== volA) return volB - volA;

  return a.symbol.localeCompare(b.symbol);
}

export function sortRsNearMissWatchlist(
  rows: readonly RsNearMissWatchlistRow[]
): RsNearMissWatchlistRow[] {
  return [...rows].sort(compareRsNearMissWatchlist);
}

export function buildRsNearMissWatchlistRow(params: {
  symbol: string;
  sessionDate: Date;
  ev: BreakoutPullbackEvaluation;
  rsDiagnostic: RelativeStrengthDiagnostic;
  bars: readonly BarRow[];
}): RsNearMissWatchlistRow {
  const { symbol, sessionDate, ev, rsDiagnostic, bars } = params;
  const nearMiss = invalidGate2EvaluationToWatchlistRow({ symbol, ev, bars });
  const term = terminalGate2Reason(ev);
  const { code, category } = resolveTerminalClassification({
    terminalCode: ev.terminalCode,
    terminalMessage: term,
  });
  const rs20 = rs20SpreadFromDiagnostic(rsDiagnostic)!;
  const rs50 = rs50SpreadFromDiagnostic(rsDiagnostic);
  const topRejectionReason = ev.reasons[0] ?? term;

  return {
    symbol,
    sessionDate: sessionDateKey(sessionDate),
    rs20SpreadPct: Number(rs20.toFixed(4)),
    rs50SpreadPct: rs50 != null ? Number(rs50.toFixed(4)) : null,
    terminalCode: code,
    terminalCategory: category,
    failedGate2Because: formatRsNearMissFailedGate2Because(code, category),
    topRejectionReason,
    stageRank: nearMiss.stageRank,
    distanceToPullbackZoneFrac: nearMiss.distanceToPullbackZoneFrac,
    rankScore: ev.rankScore,
    lastVolume: lastBarVolume(bars),
    rsDiagnosticSummary: formatRelativeStrengthDiagnosticForUi(rsDiagnostic).summary,
  };
}

export function toRsNearMissWatchlistEntryDto(
  row: RsNearMissWatchlistRow,
  rsDiagnostic: RsDiagnosticUi | null,
  earlyEntry?: EarlyEntryDisplayMetadata | null
): RsNearMissWatchlistEntryDto {
  return {
    symbol: row.symbol,
    sessionDate: row.sessionDate,
    rs20SpreadPct: row.rs20SpreadPct,
    rs50SpreadPct: row.rs50SpreadPct,
    terminalCode: row.terminalCode,
    failedGate2Because: row.failedGate2Because,
    topRejectionReason: row.topRejectionReason,
    stageRank: row.stageRank,
    distanceToPullbackZoneFrac: row.distanceToPullbackZoneFrac,
    lastVolume: row.lastVolume,
    rsDiagnostic,
    disclaimerLines: [
      RS_NEAR_MISS_WATCHLIST_COPY.diagnosticOnly,
      RS_NEAR_MISS_WATCHLIST_COPY.notSetupCandidate,
      RS_NEAR_MISS_WATCHLIST_COPY.notInTradingDecision,
    ],
    actionHint: rsNearMissWatchlistActionHint(),
    earlyEntry: earlyEntry ?? undefined,
  };
}

export function buildRsNearMissWatchlistPanel(
  rows: readonly RsNearMissWatchlistRow[],
  rsUiBySymbol?: ReadonlyMap<string, RsDiagnosticUi | null>,
  earlyEntryBySymbol?: ReadonlyMap<string, EarlyEntryDisplayMetadata | null>
): RsNearMissWatchlistPanelDto {
  const sorted = sortRsNearMissWatchlist(rows);
  return {
    title: RS_NEAR_MISS_WATCHLIST_TITLE,
    subtitle:
      "Các mã INVALID ở Gate 2 có RS20 > 0 so với VNINDEX — mã dẫn đầu nhưng trượt các kiểm tra có thể theo dõi. Tách biệt với Hạng A/B.",
    disclaimerLines: [
      RS_NEAR_MISS_WATCHLIST_COPY.diagnosticOnly,
      RS_NEAR_MISS_WATCHLIST_COPY.notSetupCandidate,
      RS_NEAR_MISS_WATCHLIST_COPY.notInTradingDecision,
    ],
    actionHint: rsNearMissWatchlistActionHint(),
    rows: sorted.map((r) =>
      toRsNearMissWatchlistEntryDto(
        r,
        rsUiBySymbol?.get(r.symbol) ?? null,
        earlyEntryBySymbol?.get(r.symbol) ?? null
      )
    ),
    emptyReason:
      sorted.length === 0
        ? "Không có mã INVALID nào có RS20 dương và mã lý do thuộc diện theo dõi trong phiên này."
        : null,
  };
}

export function buildEarlyEntryMapForWatchlistRows(params: {
  rows: readonly RsNearMissWatchlistRow[];
  barsBySymbol: ReadonlyMap<string, readonly BarRow[]>;
  indexBars: readonly BarRow[];
  sessionDate: Date;
}): Map<string, EarlyEntryDisplayMetadata | null> {
  const out = new Map<string, EarlyEntryDisplayMetadata | null>();
  if (!isEarlyEntryV1Enabled()) return out;

  for (const row of params.rows) {
    const bars = params.barsBySymbol.get(row.symbol);
    if (!bars || bars.length < 50) {
      out.set(row.symbol, null);
      continue;
    }
    out.set(
      row.symbol,
      evaluateEarlyEntryForSymbol({
        symbol: row.symbol,
        stockBars: bars,
        indexBars: params.indexBars,
        sessionDate: params.sessionDate,
      })
    );
  }
  return out;
}

export type ComputeRsNearMissWatchlistOptions = {
  limit?: number;
  /** Tier A/B symbols to exclude (case-insensitive match on trimmed symbol). */
  excludeSymbols?: readonly string[];
};

/**
 * Read-only RS near-miss watchlist from DB — does not persist rows or alter Gate 2.
 */
export async function computeRsNearMissWatchlistFromDb(
  prisma: PrismaClient,
  options: ComputeRsNearMissWatchlistOptions = {}
): Promise<{
  expectedLatestSession: Date;
  tradabilityPassedCount: number;
  rows: RsNearMissWatchlistRow[];
  earlyEntryBySymbol?: Map<string, EarlyEntryDisplayMetadata | null>;
}> {
  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    throw new Error("No VNINDEX IndexDailyBar — cannot resolve session.");
  }

  const excludeSet = new Set(
    (options.excludeSymbols ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean)
  );
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

  const indexBars = await loadVnindexBarsForRs(prisma);
  if (indexBars.length < 50) {
    return { expectedLatestSession, tradabilityPassedCount: 0, rows: [] };
  }

  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  // One batched, bounded-lookback query for all active symbols' bars, evaluated
  // in-memory — replaces what was previously up to 2 DB round trips per symbol
  // (a tradability-only fetch, then a full-OHLCV fetch for eligible ones).
  const evaluated = await evaluateTradabilityForSymbolIdsBatched(
    prisma,
    symbols,
    expectedLatestSession
  );

  const tradable: { id: string; symbol: string }[] = [];
  for (const s of symbols) {
    if (evaluated.get(s.id)?.result.passed) tradable.push({ id: s.id, symbol: s.symbol });
  }

  const eligible: RsNearMissWatchlistRow[] = [];
  const barsBySymbol = new Map<string, BarRow[]>();

  for (const t of tradable) {
    if (excludeSet.has(t.symbol)) continue;

    const rows = evaluated.get(t.id)?.bars ?? [];

    const ev = evaluateBreakoutPullbackCandidate(rows, expectedLatestSession);
    const rsDiagnostic = computeRelativeStrengthDiagnostic(
      rows,
      indexBars,
      expectedLatestSession
    );

    if (
      !isRsNearMissWatchlistEligible({
        symbol: t.symbol,
        ev,
        rsDiagnostic,
        excludeSymbols: excludeSet,
      }) ||
      !rsDiagnostic
    ) {
      continue;
    }

    barsBySymbol.set(t.symbol, rows);
    eligible.push(
      buildRsNearMissWatchlistRow({
        symbol: t.symbol,
        sessionDate: expectedLatestSession,
        ev,
        rsDiagnostic,
        bars: rows,
      })
    );
  }

  const sortedRows = sortRsNearMissWatchlist(eligible).slice(0, limit);

  return {
    expectedLatestSession,
    tradabilityPassedCount: tradable.length,
    rows: sortedRows,
    earlyEntryBySymbol: isEarlyEntryV1Enabled()
      ? buildEarlyEntryMapForWatchlistRows({
          rows: sortedRows,
          barsBySymbol,
          indexBars,
          sessionDate: expectedLatestSession,
        })
      : undefined,
  };
}

/**
 * Cached wrapper around {@link computeRsNearMissWatchlistFromDb} using the shared prisma
 * singleton — shared by dashboard and setups so the full-market scan runs once, not twice.
 */
export async function getCachedRsNearMissWatchlist(
  options: ComputeRsNearMissWatchlistOptions = {}
): Promise<{
  expectedLatestSession: Date;
  tradabilityPassedCount: number;
  rows: RsNearMissWatchlistRow[];
  earlyEntryBySymbol?: Map<string, EarlyEntryDisplayMetadata | null>;
}> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  const { prisma } = await import("@/lib/prisma");
  return computeRsNearMissWatchlistFromDb(prisma, options);
}

/** Build watchlist rows from in-memory Gate 2 diagnostic rows (tests / replay). */
export function buildRsNearMissWatchlistFromEvaluations(params: {
  sessionDate: Date;
  evaluations: readonly Gate2DiagnosticEvaluationRow[];
  rsBySymbol: ReadonlyMap<string, RelativeStrengthDiagnostic | null>;
  barsBySymbol: ReadonlyMap<string, readonly BarRow[]>;
  excludeSymbols?: ReadonlySet<string>;
  limit?: number;
}): RsNearMissWatchlistRow[] {
  const rows: RsNearMissWatchlistRow[] = [];
  for (const { symbol, evaluation: ev } of params.evaluations) {
    const rsDiagnostic = params.rsBySymbol.get(symbol) ?? null;
    if (
      !isRsNearMissWatchlistEligible({
        symbol,
        ev,
        rsDiagnostic,
        excludeSymbols: params.excludeSymbols,
      }) ||
      !rsDiagnostic
    ) {
      continue;
    }
    rows.push(
      buildRsNearMissWatchlistRow({
        symbol,
        sessionDate: params.sessionDate,
        ev,
        rsDiagnostic,
        bars: params.barsBySymbol.get(symbol) ?? [],
      })
    );
  }
  const limit = params.limit ?? 100;
  return sortRsNearMissWatchlist(rows).slice(0, limit);
}

/** Gate 2 qualities that must never appear on the RS watchlist. */
export function isTierQuality(quality: Gate2Quality): boolean {
  return quality === "A" || quality === "B";
}
