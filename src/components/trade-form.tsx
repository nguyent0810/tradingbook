"use client";

import { useActionState, useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  checkTradeEntryPriceAlignment,
  createTrade,
  updateTrade,
  type TradeActionState,
} from "@/app/actions/trades";
import type { Trade } from "@/generated/prisma/client";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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
  const reduceMotion = useReducedMotion();

  const action = isEditing
    ? updateTrade.bind(null, trade.id)
    : createTrade;

  const [state, formAction, pending] = useActionState<
    TradeActionState,
    FormData
  >(action, undefined);

  const [status, setStatus] = useState<string>(trade?.status || "OPEN");
  const [entryUnitHint, setEntryUnitHint] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  const handleFixEntryPrice = useCallback(() => {
    const epEl = document.getElementById("entryPrice") as HTMLInputElement | null;
    if (epEl) {
      const ep = Number(epEl.value);
      if (ep > 1000) {
        epEl.value = (ep / 1000).toString();
        // Dispatch native input event to trigger stats preview calculation
        epEl.dispatchEvent(new Event("input", { bubbles: true }));
        setEntryUnitHint(null);
      }
    }
  }, []);

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Inputs form */}
        <div className="lg:col-span-8 space-y-6">
          
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
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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

          {/* Row 2: Entry Date (Exit Date moved to dynamically disclosed section) */}
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
          </div>

          {/* Row 3: Prices (Exit Price moved to dynamically disclosed section) */}
          <div className="grid grid-cols-1 gap-4">
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
              <p className="mt-1.5 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                Same unit as imported closes (thousand VND per share) to ensure correct EOD unrealized calculations.
              </p>
              
              {entryUnitHint ? (
                <div className="mt-3 rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-xs text-[#f59e0b] leading-relaxed">
                    <span className="font-semibold block mb-0.5">⚠️ Đơn vị giá không khớp</span>
                    Mã này có thể đang sử dụng VNĐ nominal thay vì đơn vị nghìn đồng (k ₫).
                  </div>
                  <button
                    type="button"
                    onClick={handleFixEntryPrice}
                    className="bg-[rgba(245,158,11,0.15)] hover:bg-[rgba(245,158,11,0.25)] text-[#fbbf24] border border-[rgba(245,158,11,0.3)] text-[11px] font-semibold px-2.5 py-1 rounded transition-all whitespace-nowrap cursor-pointer"
                  >
                    Sửa nhanh đơn vị (k ₫)
                  </button>
                </div>
              ) : null}
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
                Stop loss <span style={{ color: "var(--text-muted)" }}>(optional, 1000 ₫ / share)</span>
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
                Take profit <span style={{ color: "var(--text-muted)" }}>(optional, 1000 ₫ / share)</span>
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

          {/* Row 6: Position sizing & health */}
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

          {/* Row 7: Entry settings */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* Row 8: Entry Note */}
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

          {/* DYNAMIC EXIT FIELDS DISCLOSURE PANEL (Only shown when status is CLOSED) */}
          <AnimatePresence initial={false}>
            {status === "CLOSED" && (
              <motion.div
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#1f1f23] pt-6 mt-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
                    Exit Execution Details
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="exitDate" className="label">
                        Exit Date
                      </label>
                      <input
                        id="exitDate"
                        name="exitDate"
                        type="datetime-local"
                        defaultValue={formatDate(trade?.exitDate)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="exitPrice" className="label">
                        Exit price <span style={{ color: "var(--text-muted)" }}>(1000 ₫ / share)</span>
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Row 9: General Notes */}
          <div>
            <label htmlFor="notes" className="label">
              Notes <span style={{ color: "var(--text-muted)" }}>(optional)</span>
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

          {/* Form Actions */}
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
        </div>

        {/* RIGHT COLUMN: Financial Stats Live Preview */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <FinancialStatsPreview 
            formRef={formRef} 
            direction={trade?.direction || initialValues?.direction || "LONG"} 
          />
        </div>
      </div>
    </form>
  );
}

/* ========================================================================= */
/* FINANCIAL STATS LIVE PREVIEW COMPONENT                                    */
/* High-performance subcomponent: reads DOM values directly using Form Event */
/* listeners. Prevents re-rendering the parent Form when user is typing.     */
/* ========================================================================= */
function FinancialStatsPreview({
  formRef,
  direction: initialDirection,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  direction: string;
}) {
  const [direction, setDirection] = useState(initialDirection);
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const updateStats = () => {
      const dir = (form.querySelector("#direction") as HTMLSelectElement)?.value || "LONG";
      const ep = Number((form.querySelector("#entryPrice") as HTMLInputElement)?.value) || 0;
      const sl = Number((form.querySelector("#stopLoss") as HTMLInputElement)?.value) || 0;
      const tp = Number((form.querySelector("#takeProfit") as HTMLInputElement)?.value) || 0;
      const qty = Number((form.querySelector("#quantity") as HTMLInputElement)?.value) || 0;

      setDirection(dir);
      setEntryPrice(ep);
      setStopLoss(sl);
      setTakeProfit(tp);
      setQuantity(qty);
    };

    // Initialize stats
    updateStats();

    // Attach listeners on input events for live feedback
    form.addEventListener("input", updateStats);
    form.addEventListener("change", updateStats);
    return () => {
      form.removeEventListener("input", updateStats);
      form.removeEventListener("change", updateStats);
    };
  }, [formRef]);

  // Calculations
  const totalValue = entryPrice * quantity;
  
  let capitalAtRisk = 0;
  let hasValidStop = false;
  if (entryPrice > 0 && stopLoss > 0 && quantity > 0) {
    if (direction === "LONG" && entryPrice > stopLoss) {
      capitalAtRisk = (entryPrice - stopLoss) * quantity;
      hasValidStop = true;
    } else if (direction === "SHORT" && stopLoss > entryPrice) {
      capitalAtRisk = (stopLoss - entryPrice) * quantity;
      hasValidStop = true;
    }
  }

  let rewardToRisk = 0;
  let hasValidReward = false;
  if (hasValidStop && capitalAtRisk > 0 && takeProfit > 0) {
    const riskPerUnit = direction === "LONG" ? entryPrice - stopLoss : stopLoss - entryPrice;
    const rewardPerUnit = direction === "LONG" ? takeProfit - entryPrice : entryPrice - takeProfit;
    if (rewardPerUnit > 0) {
      rewardToRisk = rewardPerUnit / riskPerUnit;
      hasValidReward = true;
    }
  }

  const formatVNDLocal = (val: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val * 1000);
  };

  return (
    <div className="card p-5 space-y-4 bg-[#121215] border border-[#1f1f23] rounded-lg shadow-lg">
      <div className="border-b border-[#1f1f23] pb-2">
        <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider">
          Position Live Analysis
        </h3>
        <p className="text-[10px] text-[#71717a] mt-0.5">Real-time calculations from inputs</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <span className="text-[10px] text-[#71717a] uppercase block mb-1 font-semibold tracking-wide">
            Total Position Value
          </span>
          <span className="text-lg font-bold font-mono text-[#fafafa]">
            {totalValue > 0 ? formatVNDLocal(totalValue) : "0 ₫"}
          </span>
        </div>

        <div className="border-t border-[#1f1f23] pt-3">
          <span className="text-[10px] text-[#71717a] uppercase block mb-1 font-semibold tracking-wide">
            Capital at Risk (R-Size)
          </span>
          {hasValidStop ? (
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold font-mono text-[#f87171]">
                {formatVNDLocal(capitalAtRisk)}
              </span>
              <span className="text-[11px] text-[#a1a1aa]">
                Risk Ratio: <strong className="text-[#fafafa]">{((capitalAtRisk / totalValue) * 100).toFixed(2)}%</strong> of size
              </span>
            </div>
          ) : (
            <span className="text-xs text-[#71717a] italic">
              {entryPrice === 0 || quantity === 0 
                ? "Waiting for Entry details..." 
                : "No valid Stop Loss configured"}
            </span>
          )}
        </div>

        <div className="border-t border-[#1f1f23] pt-3">
          <span className="text-[10px] text-[#71717a] uppercase block mb-1 font-semibold tracking-wide">
            Reward to Risk (R Target)
          </span>
          {hasValidReward ? (
            <span className="text-base font-bold font-mono text-[#4ade80]">
              {rewardToRisk.toFixed(2)}R
            </span>
          ) : (
            <span className="text-xs text-[#71717a] italic">
              {!hasValidStop 
                ? "Requires Stop Loss" 
                : takeProfit === 0 
                  ? "Optional target not set" 
                  : "Target price is invalid vs entry"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
