import type { ForeignDataQuality, Gate1ScanLevel } from "@/generated/prisma/client";

export type SymbolContextUiDto = {
  foreignNetValue1d: number | null;
  foreignNetValue5d: number | null;
  foreignNetValue10d: number | null;
  foreignDataQuality: ForeignDataQuality | null;
  volRatioMa20: number | null;
};

export type MarketContextMarketUiDto = {
  foreignNetValue1d: number | null;
  foreignNetValue5d: number | null;
  foreignNetValue10d: number | null;
  foreignSymbolsOk: number;
  foreignSymbolsTotal: number;
  foreignCoveragePct: number | null;
  gate1Level: Gate1ScanLevel | null;
  vnindexVolRatioMa20: number | null;
};

/** Read-only UI contract for market context (no Prisma in components). */
export type MarketContextUiDto = {
  /** VNINDEX session (UTC calendar day YYYY-MM-DD). */
  sessionDate: string;
  /** True when a market_context_daily row exists for the session. */
  available: boolean;
  market: MarketContextMarketUiDto | null;
  /** Uppercase symbol key → per-symbol context. */
  bySymbol: Record<string, SymbolContextUiDto>;
};
