import { describe, expect, it } from "vitest";
import { deriveBookOperatingBalanceLines } from "./book-operating-balance";

describe("deriveBookOperatingBalanceLines", () => {
  it("flags defensive posture dominance", () => {
    const lines = deriveBookOperatingBalanceLines({
      activeOpenCount: 4,
      postureCounts: {
        stable: 0,
        cautious: 1,
        defensive: 2,
        high_attention: 1,
      },
      clusterCounts: {
        high_attention: 1,
        defensive: 1,
        cautious: 1,
        routine_pending: 0,
        stable_reviewed: 1,
      },
      concentration: {
        countWithRisk: 0,
        top1Share: null,
        top2Share: null,
        top1Symbol: null,
        top2Symbol: null,
        sumAtRisk: null,
      },
      previousStableClusterCount: null,
    });
    expect(
      lines.some((l) => l.toLowerCase().includes("dominate"))
    ).toBe(true);
  });

  it("notes stable cluster shrink vs prior snapshot", () => {
    const lines = deriveBookOperatingBalanceLines({
      activeOpenCount: 4,
      postureCounts: {
        stable: 2,
        cautious: 1,
        defensive: 0,
        high_attention: 1,
      },
      clusterCounts: {
        high_attention: 0,
        defensive: 0,
        cautious: 1,
        routine_pending: 1,
        stable_reviewed: 1,
      },
      concentration: {
        countWithRisk: 0,
        top1Share: null,
        top2Share: null,
        top1Symbol: null,
        top2Symbol: null,
        sumAtRisk: null,
      },
      previousStableClusterCount: 4,
    });
    expect(lines.some((l) => l.includes("shrank"))).toBe(true);
  });

  it("notes planned-risk concentration in two names", () => {
    const lines = deriveBookOperatingBalanceLines({
      activeOpenCount: 3,
      postureCounts: {
        stable: 1,
        cautious: 1,
        defensive: 0,
        high_attention: 1,
      },
      clusterCounts: {
        high_attention: 0,
        defensive: 0,
        cautious: 1,
        routine_pending: 1,
        stable_reviewed: 1,
      },
      concentration: {
        countWithRisk: 3,
        top1Share: 0.4,
        top2Share: 0.7,
        top1Symbol: "AAA",
        top2Symbol: "BBB",
        sumAtRisk: 1e9,
      },
      previousStableClusterCount: null,
    });
    expect(lines.some((l) => l.includes("AAA") && l.includes("BBB"))).toBe(
      true
    );
  });
});
