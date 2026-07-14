import { describe, expect, it } from "vitest";
import { deriveGate1SurfacingRule, filterCandidatesByGate1Level } from "./collect-candidates";
import type { SetupCandidate } from "./types";

const sample = (q: "A" | "B"): SetupCandidate => ({
  symbolId: "x",
  quality: q,
  close: 101,
  rankScore: 1,
  breakoutLevel: 100,
  pullbackZoneLow: 98,
  pullbackZoneHigh: 100,
  stopLevel: 95,
  reasons: [],
  barDate: new Date(Date.UTC(2024, 0, 1)),
});

describe("filterCandidatesByGate1Level", () => {
  it("FAIL removes all candidates", () => {
    expect(filterCandidatesByGate1Level("FAIL", [sample("A"), sample("B")])).toEqual([]);
  });

  it("WARNING keeps A only", () => {
    const r = filterCandidatesByGate1Level("WARNING", [sample("A"), sample("B")]);
    expect(r).toHaveLength(1);
    expect(r[0]!.quality).toBe("A");
  });

  it("PASS keeps A and B", () => {
    const r = filterCandidatesByGate1Level("PASS", [sample("A"), sample("B")]);
    expect(r).toHaveLength(2);
  });
});

describe("deriveGate1SurfacingRule", () => {
  it("maps FAIL/WARNING/PASS to none/tier-a-only/all", () => {
    expect(deriveGate1SurfacingRule("FAIL")).toBe("none");
    expect(deriveGate1SurfacingRule("WARNING")).toBe("tier-a-only");
    expect(deriveGate1SurfacingRule("PASS")).toBe("all");
  });
});
