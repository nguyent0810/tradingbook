"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createTrade,
  updateTrade,
  type TradeActionState,
} from "@/app/actions/trades";
import type { Trade } from "@/generated/prisma/client";

interface TradeFormProps {
  trade?: Trade;
}

export function TradeForm({ trade }: TradeFormProps) {
  const isEditing = !!trade;

  const action = isEditing
    ? updateTrade.bind(null, trade.id)
    : createTrade;

  const [state, formAction, pending] = useActionState<
    TradeActionState,
    FormData
  >(action, undefined);

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  };

  return (
    <form action={formAction} className="space-y-6">
      {state?.message && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--danger-muted)",
            color: "var(--danger)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {state.message}
        </div>
      )}

      {/* Row 1: Symbol + Direction + Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="symbol" className="label">
            Ticker Symbol
          </label>
          <input
            id="symbol"
            name="symbol"
            type="text"
            required
            placeholder="AAPL"
            defaultValue={trade?.symbol || ""}
            className="input"
            style={{ textTransform: "uppercase" }}
          />
          {state?.errors?.symbol && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.symbol[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="direction" className="label">
            Direction
          </label>
          <select
            id="direction"
            name="direction"
            required
            defaultValue={trade?.direction || "LONG"}
            className="select"
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>

        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={trade?.status || "OPEN"}
            className="select"
          >
            <option value="PLANNED">Planned</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Row 2: Entry/Exit Date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="entryDate" className="label">
            Entry Date
          </label>
          <input
            id="entryDate"
            name="entryDate"
            type="datetime-local"
            required
            defaultValue={formatDate(trade?.entryDate)}
            className="input"
          />
          {state?.errors?.entryDate && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.entryDate[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="exitDate" className="label">
            Exit Date{" "}
            <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <input
            id="exitDate"
            name="exitDate"
            type="datetime-local"
            defaultValue={formatDate(trade?.exitDate)}
            className="input"
          />
        </div>
      </div>

      {/* Row 3: Prices */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="entryPrice" className="label">
            Entry Price
          </label>
          <input
            id="entryPrice"
            name="entryPrice"
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            defaultValue={trade?.entryPrice || ""}
            className="input"
          />
          {state?.errors?.entryPrice && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.entryPrice[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="exitPrice" className="label">
            Exit Price{" "}
            <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <input
            id="exitPrice"
            name="exitPrice"
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={trade?.exitPrice ?? ""}
            className="input"
          />
          {state?.errors?.exitPrice && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.exitPrice[0]}
            </p>
          )}
        </div>
      </div>

      {/* Row 4: Quantity + Fees */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quantity" className="label">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.01"
            required
            placeholder="0"
            defaultValue={trade?.quantity || ""}
            className="input"
          />
          {state?.errors?.quantity && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.quantity[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="fees" className="label">
            Fees
          </label>
          <input
            id="fees"
            name="fees"
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={trade?.fees || 0}
            className="input"
          />
        </div>
      </div>

      {/* Row 5: Strategy */}
      <div>
        <label htmlFor="strategy" className="label">
          Strategy{" "}
          <span style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <input
          id="strategy"
          name="strategy"
          type="text"
          placeholder="e.g. Breakout, Pullback"
          defaultValue={trade?.strategy || ""}
          className="input"
          list="preset-strategies"
        />
        <datalist id="preset-strategies">
          <option value="Breakout" />
          <option value="Pullback" />
          <option value="Mean Reversion" />
          <option value="Scalp" />
          <option value="Swing" />
        </datalist>
      </div>

      {/* Row 6: Notes */}
      <div>
        <label htmlFor="notes" className="label">
          Notes{" "}
          <span style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Why did you take this trade? What was your thesis?"
          defaultValue={trade?.notes || ""}
          className="input"
          style={{ resize: "vertical", minHeight: "80px" }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
              {isEditing ? "Updating…" : "Saving…"}
            </span>
          ) : isEditing ? (
            "Update Trade"
          ) : (
            "Log Trade"
          )}
        </button>

        <Link href="/trades" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
