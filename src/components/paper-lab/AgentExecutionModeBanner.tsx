import type { ArenaOverviewDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

export function AgentExecutionModeBanner({
  mode,
}: {
  mode: NonNullable<ArenaOverviewDto["executionMode"]>;
}) {
  const isLlm = mode.llmEnabled;
  return (
    <div
      className={`paper-lab-mode-banner ${isLlm ? "paper-lab-mode-banner--llm" : "paper-lab-mode-banner--rule"}`}
      data-testid="paper-lab-execution-mode"
    >
      <span className="paper-lab-mode-banner__badge">{isLlm ? "LLM" : "Quy tắc"}</span>
      <span className="paper-lab-mode-banner__label">{mode.label}</span>
    </div>
  );
}
