"use client";

import type { DecisionLogRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct, formatShortRef } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { JsonAuditViewer } from "./ui/JsonAuditViewer";
import { PaperLabDetailsDialog } from "./ui/PaperLabDetailsDialog";
import { ValidationBadge } from "./ui/ValidationBadge";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function decisionRowClass(action: string): string {
  const a = action.toUpperCase();
  if (a === "HOLD") return "paper-lab-decision-row--muted";
  if (["BUY", "SELL", "REDUCE", "EXIT", "ADD"].includes(a)) {
    return "paper-lab-decision-row--active";
  }
  return "";
}

function OrderRef({ orderId }: { orderId: string | null }) {
  if (!orderId) return <span className="text-[var(--text-tertiary)]">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(orderId);
  };

  return (
    <button
      type="button"
      className="paper-lab-order-ref font-mono text-xs"
      title={`Sao chép mã lệnh đầy đủ: ${orderId}`}
      onClick={copy}
    >
      {formatShortRef(orderId)}
    </button>
  );
}

function ReasoningCell({ decision }: { decision: DecisionLogRowDto }) {
  const hasMore =
    decision.explanation.supporting.length > 0 ||
    decision.explanation.opposing.length > 0 ||
    decision.explanation.summary.length > 120;

  return (
    <td className="paper-lab-reasoning-cell">
      <p className="text-[var(--text-primary)] paper-lab-line-clamp-2 text-xs">{decision.explanation.summary}</p>
      {hasMore && (
        <div className="mt-1">
          <PaperLabDetailsDialog title={`${decision.agentName} — lý do`} triggerLabel="Xem lý do">
            <p className="text-sm text-[var(--text-primary)] mb-3">{decision.explanation.summary}</p>
            {decision.explanation.supporting.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-[var(--success)]/90 mb-1">Ủng hộ</div>
                <ul className="text-xs text-[var(--success)]/85 list-disc list-inside space-y-1">
                  {decision.explanation.supporting.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {decision.explanation.opposing.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--warning)]/90 mb-1">Phản đối</div>
                <ul className="text-xs text-[var(--warning)]/85 list-disc list-inside space-y-1">
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
    return (
      <PaperLabPanel title="Nhật ký quyết định" testId="paper-lab-decisions" tone="soft">
        <p className="text-sm text-[var(--text-tertiary)]">Chưa có quyết định nào của agent được ghi nhận.</p>
      </PaperLabPanel>
    );
  }

  return (
    <PaperLabPanel title="Nhật ký quyết định" testId="paper-lab-decisions" tone="soft">
      <div className="safe-table-wrap paper-lab-table-wrap">
        <table className="paper-lab-table paper-lab-table--decisions safe-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Agent</th>
              <th>Mã</th>
              <th>Hành động</th>
              <th>Tin cậy</th>
              <th>Lý do</th>
              <th>JSON</th>
              <th>Xác thực</th>
              <th>Lệnh</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.id} className={decisionRowClass(d.action)}>
                <td>{d.date}</td>
                <td><span className="paper-lab-truncate block max-w-[120px]">{d.agentName}</span></td>
                <td className="font-mono">{d.symbol}</td>
                <td><ActionBadge action={d.action} /></td>
                <td className="paper-lab-tabular">{formatConfidencePct(d.confidence)}</td>
                <ReasoningCell decision={d} />
                <td><JsonAuditViewer payload={d.jsonPayload} /></td>
                <td><ValidationBadge status={d.validationStatus} /></td>
                <td><OrderRef orderId={d.linkedOrderId} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaperLabPanel>
  );
}
