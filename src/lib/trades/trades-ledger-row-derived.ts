import type { TradeStatus } from "@/generated/prisma/client";
import {
  computeOpenPhase2Metrics,
  computeDisplayHoldingDaysUtc,
  equityBarStaleVsBenchmark,
  type StopValidity,
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
  stopLoss: number | null;
  takeProfit: number | null;
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
  rMultiple: number | null;
  distanceToStop: number | null;
  distanceToTakeProfit: number | null;
  stopValidity: StopValidity;
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
    rMultiple: null,
    distanceToStop: null,
    distanceToTakeProfit: null,
    stopValidity: "missing",
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

    const phase2 =
      trade.status === "OPEN"
        ? computeOpenPhase2Metrics({
            direction: trade.direction,
            entryPrice: trade.entryPrice,
            latestClose: latestBar?.close ?? null,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
          })
        : {
            rMultiple: null,
            distanceToStop: null,
            distanceToTakeProfit: null,
            stopValidity: "missing" as const,
          };

    return {
      symKey,
      latestBar,
      unrealized,
      staleState,
      holdingDays,
      rMultiple: phase2.rMultiple,
      distanceToStop: phase2.distanceToStop,
      distanceToTakeProfit: phase2.distanceToTakeProfit,
      stopValidity: phase2.stopValidity,
    };
  } catch (err) {
    console.error("[trades] ledger row derivation failed", trade.id, err);
    return fallbackLedgerDerivedFields(trade);
  }
}
