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
