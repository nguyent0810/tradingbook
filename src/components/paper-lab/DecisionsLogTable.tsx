"use client";

import type { DecisionLogRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct, formatShortRef } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { JsonAuditViewer } from "./ui/JsonAuditViewer";
import { PaperLabDetailsDialog } from "./ui/PaperLabDetailsDialog";
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

function ReasoningCell({ decision }: { decision: DecisionLogRowDto }) {
  const hasMore =
    decision.explanation.supporting.length > 2 ||
    decision.explanation.opposing.length > 2 ||
    decision.explanation.summary.length > 120;

  return (
    <td className="paper-lab-reasoning-cell">
      <p className="text-slate-200 mb-1 paper-lab-line-clamp-2">{decision.explanation.summary}</p>
      {decision.explanation.supporting.length > 0 && (
        <ul className="text-[0.7rem] text-emerald-300/80 list-disc list-inside">
          {decision.explanation.supporting.slice(0, 2).map((s) => (
            <li key={s} className="paper-lab-line-clamp-2">{s}</li>
          ))}
        </ul>
      )}
      {decision.explanation.opposing.length > 0 && (
        <ul className="text-[0.7rem] text-amber-200/80 list-disc list-inside">
          {decision.explanation.opposing.slice(0, 2).map((s) => (
            <li key={s} className="paper-lab-line-clamp-2">{s}</li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="mt-1">
          <PaperLabDetailsDialog title={`${decision.agentName} — reasoning`} triggerLabel="View reasoning">
            <p className="text-sm text-slate-200 mb-3">{decision.explanation.summary}</p>
            {decision.explanation.supporting.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-emerald-300/90 mb-1">Supporting</div>
                <ul className="text-xs text-emerald-300/85 list-disc list-inside space-y-1">
                  {decision.explanation.supporting.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {decision.explanation.opposing.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-amber-200/90 mb-1">Opposing</div>
                <ul className="text-xs text-amber-200/85 list-disc list-inside space-y-1">
                  {decision.explanation.opposing.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </PaperLabDetailsDialog>
        </div>
      )}
    </td>
  );
}

export function DecisionsLogTable({ decisions }: { decisions: DecisionLogRowDto[] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-400">No agent decisions logged yet.</p>;
  }

  return (
    <div className="paper-lab-table-wrap" data-testid="paper-lab-decisions">
      <table className="paper-lab-table paper-lab-table--decisions" style={{ minWidth: "960px" }}>
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
              <td><span className="paper-lab-truncate block max-w-[120px]">{d.agentName}</span></td>
              <td className="font-mono">{d.symbol}</td>
              <td><ActionBadge action={d.action} /></td>
              <td className="tabular-nums">{formatConfidencePct(d.confidence)}</td>
              <ReasoningCell decision={d} />
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
