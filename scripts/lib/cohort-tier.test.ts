import { describe, expect, it } from "vitest";
import {
  normalizeCohortTier,
  resolveTierSymbols,
  validateTierSymbolsOffline,
} from "./cohort-tier";

const doc = {
  baselineActiveSymbols: ["AAA", "BBB"],
  additiveSymbols: ["HDB", "GEX", "VCG", "VNM"],
  additiveByTier: { tierA: ["HDB", "GEX"], tierB: ["VCG", "VNM"] },
};

describe("cohort-tier", () => {
  it("normalizes tier aliases", () => {
    expect(normalizeCohortTier("a")).toBe("a");
    expect(normalizeCohortTier("B")).toBe("b");
    expect(normalizeCohortTier("all")).toBe("all");
    expect(normalizeCohortTier("full_additive")).toBe("all");
  });

  it("rejects unknown tier", () => {
    expect(() => normalizeCohortTier("z")).toThrow(/Unknown tier/);
  });

  it("resolves tier a, b, and all symbol lists", () => {
    expect(resolveTierSymbols(doc, "a")).toEqual(["HDB", "GEX"]);
    expect(resolveTierSymbols(doc, "b")).toEqual(["VCG", "VNM"]);
    expect(resolveTierSymbols(doc, "all")).toEqual(["HDB", "GEX", "VCG", "VNM"]);
  });

  it("detects duplicates and baseline overlap offline", () => {
    const dup = {
      ...doc,
      additiveByTier: { tierA: ["HDB", "HDB"], tierB: ["VCG"] },
    };
    const v = validateTierSymbolsOffline(dup, "a");
    expect(v.duplicateSymbols).toEqual(["HDB"]);

    const overlap = {
      baselineActiveSymbols: ["HDB"],
      additiveSymbols: ["HDB", "GEX"],
      additiveByTier: { tierA: ["HDB", "GEX"], tierB: [] },
    };
    const o = validateTierSymbolsOffline(overlap, "a");
    expect(o.baselineOverlap).toEqual(["HDB"]);
  });
});
