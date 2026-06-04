import type { PrismaClient } from "@/generated/prisma/client";
import { isoDayUtc, parseSessionDateUtc } from "@/lib/market/session-date";
import type {
  MarketContextUiDto,
  SymbolContextUiDto,
} from "@/lib/market/market-context-ui-dto";

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
}): SymbolContextUiDto {
  return {
    foreignNetValue1d: row.foreignNetValue1d,
    foreignNetValue5d: row.foreignNetValue5d,
    foreignNetValue10d: row.foreignNetValue10d,
    foreignDataQuality: row.foreignDataQuality,
    volRatioMa20: row.volRatioMa20,
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
