import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import type { DashboardWatchlistItem } from "./dashboard-watchlist-panel";
import type { ActionableBlockerDto, ActionableDiagnosticsDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardSecondaryIntelligence } from "./dashboard-secondary-intelligence";

function watchItem(overrides: Partial<DashboardWatchlistItem> = {}): DashboardWatchlistItem {
  return {
    id: "w1",
    symbolId: "sym-mwg",
    lifecycleStatus: SetupLifecycleStatus.READY,
    healthLevel: "HEALTHY",
    pullbackZoneLow: 9.5,
    pullbackZoneHigh: 10.2,
    symbol: { symbol: "MWG" },
    ...overrides,
  };
}

function blocker(overrides: Partial<ActionableBlockerDto> = {}): ActionableBlockerDto {
  return {
    severity: "structure_broken",
    title: "RS breadth thin",
    meaning: "Fewer than half of tradable names show positive RS.",
    count: 41,
    sampleSymbols: ["ABC", "XYZ"],
    waitFor: "Breadth to improve above 50%.",
    provenance: "derived",
    ...overrides,
  };
}

const emptyDiagnostics: ActionableDiagnosticsDto = {
  blockers: [],
  maxShown: 5,
  emptyReason: "No daily scan yet.",
};

describe("DashboardSecondaryIntelligence", () => {
  it("shows the watchlist and blockers counts on the collapsed widget summary", () => {
    const html = renderToStaticMarkup(
      <DashboardSecondaryIntelligence
        diagnostics={{ ...emptyDiagnostics, blockers: [blocker(), blocker({ title: "Volume thin" })] }}
        watchItems={[watchItem(), watchItem({ id: "w2", symbol: { symbol: "FPT" } })]}
        latestCloseBySymbol={new Map([["sym-mwg", 10]])}
      />
    );

    expect(html).toContain('data-testid="dashboard-secondary-watchlist-widget"');
    expect(html).toContain('data-testid="dashboard-secondary-blockers-widget"');
    expect(html).toContain(">2<");
    expect(html).toContain("MWG");
    expect(html).toContain("RS breadth thin");
  });

  it("still renders the full watchlist table and blocker list in static markup (expand-in-place, not a dead link)", () => {
    const html = renderToStaticMarkup(
      <DashboardSecondaryIntelligence
        diagnostics={{ ...emptyDiagnostics, blockers: [blocker()] }}
        watchItems={[watchItem()]}
        latestCloseBySymbol={new Map()}
      />
    );

    expect(html).toContain('data-testid="dashboard-watchlist-panel"');
    expect(html).toContain('data-testid="dashboard-diagnostics-panel"');
  });

  it("renders empty-state copy when there are no watch items or blockers", () => {
    const html = renderToStaticMarkup(
      <DashboardSecondaryIntelligence
        diagnostics={emptyDiagnostics}
        watchItems={[]}
        latestCloseBySymbol={new Map()}
      />
    );

    expect(html).toContain("No active watch items.");
    expect(html).toContain(emptyDiagnostics.emptyReason!);
  });

  it("renders the numbered zone header matching the Opportunity board treatment", () => {
    const html = renderToStaticMarkup(
      <DashboardSecondaryIntelligence
        diagnostics={emptyDiagnostics}
        watchItems={[]}
        latestCloseBySymbol={new Map()}
      />
    );

    expect(html).toContain("dash-v2-zone-title");
    expect(html).toContain(">03<");
  });
});
