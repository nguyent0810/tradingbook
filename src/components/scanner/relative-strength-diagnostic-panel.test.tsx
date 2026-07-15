import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import { RelativeStrengthDiagnosticPanel } from "./relative-strength-diagnostic-panel";

function diagnostic(overrides: Partial<RsDiagnosticUi> = {}): RsDiagnosticUi {
  return {
    summary: "RS20 +15.09pp · RS50 +34.81pp · stock>MA50 only",
    lines: [
      "RS20: +15.09 pp vs VNINDEX — Outperforming VNINDEX over 20 sessions.",
      "RS50: +34.81 pp vs VNINDEX — Outperforming VNINDEX over 50 sessions.",
    ],
    disclaimer: "Relative strength is a context signal — it helps prioritize, but doesn't approve or rank a setup on its own.",
    rs20SpreadPct: 15.09,
    ...overrides,
  };
}

describe("RelativeStrengthDiagnosticPanel — detail prop", () => {
  it("renders summary, full lines, and disclaimer by default", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthDiagnosticPanel diagnostic={diagnostic()} />
    );

    expect(html).toContain('data-testid="rs-diagnostic-summary"');
    expect(html).toContain('data-testid="rs-diagnostic-line-rs20"');
    expect(html).toContain('data-testid="rs-diagnostic-disclaimer"');
  });

  it("renders only the summary line when detail is 'summary' — no full breakdown, no disclaimer", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthDiagnosticPanel diagnostic={diagnostic()} compact detail="summary" />
    );

    expect(html).toContain('data-testid="rs-diagnostic-summary"');
    expect(html).not.toContain('data-testid="rs-diagnostic-line-rs20"');
    expect(html).not.toContain('data-testid="rs-diagnostic-disclaimer"');
  });

  it("still renders full lines and disclaimer when detail is explicitly 'full'", () => {
    const html = renderToStaticMarkup(
      <RelativeStrengthDiagnosticPanel diagnostic={diagnostic()} detail="full" />
    );

    expect(html).toContain('data-testid="rs-diagnostic-line-rs20"');
    expect(html).toContain('data-testid="rs-diagnostic-disclaimer"');
  });
});
