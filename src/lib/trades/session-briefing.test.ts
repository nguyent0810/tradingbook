import { describe, expect, it } from "vitest";
import { buildSessionBriefing } from "./session-briefing";

describe("buildSessionBriefing", () => {
  it("returns null when no active opens", () => {
    expect(
      buildSessionBriefing({
        activeOpenCount: 0,
        urgentCount: 0,
        underPressureCount: 0,
        staleMarketOpenCount: 0,
        reviewsLoggedTodayCount: 0,
        plannedCapitalAtRiskTotal: null,
        partialRiskFigures: false,
        largestRiskPosition: null,
      })
    ).toBeNull();
  });

  it("summarizes counts and adds concentration when sleeve dominates sum", () => {
    const b = buildSessionBriefing({
      activeOpenCount: 3,
      urgentCount: 2,
      underPressureCount: 3,
      staleMarketOpenCount: 1,
      reviewsLoggedTodayCount: 2,
      plannedCapitalAtRiskTotal: 1000,
      partialRiskFigures: true,
      largestRiskPosition: { symbol: "AAA", amount: 400 },
    });
    expect(b).not.toBeNull();
    expect(b!.lines.some((l) => l.includes("3 active open positions"))).toBe(
      true
    );
    expect(b!.lines.some((l) => l.includes("2 urgent"))).toBe(true);
    expect(b!.lines.some((l) => l.includes("under pressure"))).toBe(true);
    expect(b!.lines.some((l) => l.toLowerCase().includes("stale"))).toBe(true);
    expect(b!.lines.some((l) => l.includes("reviewed today"))).toBe(true);
    expect(b!.lines.some((l) => l.includes("Planned capital at risk"))).toBe(
      true
    );
    expect(b!.lines.some((l) => l.includes("AAA"))).toBe(true);
    expect(b!.partialRiskFigures).toBe(true);
  });

  it("skips concentration line with only one active position", () => {
    const b = buildSessionBriefing({
      activeOpenCount: 1,
      urgentCount: 0,
      underPressureCount: 0,
      staleMarketOpenCount: 0,
      reviewsLoggedTodayCount: 1,
      plannedCapitalAtRiskTotal: 500,
      partialRiskFigures: false,
      largestRiskPosition: { symbol: "ZZZ", amount: 500 },
    });
    expect(b!.lines.some((l) => l.includes("Largest sleeve"))).toBe(false);
  });
});
