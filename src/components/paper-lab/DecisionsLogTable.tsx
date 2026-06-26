import type { DecisionLogRowDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

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
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id}>
              <td>{d.date}</td>
              <td>{d.agentName}</td>
              <td className="font-mono">{d.symbol}</td>
              <td>{d.action}</td>
              <td className="tabular-nums">{(d.confidence * 100).toFixed(0)}%</td>
              <td style={{ maxWidth: 280, whiteSpace: "normal" }}>{d.reasoningSummary}</td>
              <td className="paper-lab-json-preview">{d.jsonPreview}</td>
              <td
                className={
                  d.validationStatus === "VALID"
                    ? "paper-lab-validation-valid"
                    : "paper-lab-validation-invalid"
                }
              >
                {d.validationStatus}
              </td>
              <td className="font-mono text-xs">{d.linkedOrderId ?? "—"}</td>
              <td className="font-mono text-xs">{d.linkedPositionId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
