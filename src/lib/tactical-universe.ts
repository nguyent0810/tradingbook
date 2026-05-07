import type { Prisma, PrismaClient, TacticalSymbolStatus } from "@/generated/prisma/client";

export const TACTICAL_ACTIVE_STATUS: TacticalSymbolStatus = "ACTIVE";

/**
 * Write-boundary normalization for tactical intake symbols.
 * Storage and query paths assume uppercase tickers without surrounding whitespace.
 */
export function normalizeTacticalSymbolInput(rawSymbol: string): string {
  const normalized = rawSymbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Tactical symbol is required.");
  }
  return normalized;
}

export function isTacticalSymbolActiveNow(
  row: {
    status: TacticalSymbolStatus;
    activeForScanner: boolean;
    expiresAt: Date;
  },
  now: Date = new Date()
): boolean {
  return (
    row.status === TACTICAL_ACTIVE_STATUS &&
    row.activeForScanner &&
    row.expiresAt.getTime() > now.getTime()
  );
}

export function buildActiveTacticalSymbolWhere(
  now: Date = new Date()
): Prisma.TacticalSymbolWhereInput {
  return {
    status: TACTICAL_ACTIVE_STATUS,
    activeForScanner: true,
    expiresAt: { gt: now },
  };
}

export type ActiveTacticalSymbolRow = {
  id: string;
  symbol: string;
  source: string;
  expiresAt: Date;
  status: TacticalSymbolStatus;
  activeForScanner: boolean;
};

export type UniverseSource = "CORE" | "TACTICAL" | "BOTH";

export type UniverseSymbolRow = {
  symbolId: string;
  symbol: string;
  universeSource: UniverseSource;
};

export type EffectiveUniverseStats = {
  coreCount: number;
  tacticalCount: number;
  overlapCount: number;
  effectiveCount: number;
  tacticalMissingStockSymbolCount: number;
};

type CoreStockRowInput = {
  id: string;
  symbol: string;
};

type TacticalStockMatchInput = {
  tacticalId: string;
  tacticalSymbol: string;
  stockSymbolId: string | null;
};

/**
 * Dormant read path: active tactical rows only.
 * Intentionally not merged into scanner runtime in this slice.
 */
export async function listActiveTacticalSymbols(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<ActiveTacticalSymbolRow[]> {
  return prisma.tacticalSymbol.findMany({
    where: buildActiveTacticalSymbolWhere(now),
    orderBy: [{ expiresAt: "asc" }, { symbol: "asc" }],
    select: {
      id: true,
      symbol: true,
      source: true,
      expiresAt: true,
      status: true,
      activeForScanner: true,
    },
  });
}

export function computeEffectiveScanUniverse(params: {
  coreRows: ReadonlyArray<CoreStockRowInput>;
  tacticalRows: ReadonlyArray<TacticalStockMatchInput>;
}): {
  symbols: UniverseSymbolRow[];
  stats: EffectiveUniverseStats;
  includedTacticalIds: string[];
} {
  const { coreRows, tacticalRows } = params;
  const bySymbol = new Map<string, UniverseSymbolRow>();
  const includedTacticalIds = new Set<string>();

  for (const row of coreRows) {
    const symbol = normalizeTacticalSymbolInput(row.symbol);
    bySymbol.set(symbol, {
      symbolId: row.id,
      symbol,
      universeSource: "CORE",
    });
  }

  let overlapCount = 0;
  let tacticalMissingStockSymbolCount = 0;
  for (const t of tacticalRows) {
    const tacticalSymbol = normalizeTacticalSymbolInput(t.tacticalSymbol);
    if (!t.stockSymbolId) {
      tacticalMissingStockSymbolCount++;
      continue;
    }
    const existing = bySymbol.get(tacticalSymbol);
    if (existing) {
      if (existing.universeSource !== "BOTH") {
        existing.universeSource = "BOTH";
        overlapCount++;
      }
    } else {
      bySymbol.set(tacticalSymbol, {
        symbolId: t.stockSymbolId,
        symbol: tacticalSymbol,
        universeSource: "TACTICAL",
      });
    }
    includedTacticalIds.add(t.tacticalId);
  }

  const symbols = [...bySymbol.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  return {
    symbols,
    stats: {
      coreCount: coreRows.length,
      tacticalCount: tacticalRows.length,
      overlapCount,
      effectiveCount: symbols.length,
      tacticalMissingStockSymbolCount,
    },
    includedTacticalIds: [...includedTacticalIds],
  };
}
