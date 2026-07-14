import type { PrismaClient } from "@/generated/prisma/client";
import { isoDayUtc, parseSessionDateUtc } from "@/lib/market/session-date";
import type {
  MarketContextUiDto,
  SymbolContextUiDto,
} from "@/lib/market/market-context-ui-dto";
import {
  computeRollingForeignFlowDangerVnd,
  FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS,
} from "@/lib/dashboard/foreign-flow-evidence";

export type FetchMarketContextUiOptions = {
  /** Uppercase symbol keys — when omitted, symbol map is empty. */
  symbols?: readonly string[];
};

function emptyContext(sessionDate: string): MarketContextUiDto {
  return {
    sessionDate,
    available: false,
    market: null,
    bySymbol: {},
  };
}

function toSymbolContextUi(row: {
  foreignNetValue1d: number | null;
  foreignNetValue5d: number | null;
  foreignNetValue10d: number | null;
  foreignDataQuality: SymbolContextUiDto["foreignDataQuality"];
  volRatioMa20: number | null;
  volMa20: number | null;
}): SymbolContextUiDto {
  return {
    foreignNetValue1d: row.foreignNetValue1d,
    foreignNetValue5d: row.foreignNetValue5d,
    foreignNetValue10d: row.foreignNetValue10d,
    foreignDataQuality: row.foreignDataQuality,
    volRatioMa20: row.volRatioMa20,
    volMa20: row.volMa20,
  };
}

/**
 * Loads market + optional per-symbol context for a VNINDEX session (read-only).
 * Fail-soft: returns `available: false` when no row or on query error.
 */
export async function fetchMarketContextUi(
  prisma: PrismaClient,
  sessionDateInput: string | Date | null | undefined,
  options?: FetchMarketContextUiOptions
): Promise<MarketContextUiDto> {
  const sessionDate =
    sessionDateInput instanceof Date
      ? isoDayUtc(sessionDateInput)
      : sessionDateInput?.trim() ?? null;

  if (!sessionDate) return emptyContext("");

  try {
    const session = parseSessionDateUtc(sessionDate);
    const marketRow = await prisma.marketContextDaily.findUnique({
      where: { sessionDate: session },
    });

    if (!marketRow) {
      return emptyContext(sessionDate);
    }

    // Rolling relative danger thresholds — prior sessions only (strictly before
    // today), so today's own value can't dilute the threshold it's compared
    // against. Read-only historical query against the existing table; no
    // schema change needed, all three columns already exist per session.
    // Computed separately per window (1D/5D/10D) so a 5-day SUM is never
    // compared against a 1-day rolling percentile (unit mismatch).
    const priorRows = await prisma.marketContextDaily.findMany({
      where: { sessionDate: { lt: session } },
      orderBy: { sessionDate: "desc" },
      take: FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS,
      select: { foreignNetValue1d: true, foreignNetValue5d: true, foreignNetValue10d: true },
    });
    const toAscNonNull = (values: (number | null)[]) =>
      values.filter((v): v is number => v != null).reverse();
    const foreignFlowRollingDangerVnd = computeRollingForeignFlowDangerVnd(
      toAscNonNull(priorRows.map((r) => r.foreignNetValue1d))
    );
    const foreignFlowRolling5dDangerVnd = computeRollingForeignFlowDangerVnd(
      toAscNonNull(priorRows.map((r) => r.foreignNetValue5d))
    );
    const foreignFlowRolling10dDangerVnd = computeRollingForeignFlowDangerVnd(
      toAscNonNull(priorRows.map((r) => r.foreignNetValue10d))
    );

    const symbolKeys = [
      ...new Set(
        (options?.symbols ?? [])
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      ),
    ];

    const bySymbol: Record<string, SymbolContextUiDto> = {};

    if (symbolKeys.length > 0) {
      const symbolRows = await prisma.symbolMarketContextDaily.findMany({
        where: {
          sessionDate: session,
          symbol: { symbol: { in: symbolKeys } },
        },
        select: {
          foreignNetValue1d: true,
          foreignNetValue5d: true,
          foreignNetValue10d: true,
          foreignDataQuality: true,
          volRatioMa20: true,
          volMa20: true,
          symbol: { select: { symbol: true } },
        },
      });

      for (const row of symbolRows) {
        bySymbol[row.symbol.symbol.toUpperCase()] = toSymbolContextUi(row);
      }
    }

    return {
      sessionDate,
      available: true,
      market: {
        foreignNetValue1d: marketRow.foreignNetValue1d,
        foreignNetValue5d: marketRow.foreignNetValue5d,
        foreignNetValue10d: marketRow.foreignNetValue10d,
        foreignSymbolsOk: marketRow.foreignSymbolsOk,
        foreignSymbolsTotal: marketRow.foreignSymbolsTotal,
        foreignCoveragePct: marketRow.foreignCoveragePct,
        foreignFlowRollingDangerVnd,
        foreignFlowRolling5dDangerVnd,
        foreignFlowRolling10dDangerVnd,
        gate1Level: marketRow.gate1Level,
        vnindexVolRatioMa20: marketRow.vnindexVolRatioMa20,
      },
      bySymbol,
    };
  } catch (error) {
    console.error("[fetchMarketContextUi] query failed:", error);
    return emptyContext(sessionDate);
  }
}
