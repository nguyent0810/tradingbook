import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isPaperLabLlmEnabled,
  getPaperLabExecutionMode,
} from "@/lib/paper-lab/llm-config";

describe("paper lab llm config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.PAPER_LAB_LLM_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ZENMUX_API_KEY;
  });

  afterEach(() => {
    process.env = env;
  });

  it("disables LLM by default without keys", () => {
    expect(isPaperLabLlmEnabled()).toBe(false);
    expect(getPaperLabExecutionMode().label).toBe("Rule Agents Active · LLM Disabled");
  });

  it("stays disabled when flag false even with keys", () => {
    process.env.PAPER_LAB_LLM_ENABLED = "false";
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isPaperLabLlmEnabled()).toBe(false);
  });

  it("enables only when flag true and key present", () => {
    process.env.PAPER_LAB_LLM_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isPaperLabLlmEnabled()).toBe(true);
    expect(getPaperLabExecutionMode().agentType).toBe("llm");
  });

  it("does not enable with flag true but no keys", () => {
    process.env.PAPER_LAB_LLM_ENABLED = "true";
    expect(isPaperLabLlmEnabled()).toBe(false);
  });
});
