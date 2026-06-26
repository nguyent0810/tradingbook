import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import "../paper-lab-workstation.css";

const ACTION_CLASS: Record<string, string> = {
  BUY: "paper-lab-action--buy",
  ADD: "paper-lab-action--buy",
  HOLD: "paper-lab-action--hold",
  REDUCE: "paper-lab-action--reduce",
  EXIT: "paper-lab-action--sell",
  SELL: "paper-lab-action--sell",
};

export function ActionBadge({ action }: { action: AgentAction | string }) {
  return (
    <span className={`paper-lab-action-badge ${ACTION_CLASS[action] ?? "paper-lab-action--hold"}`}>
      {action}
    </span>
  );
}
