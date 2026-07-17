import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TomorrowPlanDto } from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardTomorrowPlan } from "./dashboard-tomorrow-plan";

function tomorrowDto(overrides: Partial<TomorrowPlanDto> = {}): TomorrowPlanDto {
  return {
    watchSymbols: { value: ["MWG", "FPT"], provenance: "derived" },
    watchNote: { value: null, provenance: "static_copy" },
    watchReasons: {
      MWG: "Cleared Tier A — strong health score.",
      FPT: "Near-miss — waiting on a pullback zone reclaim.",
    },
    triggerLine: { value: "Break above the pullback zone high on volume.", provenance: "derived" },
    avoidLine: { value: "Chasing extended names outside the zone.", provenance: "derived" },
    ...overrides,
  };
}

describe("DashboardTomorrowPlan", () => {
  it("renders a hoverable watch card per symbol with its reason in the static markup", () => {
    const html = renderToStaticMarkup(<DashboardTomorrowPlan tomorrow={tomorrowDto()} />);

    expect(html).toContain('data-testid="dashboard-tomorrow-watch"');
    expect(html).toContain("MWG");
    expect(html).toContain("FPT");
    expect(html).toContain("Cleared Tier A — strong health score.");
    expect(html).toContain("Near-miss — waiting on a pullback zone reclaim.");
  });

  it("renders the trigger and avoid blocks", () => {
    const html = renderToStaticMarkup(<DashboardTomorrowPlan tomorrow={tomorrowDto()} />);

    expect(html).toContain('data-testid="dashboard-tomorrow-trigger"');
    expect(html).toContain("Break above the pullback zone high on volume.");
    expect(html).toContain('data-testid="dashboard-tomorrow-avoid"');
    expect(html).toContain("Chasing extended names outside the zone.");
  });

  it("falls back to the watch note and a Setups link when there are no watch symbols", () => {
    const html = renderToStaticMarkup(
      <DashboardTomorrowPlan
        tomorrow={tomorrowDto({
          watchSymbols: { value: [], provenance: "derived" },
          watchNote: { value: "No names on watch this session.", provenance: "static_copy" },
        })}
      />
    );

    expect(html).toContain("No names on watch this session.");
    expect(html).toContain("Review /setups for pipeline context");
  });

  it("promoted variant keeps the compact dl layout without watch cards", () => {
    const html = renderToStaticMarkup(<DashboardTomorrowPlan tomorrow={tomorrowDto()} promoted />);

    expect(html).toContain("dash-tomorrow--promoted");
    expect(html).not.toContain("dash-sym-card");
  });

  it("non-promoted header uses the same zone-title hierarchy as Opportunity board (01)", () => {
    const html = renderToStaticMarkup(<DashboardTomorrowPlan tomorrow={tomorrowDto()} />);

    expect(html).toContain("dash-v2-zone-title");
    expect(html).toContain("dash-v2-eyebrow");
    expect(html).toContain(">02<");
  });
});
