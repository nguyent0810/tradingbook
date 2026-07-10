"use client";

import { useState } from "react";

/**
 * Human PM decision entry — extracted from /paper-lab/human so it can live
 * inline in the Arena workspace (DECISION zone) and still back the deep-link
 * route. Logic + API contract (/api/lab/human/decisions) unchanged.
 */
export function HumanPmForm() {
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
    <div className="arena-human-form" data-testid="paper-lab-human-form">
      <div className="arena-human-form__fields">
        <label className="arena-human-form__label">
          Symbol
          <input
            className="arena-human-form__input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label className="arena-human-form__label">
          Action
          <select
            className="arena-human-form__input"
            value={action}
            onChange={(e) => setAction(e.target.value as "BUY" | "HOLD")}
          >
            <option value="HOLD">HOLD</option>
            <option value="BUY">BUY</option>
          </select>
        </label>
        <button type="button" className="arena-human-form__submit" onClick={() => void submit()}>
          Submit decision
        </button>
      </div>
      {message && <p className="arena-human-form__msg">{message}</p>}
    </div>
  );
}
