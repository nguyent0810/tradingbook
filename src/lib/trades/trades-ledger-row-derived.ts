import type { TradeStatus } from "@/generated/prisma/client";
import {
  computeDisplayHoldingDaysUtc,
  equityBarStaleVsBenchmark,
} from "@/lib/trades/position-health";
import {
  computeUnrealizedFromLatestClose,
  type LatestCloseBar,
} from "@/lib/trades/unrealized-from-close";

export type LedgerTradeShape = {
  id: string;
  symbol: string;
  status: TradeStatus;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  entryDate: Date;
  exitDate: Date | null;
};

export type TradesLedgerSupplemental = {
  latestCloseBySymbol: Map<string, LatestCloseBar>;
  expectedSessionDate: Date | null;
  checkedTodayTradeIds: ReadonlySet<string>;
  now: Date;
};

export type TradesLedgerDerivedFields = {
  symKey: string;
  latestBar: LatestCloseBar | null;
  unrealized: ReturnType<typeof computeUnrealizedFromLatestClose> | null;
  staleState: boolean | "unknown" | null;
  holdingDays: number | null;
};

/** Fallback when derivation fails — still renders a table row. */
export function fallbackLedgerDerivedFields(
  trade: Pick<LedgerTradeShape, "symbol">
): TradesLedgerDerivedFields {
  let symKey = "";
  try {
    symKey = trade.symbol.trim().toUpperCase();
  } catch {
    symKey = "";
  }
  return {
    symKey,
    latestBar: null,
    unrealized: null,
    staleState: null,
    holdingDays: null,
  };
}

/**
 * Pure row helpers for `/trades`. Wrapped so optional maps / dates never prevent rendering.
 */
export function deriveTradesLedgerRowFields(
  trade: LedgerTradeShape,
  supplemental: TradesLedgerSupplemental
): TradesLedgerDerivedFields {
  try {
    const symKey = trade.symbol.trim().toUpperCase();
    const latestBar =
      trade.status === "OPEN"
        ? supplemental.latestCloseBySymbol.get(symKey) ?? null
        : null;

    const unrealized =
      latestBar != null
        ? computeUnrealizedFromLatestClose({
            direction: trade.direction,
            entryPrice: trade.entryPrice,
            quantity: trade.quantity,
            latestClose: latestBar.close,
          })
        : null;

    const staleState =
      trade.status === "OPEN" && latestBar != null
        ? equityBarStaleVsBenchmark(
            latestBar.date,
            supplemental.expectedSessionDate
          )
        : null;

    const holdingDays =
      trade.status === "CANCELLED"
        ? null
        : computeDisplayHoldingDaysUtc({
            status: trade.status,
            entryDate: trade.entryDate,
            exitDate: trade.exitDate,
            now: supplemental.now,
          });

    return {
      symKey,
      latestBar,
      unrealized,
      staleState,
      holdingDays,
    };
  } catch (err) {
    console.error("[trades] ledger row derivation failed", trade.id, err);
    return fallbackLedgerDerivedFields(trade);
  }
}
