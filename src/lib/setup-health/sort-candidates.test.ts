import { describe, expect, it } from "vitest";
import { sortCandidatesWithHealth, type CandidateWithHealth } from "./sort-candidates";

function row(p: Partial<CandidateWithHealth> & Pick<CandidateWithHealth, "symbolKey">): CandidateWithHealth {
  return {
    symbolId: "id",
    close: 100,
    pullbackZoneLow: 94,
    pullbackZoneHigh: 98,
    lifecycleLabel: "WATCHING",
    healthLevel: "HEALTHY",
    healthScore: 100,
    ...p,
  };
}

describe("sortCandidatesWithHealth", () => {
  it("orders READY before WATCHING", () => {
    const sorted = sortCandidatesWithHealth([
      row({ symbolKey: "B", lifecycleLabel: "WATCHING" }),
      row({ symbolKey: "A", lifecycleLabel: "READY" }),
    ]);
    expect(sorted.map((s) => s.symbolKey)).toEqual(["A", "B"]);
  });

  it("then sorts by distanceToZone ascending", () => {
    const sorted = sortCandidatesWithHealth([
      row({ symbolKey: "Far", close: 110 }),
      row({ symbolKey: "Near", close: 99 }),
    ]);
    expect(sorted.map((s) => s.symbolKey)).toEqual(["Near", "Far"]);
  });

  it("then healthLevel HEALTHY → DEAD", () => {
    const sorted = sortCandidatesWithHealth([
      row({ symbolKey: "Risk", healthLevel: "AT_RISK", healthScore: 90 }),
      row({ symbolKey: "Ok", healthLevel: "WARNING", healthScore: 80 }),
    ]);
    expect(sorted.map((s) => s.symbolKey)).toEqual(["Ok", "Risk"]);
  });

  it("then healthScore descending", () => {
    const sorted = sortCandidatesWithHealth([
      row({
        symbolKey: "Lo",
        healthLevel: "WARNING",
        healthScore: 70,
      }),
      row({
        symbolKey: "Hi",
        healthLevel: "WARNING",
        healthScore: 85,
      }),
    ]);
    expect(sorted.map((s) => s.symbolKey)).toEqual(["Hi", "Lo"]);
  });
});
