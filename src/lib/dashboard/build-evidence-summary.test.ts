import { describe, expect, it } from "vitest";
import { buildEvidenceSummaryLine } from "./build-evidence-summary";
import type { V3EvidenceItem } from "./dashboard-v3-view-model";

describe("buildEvidenceSummaryLine", () => {
  it("returns null outside PROTECT CAPITAL", () => {
    expect(buildEvidenceSummaryLine("TRADE", [])).toBeNull();
  });

  it("builds a compact summary from warn/danger evidence", () => {
    const evidence: V3EvidenceItem[] = [
      { label: "Market blockers", value: "Below long-term trend", state: "warn" },
      { label: "Foreign 1D", value: "−441.39B ₫ net", state: "danger" },
      { label: "Technical evidence", value: "Breakout failed to hold", state: "warn" },
    ];
    const line = buildEvidenceSummaryLine("PROTECT CAPITAL", evidence);
    expect(line).toMatch(/^Why no trade today:/);
    expect(line).toMatch(/foreign flow negative/);
    expect(line).not.toMatch(/Gate 2|rankScore|extension_cap/);
  });

  it("falls back when no warn/danger evidence", () => {
    const line = buildEvidenceSummaryLine("PROTECT CAPITAL", [
      { label: "Scanner diagnostics", value: "Aligned", state: "ok" },
    ]);
    expect(line).toMatch(/scanner blockers and market evidence support standing down/);
  });
});
