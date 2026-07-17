import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EvidenceChipDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardEvidenceCompact } from "./dashboard-evidence-compact";

function chip(overrides: Partial<EvidenceChipDto> = {}): EvidenceChipDto {
  return {
    id: "gate1",
    label: "Gate 1",
    display: "Favorable",
    provenance: "real",
    ...overrides,
  };
}

describe("DashboardEvidenceCompact chip tone coloring", () => {
  it("colors a favorable gate1 chip safe (green)", () => {
    const html = renderToStaticMarkup(
      <DashboardEvidenceCompact chips={[chip({ id: "gate1", display: "Favorable" })]} />
    );
    expect(html).toContain("dash-hint-chip--safe");
  });

  it("colors a hostile gate1_live chip danger (red)", () => {
    const html = renderToStaticMarkup(
      <DashboardEvidenceCompact chips={[chip({ id: "gate1_live", display: "Hostile" })]} />
    );
    expect(html).toContain("dash-hint-chip--danger");
  });

  it("colors a caution gate1 chip warn (amber)", () => {
    const html = renderToStaticMarkup(
      <DashboardEvidenceCompact chips={[chip({ id: "gate1", display: "Caution" })]} />
    );
    expect(html).toContain("dash-hint-chip--warn");
  });

  it("colors a positive foreign-flow chip safe and a negative one danger", () => {
    const html = renderToStaticMarkup(
      <DashboardEvidenceCompact
        chips={[
          chip({ id: "market_foreign_1d", label: "Foreign 1D", display: "+12.4B" }),
          chip({ id: "market_foreign_5d", label: "Foreign 5D", display: "−8.1B" }),
        ]}
      />
    );
    expect(html).toContain("dash-hint-chip--safe");
    expect(html).toContain("dash-hint-chip--danger");
  });

  it("leaves unrelated chips (e.g. scan_at) untoned", () => {
    const html = renderToStaticMarkup(
      <DashboardEvidenceCompact chips={[chip({ id: "scan_at", label: "Scan at", display: "09:15" })]} />
    );
    expect(html).not.toContain("dash-hint-chip--safe");
    expect(html).not.toContain("dash-hint-chip--warn");
    expect(html).not.toContain("dash-hint-chip--danger");
  });
});
