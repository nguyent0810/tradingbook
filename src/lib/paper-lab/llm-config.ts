/**
 * Paper Lab LLM is opt-in only. Default: rule/mock agents, zero external API calls.
 *
 * Enable later with PAPER_LAB_LLM_ENABLED=true plus OPENAI_API_KEY or ZENMUX_API_KEY.
 */
export function isPaperLabLlmEnabled(): boolean {
  const flag = process.env.PAPER_LAB_LLM_ENABLED?.trim().toLowerCase();
  if (flag !== "true") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ZENMUX_API_KEY?.trim());
}

export function getPaperLabExecutionMode(): {
  agentType: "rule" | "llm";
  llmEnabled: boolean;
  label: string;
  provider: "openai" | "zenmux" | null;
} {
  const llmEnabled = isPaperLabLlmEnabled();
  if (!llmEnabled) {
    return {
      agentType: "rule",
      llmEnabled: false,
      label: "Rule Agents Active · LLM Disabled",
      provider: null,
    };
  }
  const provider = process.env.ZENMUX_API_KEY?.trim()
    ? ("zenmux" as const)
    : process.env.OPENAI_API_KEY?.trim()
      ? ("openai" as const)
      : null;
  return {
    agentType: "llm",
    llmEnabled: true,
    label: `LLM Enabled · ${provider ?? "unknown"} provider`,
    provider,
  };
}
