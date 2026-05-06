import { z } from "zod";

export const TradeFormSchema = z.object({
  setupId: z.string().optional().default(""),
  symbol: z
    .string()
    .min(1, "Ticker symbol is required.")
    .max(10, "Ticker symbol too long.")
    .transform((val) => val.toUpperCase().trim()),
  direction: z.enum(["LONG", "SHORT"]),
  status: z.enum(["PLANNED", "OPEN", "CLOSED", "CANCELLED"]),
  entryDate: z.string().min(1, "Entry date is required."),
  exitDate: z.string().optional().default(""),
  stopLoss: z.coerce.number().positive("Stop loss must be positive.").optional().or(z.literal("")),
  takeProfit: z.coerce.number().positive("Take profit must be positive.").optional().or(z.literal("")),
  positionSize: z.coerce.number().positive("Position size must be positive.").optional().or(z.literal("")),
  entryReason: z
    .enum([
      "ZONE_RETEST",
      "BREAKOUT_CONFIRM",
      "PULLBACK_ENTRY",
      "STRUCTURE_CONTINUATION",
      "MOMENTUM_CONFIRM",
      "READY_ON_OPEN",
      "READY_INTRADAY",
      "LATE_CHASE",
    ])
    .optional()
    .or(z.literal("")),
  entryLocationVsZone: z.enum(["IN_ZONE", "ABOVE_ZONE", "BELOW_ZONE"]).optional().or(z.literal("")),
  healthLevelAtEntry: z.enum(["HEALTHY", "WARNING", "AT_RISK", "DEAD"]).optional().or(z.literal("")),
  healthScoreAtEntry: z.coerce.number().int().min(0).max(100).optional().or(z.literal("")),
  entryPrice: z.coerce.number().positive("Entry price must be positive."),
  exitPrice: z.coerce
    .number()
    .positive("Exit price must be positive.")
    .optional()
    .or(z.literal("")),
  exitReason: z
    .enum([
      "TAKE_PROFIT_HIT",
      "STOP_LOSS_HIT",
      "ZONE_INVALIDATED",
      "STRUCTURE_BROKEN",
      "HEALTH_DEGRADED_EOD",
      "TIME_STOP",
      "MANUAL_RULE_BASED_EXIT",
    ])
    .optional()
    .or(z.literal("")),
  exitDiscipline: z
    .enum([
      "FOLLOWED_PLAN",
      "EARLY_EXIT_RULE_BASED",
      "EMOTIONAL_EXIT",
      "RULE_VIOLATION",
    ])
    .optional()
    .or(z.literal("")),
  quantity: z.coerce.number().positive("Quantity must be positive."),
  fees: z.coerce.number().min(0, "Fees cannot be negative.").default(0),
  entryNote: z.string().max(2000, "Entry note too long.").optional().default(""),
  exitNote: z.string().max(2000, "Exit note too long.").optional().default(""),
  setupSnapshot: z.string().optional().default(""),
  notes: z.string().max(2000, "Notes too long.").optional().default(""),
});

export type TradeFormValues = z.infer<typeof TradeFormSchema>;

/**
 * Compute realized P&L for a closed trade.
 * For LONG: (exitPrice - entryPrice) * quantity - fees
 * For SHORT: (entryPrice - exitPrice) * quantity - fees
 */
export function computePnl(
  direction: "LONG" | "SHORT",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  fees: number
): number {
  const raw =
    direction === "LONG"
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
  return parseFloat((raw - fees).toFixed(2));
}
