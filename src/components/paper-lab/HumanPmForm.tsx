"use client";

import { useState } from "react";

/**
 * Human PM decision entry — extracted from /paper-lab/human so it can live
 * inline in the Arena workspace (DECISION zone) and still back the deep-link
 * route. Logic + API contract (/api/lab/human/decisions) unchanged.
 */
type SubmitStatus = "idle" | "pending" | "ok" | "error";

export function HumanPmForm() {
  const [userId] = useState("demo-user");
  const [symbol, setSymbol] = useState("FPT");
  const [action, setAction] = useState<"BUY" | "HOLD">("HOLD");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setStatus("pending");
    setMessage(null);
    try {
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
      if (json.ok) {
        setStatus("ok");
        setMessage(`Đã gửi quyết định ${json.decisionId}`);
      } else {
        setStatus("error");
        setMessage(json.error ?? "Gửi thất bại.");
      }
    } catch {
      setStatus("error");
      setMessage("Lỗi mạng — không thể kết nối máy chủ.");
    }
  }

  const pending = status === "pending";

  return (
    <div className="arena-human-form" data-testid="paper-lab-human-form">
      <div className="arena-human-form__fields">
        <label className="arena-human-form__label">
          Mã
          <input
            className="arena-human-form__input"
            value={symbol}
            disabled={pending}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label className="arena-human-form__label">
          Hành động
          <select
            className="arena-human-form__input"
            value={action}
            disabled={pending}
            onChange={(e) => setAction(e.target.value as "BUY" | "HOLD")}
          >
            <option value="HOLD">HOLD</option>
            <option value="BUY">BUY</option>
          </select>
        </label>
        <button
          type="button"
          className="arena-human-form__submit"
          disabled={pending}
          aria-busy={pending}
          onClick={() => void submit()}
        >
          {pending ? "Đang gửi…" : "Gửi quyết định"}
        </button>
      </div>
      {message && (
        <p
          className={
            status === "error"
              ? "arena-human-form__msg arena-human-form__msg--error"
              : "arena-human-form__msg arena-human-form__msg--ok"
          }
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
