import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { computeNotionalVnd, computeRiskAtStopVnd, kvndToVnd } from "@/lib/paper-lab/engine/units";

/** Vietnam HOSE/HNX board lot — 100 shares minimum. */
export const VN_BOARD_LOT_SHARES = 100;

export type BoardLotResult =
  | { ok: true; quantity: number; adjusted: boolean }
  | { ok: false; quantity: 0; reason: string };

/**
 * Round share quantity down to the nearest board lot (100 shares).
 * Returns invalid when result is below one full lot.
 */
export function roundDownToBoardLotShares(quantity: number): BoardLotResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, quantity: 0, reason: "Quantity must be positive" };
  }
  const rounded = Math.floor(quantity / VN_BOARD_LOT_SHARES) * VN_BOARD_LOT_SHARES;
  if (rounded < VN_BOARD_LOT_SHARES) {
    return {
      ok: false,
      quantity: 0,
      reason: `Below minimum board lot (${VN_BOARD_LOT_SHARES} shares)`,
    };
  }
  return { ok: true, quantity: rounded, adjusted: rounded !== quantity };
}

/** Apply board-lot rounding to BUY/ADD decision fields used for execution. */
export function applyBoardLotToBuyDecision(
  decision: AgentDecisionOutput
): { decision: AgentDecisionOutput; lot: BoardLotResult } {
  const rawQty = decision.quantity;
  if (rawQty == null) {
    return {
      decision,
      lot: { ok: false, quantity: 0, reason: "Missing quantity" },
    };
  }

  const lot = roundDownToBoardLotShares(rawQty);
  if (!lot.ok) {
    return { decision, lot };
  }

  const entry = decision.entry_price;
  const stop = decision.stop_loss;
  const qty = lot.quantity;

  return {
    lot,
    decision: {
      ...decision,
      quantity: qty,
      position_size_vnd:
        entry != null ? computeNotionalVnd(entry, qty) : decision.position_size_vnd,
      risk_amount_vnd:
        entry != null && stop != null
          ? computeRiskAtStopVnd(entry, stop, qty)
          : decision.risk_amount_vnd,
    },
  };
}

/** Round sell quantity down to board lot; invalid if below one lot. */
export function roundDownSellQuantity(quantity: number): BoardLotResult {
  return roundDownToBoardLotShares(quantity);
}

export function formatBoardLotRejectionReason(lot: BoardLotResult & { ok: false }): string {
  return `Board lot rule: ${lot.reason}`;
}

/** Shares label for audit logs when qty was adjusted. */
export function boardLotAdjustmentNote(rawQty: number, roundedQty: number): string | null {
  if (rawQty === roundedQty) return null;
  return `Quantity adjusted ${rawQty} → ${roundedQty} shares (100-share board lot)`;
}
