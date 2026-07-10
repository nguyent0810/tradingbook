import { describe, expect, it } from "vitest";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { AGENT_DNA } from "@/lib/paper-lab/dna/manager-configs";
import { computeConfidenceBasis } from "@/lib/paper-lab/dna/confidence";

const conf = AGENT_DNA.aggressive_investor.confidence; // floor 0.35, ceil 0.9

function bundle(o: {
  quality?: "A" | "B" | "INVALID" | null;
  rs20?: number | null;
  volRatio?: number | null;
  gate1?: "PASS" | "WARNING" | "FAIL";
  trend?: string;
  regimeConf?: number;
  dual?: boolean;
}): MarketContextBundle {
  return {
    gate2Setup: o.quality ? { quality: o.quality } : null,
    relativeStrength:
      o.rs20 == null && o.dual == null
        ? null
        : { returns: o.rs20 != null ? [{ lookbackSessions: 20, rsSpreadPct: o.rs20 }] : [], dualUptrendMa50: !!o.dual },
    volume: { volRatioMa20: o.volRatio ?? null },
    marketRegime: {
      gate1Level: o.gate1 ?? "PASS",
      regimeConfidence: o.regimeConf,
      regimeDimensions: o.trend ? { trendRegime: o.trend } : undefined,
    },
  } as unknown as MarketContextBundle;
}

describe("computeConfidenceBasis", () => {
  it("is bounded by the manager's floor and ceil", () => {
    const weak = computeConfidenceBasis(bundle({ quality: null, gate1: "FAIL" }), conf);
    const strong = computeConfidenceBasis(
      bundle({ quality: "A", rs20: 8, volRatio: 3, gate1: "PASS", trend: "StrongBull", regimeConf: 1, dual: true }),
      conf
    );
    expect(weak.confidence).toBeGreaterThanOrEqual(conf.floor);
    expect(strong.confidence).toBeLessThanOrEqual(conf.ceil);
    expect(weak.confidence).toBeCloseTo(conf.floor); // score 0 → floor
  });

  it("increases monotonically with stronger inputs", () => {
    const weak = computeConfidenceBasis(bundle({ quality: null, gate1: "FAIL" }), conf).confidence;
    const mid = computeConfidenceBasis(bundle({ quality: "B", rs20: 2, volRatio: 1.5, gate1: "WARNING", trend: "Sideways", regimeConf: 0.6 }), conf).confidence;
    const strong = computeConfidenceBasis(bundle({ quality: "A", rs20: 8, volRatio: 3, gate1: "PASS", trend: "StrongBull", regimeConf: 1, dual: true }), conf).confidence;
    expect(mid).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(mid);
  });

  it("is not the legacy constant 0.65", () => {
    const strong = computeConfidenceBasis(bundle({ quality: "A", rs20: 8, volRatio: 3, gate1: "PASS", trend: "StrongBull", regimeConf: 1, dual: true }), conf).confidence;
    const weak = computeConfidenceBasis(bundle({ quality: null, gate1: "FAIL" }), conf).confidence;
    expect(strong).not.toBe(0.65);
    expect(weak).not.toBe(0.65);
    expect(strong).not.toBe(weak);
  });
});
