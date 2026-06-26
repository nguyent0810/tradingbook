import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import {
  PAPER_MAX_NEW_POSITIONS_PER_DAY,
  PAPER_MAX_PER_TRADE_EXPOSURE_PCT,
  PAPER_MAX_PORTFOLIO_EXPOSURE_PCT,
  PAPER_VN_LIMIT_BAND_PCT,
} from "@/lib/paper-lab/constants";
import {
  computeNotionalVnd,
  computeRiskAtStopVnd,
  isWithinLimitBand,
  kvndToVnd,
} from "@/lib/paper-lab/engine/units";
import { VN_BOARD_LOT_SHARES } from "@/lib/paper-lab/engine/board-lot";

export type OrderValidationContext = {
  navVnd: number;
  cashVnd: number;
  currentExposureVnd: number;
  openPositionCount: number;
  newPositionsToday: number;
  hasOpenPositionOnSymbol: boolean;
  tradable: boolean;
  prevCloseKVnd: number | null;
  sessionCloseKVnd: number;
};

export type OrderValidationResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export function validateAgentDecisionForExecution(
  decision: AgentDecisionOutput,
  ctx: OrderValidationContext
): OrderValidationResult {
  const reasons: string[] = [];

  if (["HOLD"].includes(decision.action)) {
    return { ok: false, reasons: ["HOLD does not create orders"] };
  }

  if (!ctx.tradable && ["BUY", "ADD"].includes(decision.action)) {
    reasons.push("Symbol fails tradability");
  }

  if (decision.action === "BUY" && ctx.hasOpenPositionOnSymbol) {
    reasons.push("Duplicate BUY — open position exists; use ADD");
  }

  if (decision.action === "BUY" && ctx.newPositionsToday >= PAPER_MAX_NEW_POSITIONS_PER_DAY) {
    reasons.push("Max new positions per day exceeded");
  }

  if (["BUY", "ADD"].includes(decision.action)) {
    const entry = decision.entry_price;
    const stop = decision.stop_loss;
    const tp = decision.take_profit;
    const qty = decision.quantity;

    if (entry == null || stop == null || tp == null || qty == null) {
      reasons.push("Missing required BUY fields");
    } else {
      if (!(entry > stop)) reasons.push("Stop must be below entry for LONG");
      if (!(tp > entry)) reasons.push("Take profit must be above entry for LONG");

      if (qty % VN_BOARD_LOT_SHARES !== 0) {
        reasons.push("Quantity must be a multiple of 100 shares (board lot)");
      }
      if (qty < VN_BOARD_LOT_SHARES) {
        reasons.push(`Quantity below minimum board lot (${VN_BOARD_LOT_SHARES} shares)`);
      }

      const notional = computeNotionalVnd(entry, qty);
      const maxTrade = ctx.navVnd * PAPER_MAX_PER_TRADE_EXPOSURE_PCT;
      if (notional > maxTrade * 1.05) {
        reasons.push("Position size exceeds max per-trade exposure");
      }

      const afterExposure = ctx.currentExposureVnd + notional;
      if (afterExposure > ctx.navVnd * PAPER_MAX_PORTFOLIO_EXPOSURE_PCT * 1.05) {
        reasons.push("Portfolio exposure limit exceeded");
      }

      if (notional > ctx.cashVnd) {
        reasons.push("Insufficient cash");
      }

      if (ctx.prevCloseKVnd != null && !isWithinLimitBand(entry, ctx.prevCloseKVnd, PAPER_VN_LIMIT_BAND_PCT)) {
        reasons.push("Entry price outside VN limit band");
      }

      const priceDelta = Math.abs(entry - ctx.sessionCloseKVnd) / ctx.sessionCloseKVnd;
      if (priceDelta > 0.15) {
        reasons.push("Entry price outlier vs session close (>15%)");
      }

      if (decision.risk_amount_vnd != null) {
        const expected = computeRiskAtStopVnd(entry, stop, qty);
        const tolerance = expected * 0.05 + 1;
        if (Math.abs(decision.risk_amount_vnd - expected) > tolerance) {
          reasons.push("Risk amount mismatch vs entry/stop/qty");
        }
      }
    }
  }

  if (decision.action === "EXIT" && !ctx.hasOpenPositionOnSymbol) {
    reasons.push("EXIT with no open position");
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true };
}

export function simulateFeeVnd(notionalVnd: number, feeBps: number): number {
  return Math.round((notionalVnd * feeBps) / 10_000);
}

export function resolveFillPriceKVnd(params: {
  orderPriceKVnd: number;
  barLowKVnd: number;
  barHighKVnd: number;
  barCloseKVnd: number;
}): { fillKVnd: number; slippageApplied: boolean } {
  const { orderPriceKVnd, barLowKVnd, barHighKVnd, barCloseKVnd } = params;
  if (orderPriceKVnd >= barLowKVnd && orderPriceKVnd <= barHighKVnd) {
    return { fillKVnd: orderPriceKVnd, slippageApplied: false };
  }
  return { fillKVnd: barCloseKVnd, slippageApplied: true };
}

export function detectLongExitOnBar(params: {
  stopKVnd: number;
  takeProfitKVnd: number;
  barLowKVnd: number;
  barHighKVnd: number;
}): "STOP_LOSS_HIT" | "TAKE_PROFIT_HIT" | null {
  const { stopKVnd, takeProfitKVnd, barLowKVnd, barHighKVnd } = params;
  if (barLowKVnd <= stopKVnd) return "STOP_LOSS_HIT";
  if (barHighKVnd >= takeProfitKVnd) return "TAKE_PROFIT_HIT";
  return null;
}

export function unrealizedPnlVnd(
  entryKVnd: number,
  markKVnd: number,
  quantity: number
): number {
  return Math.round((kvndToVnd(markKVnd) - kvndToVnd(entryKVnd)) * quantity);
}
