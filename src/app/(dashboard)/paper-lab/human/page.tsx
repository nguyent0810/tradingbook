"use client";

import { useState } from "react";
import { PaperLabPanel } from "@/components/paper-lab/ui/PaperLabPanel";
import "@/components/paper-lab/paper-lab-workstation.css";

export default function HumanPmPage() {
  const [userId] = useState("demo-user");
  const [symbol, setSymbol] = useState("FPT");
  const [action, setAction] = useState<"BUY" | "HOLD">("HOLD");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    const res = await fetch("/api/lab/human/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        symbol,
        decision: {
          decision_id: crypto.randomUUID(),
          session_date: new Date().toISOString().slice(0, 10),
          symbol,
          action,
          confidence: 0.7,
          reasoning: "Human discretionary decision",
          entry_price: null,
          stop_loss: null,
          take_profit: null,
          position_size_vnd: null,
          supporting_signals: [],
          opposing_signals: [],
        },
      }),
    });
    const json = await res.json();
    setMessage(json.ok ? `Submitted decision ${json.decisionId}` : json.error);
  }

  return (
    <PaperLabPanel title="Human Portfolio Manager">
      <p className="text-sm text-slate-400 mb-4">
        Same 500M ₫ virtual capital and engine validation as AI agents.
      </p>
      <div className="paper-lab-cio-panel max-w-md space-y-3">
        <label className="block text-sm text-slate-300">
          Symbol
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label className="block text-sm text-slate-300">
          Action
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1"
            value={action}
            onChange={(e) => setAction(e.target.value as "BUY" | "HOLD")}
          >
            <option value="HOLD">HOLD</option>
            <option value="BUY">BUY</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-cyan-700 px-3 py-1.5 text-sm text-white hover:bg-cyan-600"
          onClick={() => void submit()}
        >
          Submit decision
        </button>
        {message && <p className="text-sm text-slate-300">{message}</p>}
      </div>
    </PaperLabPanel>
  );
}
