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
    // Both bounds, not just the upper one. `expiresAt > now` alone is satisfied
    // by a row added long AFTER `now` — harmless when `now` is the wall clock,
    // but a point-in-time replay passes a historical `now`, and a tactical symbol
    // added in 2026 would then leak into a 2024 session it was never part of.
    addedAt: { lte: now },
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

export type EffectiveUniverseSymbol = {
  symbol: string;
  source: "core" | "tactical" | "both";
  stockSymbolId?: string;
  tacticalId?: string;
  reason?: string | null;
  expiresAt?: Date | null;
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

/** Active tactical rows eligible for effective universe merge. */
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

export function toEffectiveUniverseSymbols(params: {
  symbols: ReadonlyArray<UniverseSymbolRow>;
  tacticalRows?: ReadonlyArray<Pick<ActiveTacticalSymbolRow, "id" | "symbol" | "expiresAt">>;
}): EffectiveUniverseSymbol[] {
  const tacticalRows = params.tacticalRows ?? [];
  const tacticalBySymbol = new Map<string, Pick<ActiveTacticalSymbolRow, "id" | "symbol" | "expiresAt">>();
  for (const row of tacticalRows) {
    const key = normalizeTacticalSymbolInput(row.symbol);
    if (!tacticalBySymbol.has(key)) tacticalBySymbol.set(key, row);
  }

  return params.symbols.map((row) => {
    const tactical = tacticalBySymbol.get(row.symbol);
    const source =
      row.universeSource === "CORE"
        ? "core"
        : row.universeSource === "TACTICAL"
          ? "tactical"
          : "both";
    return {
      symbol: row.symbol,
      source,
      stockSymbolId: row.symbolId,
      tacticalId: tactical?.id,
      reason: null,
      expiresAt: tactical?.expiresAt ?? null,
    };
  });
}

export async function loadEffectiveScanUniverse(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<{
  symbols: UniverseSymbolRow[];
  effectiveSymbols: EffectiveUniverseSymbol[];
  stats: EffectiveUniverseStats;
  includedTacticalIds: string[];
  tacticalRows: ActiveTacticalSymbolRow[];
}> {
  const coreRows = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  const tacticalRows = await listActiveTacticalSymbols(prisma, now);
  const tacticalKeys = [...new Set(tacticalRows.map((t) => t.symbol.trim().toUpperCase()))];
  const tacticalStockRows =
    tacticalKeys.length === 0
      ? []
      : await prisma.stockSymbol.findMany({
          where: { symbol: { in: tacticalKeys } },
          select: { id: true, symbol: true },
        });
  const stockIdBySymbol = new Map(
    tacticalStockRows.map((s) => [s.symbol.trim().toUpperCase(), s.id] as const)
  );
  const tacticalMatches = tacticalRows.map((t) => ({
    tacticalId: t.id,
    tacticalSymbol: t.symbol,
    stockSymbolId: stockIdBySymbol.get(t.symbol.trim().toUpperCase()) ?? null,
  }));

  const merged = computeEffectiveScanUniverse({
    coreRows,
    tacticalRows: tacticalMatches,
  });

  return {
    symbols: merged.symbols,
    effectiveSymbols: toEffectiveUniverseSymbols({
      symbols: merged.symbols,
      tacticalRows,
    }),
    stats: merged.stats,
    includedTacticalIds: merged.includedTacticalIds,
    tacticalRows,
  };
}
