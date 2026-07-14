/**
 * Portfolio-level guardrails — practical, schema-supportable safety defaults.
 *
 * Product decision (2026-07, Workstream D): "Không cần xây mô hình correlation quá
 * phức tạp; ưu tiên implementation thực dụng, có default an toàn" — no need for a
 * complex correlation model; prioritize a practical implementation with safe defaults.
 *
 * Pure function — no Prisma import here. Callers (e.g. `dashboard/page.tsx`) fetch
 * `Trade` rows and project them into `PortfolioGuardrailTrade` before calling
 * `computePortfolioGuardrails`.
 *
 * NOT implemented — sector concentration / cross-position correlation:
 * The `Trade` and `StockSymbol` Prisma models (prisma/schema.prisma) have no
 * sector/industry classification field, and there is no correlation data source
 * wired into this app. Implementing either would require a new data provider
 * integration or a hand-maintained symbol→sector mapping table — out of scope for
 * this batch, and explicitly not something we fabricate (no hardcoded symbol→sector
 * maps, no guessing from symbol name patterns). The three guardrails below (max
 * concurrent positions, portfolio heat, duplicate-symbol exposure) are the safe-default
 * substitute per product decision, not a stand-in that pretends to cover concentration.
 */

/**
 * Default cap on concurrent OPEN positions for a manually-managed swing book.
 *
 * Rationale: a common practical diversification ceiling for this trading style —
 * NOT an empirically-derived optimum for this account. Treat as a reasonable,
 * conservative starting default that a trader can override once they have their
 * own capacity data.
 */
export const DEFAULT_MAX_CONCURRENT_POSITIONS = 8;

/**
 * Threshold (as a fraction of account equity) above which aggregate portfolio
 * "risk-to-stop" (portfolio heat) is flagged as elevated.
 *
 * Rationale: a common convention is capping total open risk at roughly 2x a
 * typical single-trade risk budget (~1-1.5% of equity) across a handful of
 * concurrent positions, i.e. ~5-8% of equity. 0.06 (6%) is a reasonable
 * convention default — NOT backtested against this account's actual outcomes.
 */
export const PORTFOLIO_HEAT_ELEVATED_PCT_OF_EQUITY = 0.06;

/**
 * Fraction of OPEN trades that must have an unknown or invalid stop before the
 * portfolio-heat figure is treated as untrustworthy for display purposes, not just
 * "partial".
 *
 * Rationale: `portfolioHeatVnd` only sums trades with a known, valid stop — by
 * design (fail-closed: unknown risk is excluded, never treated as zero). But that
 * means a book of e.g. 5 open trades where 4 have no stop and 1 has a small known
 * stop-risk reports a small, technically-correct heat number with no elevated
 * signal — which reads as "portfolio heat is low" when in fact most of the book's
 * risk is completely untracked. 50% is picked as a simple, conservative majority
 * threshold: once half or more of open positions have no reliable stop-risk input,
 * the aggregate number is more "mostly unknown" than "low", and the UI must say so
 * as prominently as an elevated-heat warning rather than only via the footnote
 * `statusCopy` line.
 */
export const PORTFOLIO_HEAT_UNKNOWN_MAJORITY_THRESHOLD = 0.5;

/** Minimal trade projection needed for portfolio guardrail computations. */
export type PortfolioGuardrailTrade = {
  status: "PLANNED" | "OPEN" | "CLOSED" | "CANCELLED";
  symbol: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
};

export type MaxConcurrentPositionsGuardrailDto = {
  count: number;
  limit: number;
  atOrOverLimit: boolean;
};

export type PortfolioHeatGuardrailDto = {
  /** Sum of (entryPrice - stopLoss) * quantity across OPEN trades with a valid stop. */
  portfolioHeatVnd: number;
  /** True when one or more OPEN trades were excluded from the sum above (unknown or invalid stop). */
  isPartial: boolean;
  /** OPEN trades with no stopLoss set — excluded from the sum, NOT treated as zero risk (fail-closed). */
  unknownStopRiskTradeCount: number;
  unknownStopRiskSymbols: string[];
  /** OPEN trades where stopLoss >= entryPrice — a data-quality issue for a long; excluded from the sum. */
  invalidStopTradeCount: number;
  invalidStopSymbols: string[];
  /** Trader-facing explanation of what the sum does and does not cover. */
  statusCopy: string;
  /** portfolioHeatVnd as a fraction of accountEquityVnd, or null when equity isn't configured. */
  portfolioHeatPctOfEquity: number | null;
  /** True when portfolioHeatPctOfEquity >= PORTFOLIO_HEAT_ELEVATED_PCT_OF_EQUITY. */
  isElevated: boolean;
  /**
   * "mostly_unknown" when (unknownStopRiskTradeCount + invalidStopTradeCount) /
   * openTradeCount >= PORTFOLIO_HEAT_UNKNOWN_MAJORITY_THRESHOLD — i.e. most open
   * trades have no reliable stop-risk input, so `portfolioHeatVnd` (however small)
   * must not be read as a trustworthy "total risk is low" signal. Fail-closed
   * distinct from `isElevated`: a small tracked heat number with mostly-unknown
   * data quality is NOT the same as a genuinely low-risk book.
   */
  dataQuality: "reliable" | "mostly_unknown";
};

export type DuplicateSymbolExposureEntry = {
  symbol: string;
  plannedCount: number;
  openCount: number;
  /** Sum of entryPrice * quantity across all PLANNED + OPEN rows for this symbol. */
  combinedNotionalVnd: number;
};

export type PortfolioGuardrailsDto = {
  maxConcurrentPositions: MaxConcurrentPositionsGuardrailDto;
  portfolioHeat: PortfolioHeatGuardrailDto;
  /** Symbols with more than one non-terminal (PLANNED or OPEN) trade row — surfaced, never auto-merged. */
  duplicateSymbolExposure: DuplicateSymbolExposureEntry[];
};

function buildPortfolioHeatStatusCopy(
  unknownStopRiskTradeCount: number,
  invalidStopTradeCount: number
): string {
  if (unknownStopRiskTradeCount > 0 && invalidStopTradeCount > 0) {
    return (
      `Partial figure: ${unknownStopRiskTradeCount} open trade(s) have no stop loss set and ` +
      `${invalidStopTradeCount} have a stop at or above entry (data-quality issue) — both are ` +
      `excluded from this sum, so total risk-to-stop is understated.`
    );
  }
  if (unknownStopRiskTradeCount > 0) {
    return (
      `Partial figure: ${unknownStopRiskTradeCount} open trade(s) have no stop loss set — ` +
      `excluded from this sum (not treated as zero risk), so total risk-to-stop is understated.`
    );
  }
  if (invalidStopTradeCount > 0) {
    return (
      `Partial figure: ${invalidStopTradeCount} open trade(s) have a stop loss at or above entry ` +
      `price (data-quality issue for a long) — excluded from this sum.`
    );
  }
  return "Portfolio heat reflects every open trade — all have a valid stop loss below entry.";
}

function computeMaxConcurrentPositions(
  openTrades: PortfolioGuardrailTrade[]
): MaxConcurrentPositionsGuardrailDto {
  const count = openTrades.length;
  const limit = DEFAULT_MAX_CONCURRENT_POSITIONS;
  return { count, limit, atOrOverLimit: count >= limit };
}

function computePortfolioHeat(
  openTrades: PortfolioGuardrailTrade[],
  accountEquityVnd: number | null
): PortfolioHeatGuardrailDto {
  let portfolioHeatVnd = 0;
  const unknownStopRiskSymbols: string[] = [];
  const invalidStopSymbols: string[] = [];

  for (const t of openTrades) {
    if (t.stopLoss == null) {
      unknownStopRiskSymbols.push(t.symbol);
      continue;
    }
    if (t.stopLoss >= t.entryPrice) {
      // Stop at/above entry is nonsensical for a long — data-quality issue, not "zero risk".
      invalidStopSymbols.push(t.symbol);
      continue;
    }
    portfolioHeatVnd += (t.entryPrice - t.stopLoss) * t.quantity;
  }

  const unknownStopRiskTradeCount = unknownStopRiskSymbols.length;
  const invalidStopTradeCount = invalidStopSymbols.length;
  const isPartial = unknownStopRiskTradeCount > 0 || invalidStopTradeCount > 0;

  const portfolioHeatPctOfEquity =
    accountEquityVnd != null && accountEquityVnd > 0
      ? portfolioHeatVnd / accountEquityVnd
      : null;
  const isElevated =
    portfolioHeatPctOfEquity != null &&
    portfolioHeatPctOfEquity >= PORTFOLIO_HEAT_ELEVATED_PCT_OF_EQUITY;

  const untrustedTradeCount = unknownStopRiskTradeCount + invalidStopTradeCount;
  const dataQuality: "reliable" | "mostly_unknown" =
    openTrades.length > 0 &&
    untrustedTradeCount / openTrades.length >= PORTFOLIO_HEAT_UNKNOWN_MAJORITY_THRESHOLD
      ? "mostly_unknown"
      : "reliable";

  return {
    portfolioHeatVnd,
    isPartial,
    unknownStopRiskTradeCount,
    unknownStopRiskSymbols,
    invalidStopTradeCount,
    invalidStopSymbols,
    statusCopy: buildPortfolioHeatStatusCopy(unknownStopRiskTradeCount, invalidStopTradeCount),
    portfolioHeatPctOfEquity,
    isElevated,
    dataQuality,
  };
}

function computeDuplicateSymbolExposure(
  trades: PortfolioGuardrailTrade[]
): DuplicateSymbolExposureEntry[] {
  const bySymbol = new Map<
    string,
    { plannedCount: number; openCount: number; combinedNotionalVnd: number }
  >();

  for (const t of trades) {
    if (t.status !== "PLANNED" && t.status !== "OPEN") continue;
    const existing = bySymbol.get(t.symbol) ?? {
      plannedCount: 0,
      openCount: 0,
      combinedNotionalVnd: 0,
    };
    if (t.status === "PLANNED") existing.plannedCount += 1;
    else existing.openCount += 1;
    existing.combinedNotionalVnd += t.entryPrice * t.quantity;
    bySymbol.set(t.symbol, existing);
  }

  return [...bySymbol.entries()]
    .filter(([, g]) => g.plannedCount + g.openCount > 1)
    .map(([symbol, g]) => ({ symbol, ...g }))
    .sort((a, b) => b.combinedNotionalVnd - a.combinedNotionalVnd);
}

/**
 * Pure computation of portfolio-level guardrails from already-loaded trade rows.
 * Does not query Prisma and does not mutate/dedupe input — detection only.
 */
export function computePortfolioGuardrails(params: {
  trades: PortfolioGuardrailTrade[];
  accountEquityVnd: number | null;
}): PortfolioGuardrailsDto {
  const { trades, accountEquityVnd } = params;
  const openTrades = trades.filter((t) => t.status === "OPEN");

  return {
    maxConcurrentPositions: computeMaxConcurrentPositions(openTrades),
    portfolioHeat: computePortfolioHeat(openTrades, accountEquityVnd),
    duplicateSymbolExposure: computeDuplicateSymbolExposure(trades),
  };
}
