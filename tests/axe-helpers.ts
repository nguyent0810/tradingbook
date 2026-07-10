import path from "node:path";
import type { Page } from "@playwright/test";

const AXE_SCRIPT = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

// Rules disabled with reasons — re-enable once addressed, do not silently drop findings.
const DISABLED_RULES: Record<string, string> = {
  "color-contrast":
    "Requires visual rendering fidelity not guaranteed in headless CI; spot-checked manually instead.",
};

export type AxeResult = {
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    nodes: Array<{ target: string[]; failureSummary?: string }>;
  }>;
};

export async function runAxe(page: Page): Promise<AxeResult> {
  await page.addScriptTag({ path: AXE_SCRIPT });
  return page.evaluate(
    (disabledRules) =>
      // @ts-expect-error injected by axe.min.js
      window.axe.run(document, {
        rules: Object.fromEntries(Object.keys(disabledRules).map((id) => [id, { enabled: false }])),
      }),
    DISABLED_RULES
  ) as Promise<AxeResult>;
}

export function formatViolations(result: AxeResult): string {
  return result.violations
    .map(
      (v) =>
        `[${v.impact ?? "unknown"}] ${v.id}: ${v.description}\n  targets: ${v.nodes
          .map((n) => n.target.join(" "))
          .join(", ")}`
    )
    .join("\n\n");
}

export function seriousViolations(result: AxeResult) {
  return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}
