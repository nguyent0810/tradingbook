"use client";

import type { DecisionLogRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct, formatShortRef } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { JsonAuditViewer } from "./ui/JsonAuditViewer";
import { ValidationBadge } from "./ui/ValidationBadge";
import "./paper-lab-workstation.css";

function OrderRef({ orderId }: { orderId: string | null }) {
  if (!orderId) return <span className="text-slate-500">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(orderId);
  };

  return (
    <button
      type="button"
      className="paper-lab-order-ref font-mono text-xs"
      title={`Copy full order ID: ${orderId}`}
      onClick={copy}
    >
      {formatShortRef(orderId)}
    </button>
  );
}

export function DecisionsLogTable({ decisions }: { decisions: DecisionLogRowDto[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-400">No agent decisions logged yet.</p>;
  }

  return (
    <div className="paper-lab-table-wrap" data-testid="paper-lab-decisions">
      <table className="paper-lab-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Agent</th>
            <th>Symbol</th>
            <th>Action</th>
            <th>Conf</th>
            <th>Reasoning</th>
            <th>JSON</th>
            <th>Validation</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id}>
              <td>{d.date}</td>
              <td className="whitespace-nowrap">{d.agentName}</td>
              <td className="font-mono">{d.symbol}</td>
              <td><ActionBadge action={d.action} /></td>
              <td className="tabular-nums">{formatConfidencePct(d.confidence)}</td>
              <td className="paper-lab-reasoning-cell">
                <p className="text-slate-200 mb-1">{d.explanation.summary}</p>
                {d.explanation.supporting.length > 0 && (
                  <ul className="text-[0.7rem] text-emerald-300/80 list-disc list-inside">
                    {d.explanation.supporting.slice(0, 2).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                {d.explanation.opposing.length > 0 && (
                  <ul className="text-[0.7rem] text-amber-200/80 list-disc list-inside">
                    {d.explanation.opposing.slice(0, 2).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td><JsonAuditViewer payload={d.jsonPayload} /></td>
              <td><ValidationBadge status={d.validationStatus} /></td>
              <td><OrderRef orderId={d.linkedOrderId} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
