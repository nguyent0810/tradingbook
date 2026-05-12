"use client";

import { useActionState, useCallback, useState } from "react";
import Link from "next/link";
import {
  checkTradeEntryPriceAlignment,
  createTrade,
  updateTrade,
  type TradeActionState,
} from "@/app/actions/trades";
import type { Trade } from "@/generated/prisma/client";
import { formatPlaybookLabel } from "@/lib/playbook-config";

interface TradeFormProps {
  trade?: Trade;
  initialValues?: Partial<{
    setupId: string;
    symbol: string;
    direction: "LONG" | "SHORT";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    entryReason: string;
    entryLocationVsZone: string;
    healthLevelAtEntry: string;
    healthScoreAtEntry: number;
    setupSnapshot: string;
  }>;
  setupContextLabel?: string | null;
}

export function TradeForm({ trade, initialValues, setupContextLabel }: TradeFormProps) {
  const isEditing = !!trade;

  const action = isEditing
    ? updateTrade.bind(null, trade.id)
    : createTrade;

  const [state, formAction, pending] = useActionState<
    TradeActionState,
    FormData
  >(action, undefined);

  const [entryUnitHint, setEntryUnitHint] = useState<string | null>(null);

  const runEntryUnitCheck = useCallback(async () => {
    const symEl = document.getElementById("symbol") as HTMLInputElement | null;
    const epEl = document.getElementById("entryPrice") as HTMLInputElement | null;
    const sym = symEl?.value?.trim() ?? "";
    const ep = Number(epEl?.value);
    if (!sym || !Number.isFinite(ep) || ep <= 0) {
      setEntryUnitHint(null);
      return;
    }
    const res = await checkTradeEntryPriceAlignment(sym, ep);
    if (res.status === "warn") setEntryUnitHint(res.message);
    else setEntryUnitHint(null);
  }, []);

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
            defaultValue={trade?.symbol || initialValues?.symbol || ""}
            className="input"
            style={{ textTransform: "uppercase" }}
            onBlur={() => {
              void runEntryUnitCheck();
            }}
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
            defaultValue={trade?.direction || initialValues?.direction || "LONG"}
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

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm">
        <span className="font-medium text-[var(--text-primary)]">Playbook</span>
        <span className="mx-2 text-[var(--text-muted)]">·</span>
        <span className="text-[var(--text-secondary)]">
          {formatPlaybookLabel(trade?.playbook ?? "BREAKOUT_PULLBACK")}
        </span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          This journal is locked to the Breakout pullback playbook only.
        </p>
        {setupContextLabel ? (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Linked setup: {setupContextLabel}
          </p>
        ) : null}
      </div>

      <input type="hidden" name="setupId" value={trade?.setupId ?? initialValues?.setupId ?? ""} />
      <input type="hidden" name="setupSnapshot" value={initialValues?.setupSnapshot ?? ""} />

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
            Entry price <span style={{ color: "var(--text-muted)" }}>(1000 ₫ / share)</span>
          </label>
          <input
            id="entryPrice"
            name="entryPrice"
            type="number"
            step="any"
            required
            placeholder="0"
            defaultValue={trade?.entryPrice || initialValues?.entryPrice || ""}
            className="input"
            onBlur={() => {
              void runEntryUnitCheck();
            }}
          />
          {state?.errors?.entryPrice && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {state.errors.entryPrice[0]}
            </p>
          )}
          <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
            Same unit as imported equity daily closes (vnstock/VCI: thousand VND per share), so
            unrealized P&amp;L matches latest bar closes.
          </p>
          {entryUnitHint ? (
            <p className="mt-2 text-xs leading-snug" role="status" style={{ color: "#9a3412" }}>
              {entryUnitHint}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="exitPrice" className="label">
            Exit price{" "}
            <span style={{ color: "var(--text-muted)" }}>(optional, 1000 ₫ / share)</span>
          </label>
          <input
            id="exitPrice"
            name="exitPrice"
            type="number"
            step="any"
            placeholder="0"
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
            step="any"
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
            step="any"
            placeholder="0"
            defaultValue={trade?.fees || 0}
            className="input"
          />
        </div>
      </div>

      {/* Row 5: Setup execution context */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stopLoss" className="label">
            Stop loss{" "}
            <span style={{ color: "var(--text-muted)" }}>(optional, 1000 ₫ / share)</span>
          </label>
          <input
            id="stopLoss"
            name="stopLoss"
            type="number"
            step="any"
            defaultValue={trade?.stopLoss ?? initialValues?.stopLoss ?? ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="takeProfit" className="label">
            Take profit{" "}
            <span style={{ color: "var(--text-muted)" }}>(optional, 1000 ₫ / share)</span>
          </label>
          <input
            id="takeProfit"
            name="takeProfit"
            type="number"
            step="any"
            defaultValue={trade?.takeProfit ?? initialValues?.takeProfit ?? ""}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="positionSize" className="label">
            Position Size <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <input
            id="positionSize"
            name="positionSize"
            type="number"
            step="any"
            defaultValue={trade?.positionSize ?? initialValues?.positionSize ?? ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="healthScoreAtEntry" className="label">
            Health Score at Entry <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <input
            id="healthScoreAtEntry"
            name="healthScoreAtEntry"
            type="number"
            min={0}
            max={100}
            defaultValue={trade?.healthScoreAtEntry ?? initialValues?.healthScoreAtEntry ?? ""}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="entryReason" className="label">Entry Reason</label>
          <select
            id="entryReason"
            name="entryReason"
            defaultValue={trade?.entryReason ?? initialValues?.entryReason ?? ""}
            className="select"
          >
            <option value="">Select reason</option>
            <option value="ZONE_RETEST">Zone retest</option>
            <option value="BREAKOUT_CONFIRM">Breakout confirm</option>
            <option value="PULLBACK_ENTRY">Pullback entry</option>
            <option value="STRUCTURE_CONTINUATION">Structure continuation</option>
            <option value="MOMENTUM_CONFIRM">Momentum confirm</option>
            <option value="READY_ON_OPEN">Ready on open</option>
            <option value="READY_INTRADAY">Ready intraday</option>
            <option value="LATE_CHASE">Late chase</option>
          </select>
        </div>
        <div>
          <label htmlFor="entryLocationVsZone" className="label">Entry vs Zone</label>
          <select
            id="entryLocationVsZone"
            name="entryLocationVsZone"
            defaultValue={trade?.entryLocationVsZone ?? initialValues?.entryLocationVsZone ?? ""}
            className="select"
          >
            <option value="">Select location</option>
            <option value="IN_ZONE">In zone</option>
            <option value="ABOVE_ZONE">Above zone</option>
            <option value="BELOW_ZONE">Below zone</option>
          </select>
        </div>
        <div>
          <label htmlFor="healthLevelAtEntry" className="label">Health at Entry</label>
          <select
            id="healthLevelAtEntry"
            name="healthLevelAtEntry"
            defaultValue={trade?.healthLevelAtEntry ?? initialValues?.healthLevelAtEntry ?? ""}
            className="select"
          >
            <option value="">Select health</option>
            <option value="HEALTHY">Healthy</option>
            <option value="WARNING">Warning</option>
            <option value="AT_RISK">At risk</option>
            <option value="DEAD">Dead</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="exitReason" className="label">Exit Reason</label>
          <select
            id="exitReason"
            name="exitReason"
            defaultValue={trade?.exitReason ?? ""}
            className="select"
          >
            <option value="">Select reason</option>
            <option value="TAKE_PROFIT_HIT">Take profit hit</option>
            <option value="STOP_LOSS_HIT">Stop loss hit</option>
            <option value="ZONE_INVALIDATED">Zone invalidated</option>
            <option value="STRUCTURE_BROKEN">Structure broken</option>
            <option value="HEALTH_DEGRADED_EOD">Health degraded EOD</option>
            <option value="TIME_STOP">Time stop</option>
            <option value="MANUAL_RULE_BASED_EXIT">Manual rule-based exit</option>
          </select>
        </div>
        <div>
          <label htmlFor="exitDiscipline" className="label">Exit Discipline</label>
          <select
            id="exitDiscipline"
            name="exitDiscipline"
            defaultValue={trade?.exitDiscipline ?? ""}
            className="select"
          >
            <option value="">Select discipline</option>
            <option value="FOLLOWED_PLAN">Followed plan</option>
            <option value="EARLY_EXIT_RULE_BASED">Early exit (rule-based)</option>
            <option value="EMOTIONAL_EXIT">Emotional exit</option>
            <option value="RULE_VIOLATION">Rule violation</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="entryNote" className="label">
            Entry Note <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <textarea
            id="entryNote"
            name="entryNote"
            rows={2}
            defaultValue={trade?.entryNote ?? ""}
            className="input"
            style={{ resize: "vertical", minHeight: "64px" }}
          />
        </div>
        <div>
          <label htmlFor="exitNote" className="label">
            Exit Note <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <textarea
            id="exitNote"
            name="exitNote"
            rows={2}
            defaultValue={trade?.exitNote ?? ""}
            className="input"
            style={{ resize: "vertical", minHeight: "64px" }}
          />
        </div>
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
