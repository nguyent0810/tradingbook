"use client";

import { useState } from "react";
import { TradeButton } from "./trade-button";

export type OrderPanelProps = {
  symbol: string;
  mode?: "preview" | "live";
  onSubmit?: (side: "buy" | "sell") => void;
};

export function OrderPanel({ symbol, mode = "preview", onSubmit }: OrderPanelProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("100");
  const [showRisk, setShowRisk] = useState(false);

  function handleAction(next: "buy" | "sell") {
    setSide(next);
    if (mode === "preview") {
      setShowRisk(true);
      return;
    }
    onSubmit?.(next);
  }

  return (
    <>
      <div className="panel flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {symbol}
          </span>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {mode === "preview" ? "Preview" : "Log trade"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TradeButton
            variant="buy"
            fullWidth
            className={side === "buy" ? "ring-2 ring-[var(--buy)] ring-offset-2 ring-offset-[var(--bg-secondary)]" : "opacity-70"}
            onClick={() => setSide("buy")}
          >
            Long / Buy
          </TradeButton>
          <TradeButton
            variant="sell"
            fullWidth
            className={side === "sell" ? "ring-2 ring-[var(--sell)] ring-offset-2 ring-offset-[var(--bg-secondary)]" : "opacity-70"}
            onClick={() => setSide("sell")}
          >
            Short / Sell
          </TradeButton>
        </div>
        <label className="block">
          <span className="label">Quantity</span>
          <input className="input font-mono tabular-nums" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Limit price</span>
          <input className="input font-mono tabular-nums" placeholder="Market" />
        </label>
        <TradeButton
          variant={side === "buy" ? "buy" : "sell"}
          size="lg"
          fullWidth
          onClick={() => handleAction(side)}
        >
          Review {side === "buy" ? "long" : "short"} entry
        </TradeButton>
        <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
          Journal workflow — not live execution.
        </p>
      </div>
      <RiskConfirmationModal
        open={showRisk}
        side={side}
        symbol={symbol}
        onClose={() => setShowRisk(false)}
        onConfirm={() => {
          setShowRisk(false);
          onSubmit?.(side);
        }}
      />
    </>
  );
}

export type RiskConfirmationModalProps = {
  open: boolean;
  side: "buy" | "sell";
  symbol: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function RiskConfirmationModal({
  open,
  side,
  symbol,
  onClose,
  onConfirm,
}: RiskConfirmationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-modal-title"
    >
      <div className="panel-elevated w-full max-w-md p-6 shadow-[var(--shadow-lg)]">
        <h2 id="risk-modal-title" className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Confirm journal entry
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          You are about to log a <strong>{side}</strong> on <span className="font-mono">{symbol}</span>.
          This records intent in your journal — it does not place a live order.
        </p>
        <ul className="mt-4 space-y-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <li>• Verify size against your risk budget.</li>
          <li>• Confirm setup qualifies under your playbook.</li>
          <li>• Stop level should be defined before entry.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <TradeButton variant={side === "buy" ? "buy" : "sell"} className="flex-1" onClick={onConfirm}>
            Confirm log
          </TradeButton>
        </div>
      </div>
    </div>
  );
}
