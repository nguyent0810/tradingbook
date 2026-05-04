import { z } from "zod";

export const TradeFormSchema = z.object({
  symbol: z
    .string()
    .min(1, "Ticker symbol is required.")
    .max(10, "Ticker symbol too long.")
    .transform((val) => val.toUpperCase().trim()),
  direction: z.enum(["LONG", "SHORT"]),
  status: z.enum(["PLANNED", "OPEN", "CLOSED", "CANCELLED"]),
  entryDate: z.string().min(1, "Entry date is required."),
  exitDate: z.string().optional().default(""),
  entryPrice: z.coerce.number().positive("Entry price must be positive."),
  exitPrice: z.coerce
    .number()
    .positive("Exit price must be positive.")
    .optional()
    .or(z.literal("")),
  quantity: z.coerce.number().positive("Quantity must be positive."),
  fees: z.coerce.number().min(0, "Fees cannot be negative.").default(0),
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
