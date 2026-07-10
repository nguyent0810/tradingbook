import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOCATION_WEIGHTS,
  ALLOC_CAP_PCT,
  ALLOC_FLOOR_PCT,
  computeAllocationProposal,
  computeManagerScorecard,
  computeTwrSeries,
  type Scorecard,
} from "@/lib/paper-lab/dna/allocation";

function sc(slug: string, o: Partial<Scorecard>): Scorecard {
  return { slug, sessions: 63, eligible: true, cumulativeTwr: 0.1, annualizedTwr: 0.4, maxDrawdownPct: 0.1, calmar: 1, sharpe: 1, consistency: 0.5, riskDiscipline: 0.5, attributionQuality: 0.5, dataQualityConfidence: 1, latestNavVnd: 500_000_000, ...o };
}
const NINE = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"];
const equalCurrent = new Map(NINE.map((s) => [s, 1 / 9] as const));

describe("TWR fairness (flow-neutral)", () => {
  it("zero-flow TWR reconciles to ordinary return", () => {
    const t = computeTwrSeries([{ navVnd: 100, flowVnd: 0 }, { navVnd: 110, flowVnd: 0 }, { navVnd: 121, flowVnd: 0 }]);
    expect(t.cumulativeTwr).toBeCloseTo(0.21); // 121/100 - 1
  });
  it("a capital inflow changes NAV but not TWR", () => {
    const noFlow = computeTwrSeries([{ navVnd: 100, flowVnd: 0 }, { navVnd: 110, flowVnd: 0 }, { navVnd: 121, flowVnd: 0 }]).cumulativeTwr;
    const withFlow = computeTwrSeries([{ navVnd: 100, flowVnd: 0 }, { navVnd: 110, flowVnd: 0 }, { navVnd: 231, flowVnd: 100 }]).cumulativeTwr;
    expect(withFlow).toBeCloseTo(noFlow); // NAV 231 vs 121, but same 21% TWR
  });
  it("same performance at different capital sizes yields the same TWR", () => {
    const small = computeTwrSeries([{ navVnd: 100, flowVnd: 0 }, { navVnd: 110, flowVnd: 0 }, { navVnd: 121, flowVnd: 0 }]).cumulativeTwr;
    const large = computeTwrSeries([{ navVnd: 200, flowVnd: 0 }, { navVnd: 220, flowVnd: 0 }, { navVnd: 242, flowVnd: 0 }]).cumulativeTwr;
    expect(small).toBeCloseTo(large);
  });
});

describe("scorecard", () => {
  it("weights sum to 1 and avoid raw-return dominance", () => {
    expect(Object.values(ALLOCATION_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(ALLOCATION_WEIGHTS.twr).toBeLessThanOrEqual(0.2);
  });
  it("flags insufficient history as ineligible", () => {
    const short = computeManagerScorecard({ slug: "x", navSeries: Array.from({ length: 10 }, (_, i) => 500 + i) });
    expect(short.eligible).toBe(false);
    const ok = computeManagerScorecard({ slug: "y", navSeries: Array.from({ length: 40 }, (_, i) => 500 + i) });
    expect(ok.eligible).toBe(true);
  });
  it("handles missing attribution deterministically (neutral 0.5)", () => {
    const s = computeManagerScorecard({ slug: "z", navSeries: Array.from({ length: 40 }, (_, i) => 500 + i), attribution: null });
    expect(s.attributionQuality).toBe(0.5);
  });
  it("a strong return with severe drawdown does not automatically rank first", () => {
    const cards = [
      sc("bigReturnBigDD", { cumulativeTwr: 0.6, calmar: 0.2, sharpe: 0.4, consistency: 0.3, riskDiscipline: 0.3, attributionQuality: 0.3, maxDrawdownPct: 0.45 }),
      sc("modReturnLowDD", { cumulativeTwr: 0.2, calmar: 2.5, sharpe: 1.8, consistency: 0.8, riskDiscipline: 0.85, attributionQuality: 0.8, maxDrawdownPct: 0.05 }),
      ...NINE.slice(2).map((s) => sc(s, {})),
    ];
    const props = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
    const big = props.find((p) => p.slug === "bigReturnBigDD")!;
    const mod = props.find((p) => p.slug === "modReturnLowDD")!;
    expect(mod.rank).toBeLessThan(big.rank);
    expect(mod.proposedPct).toBeGreaterThan(big.proposedPct);
  });
});

describe("allocation math", () => {
  const cards = NINE.map((s, i) => sc(s, { cumulativeTwr: 0.05 * i, calmar: 0.2 * i, sharpe: 0.1 * i, consistency: 0.1 * i, riskDiscipline: 0.1 * i, attributionQuality: 0.1 * i }));
  const props = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
  it("respects the floor and cap", () => {
    for (const p of props) { expect(p.proposedPct).toBeGreaterThanOrEqual(ALLOC_FLOOR_PCT - 1e-9); expect(p.proposedPct).toBeLessThanOrEqual(ALLOC_CAP_PCT + 1e-9); }
  });
  it("sums to exactly 100%", () => {
    expect(props.reduce((s, p) => s + p.proposedPct, 0)).toBeCloseTo(1, 9);
  });
  it("has no negative allocations and no manager disappears", () => {
    expect(props.length).toBe(9);
    for (const p of props) expect(p.proposedPct).toBeGreaterThan(0);
  });
  it("ranks are unique 1..9", () => {
    expect(new Set(props.map((p) => p.rank))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });
});

describe("skill vs capital + determinism", () => {
  it("does not favor a larger NAV with weaker TWR", () => {
    const cards = [
      sc("bigNavWeak", { cumulativeTwr: 0.05, calmar: 0.3, sharpe: 0.3, consistency: 0.3, latestNavVnd: 2_000_000_000 }),
      sc("smallNavStrong", { cumulativeTwr: 0.4, calmar: 2, sharpe: 1.5, consistency: 0.8, riskDiscipline: 0.8, attributionQuality: 0.8, latestNavVnd: 100_000_000 }),
      ...NINE.slice(2).map((s) => sc(s, {})),
    ];
    const props = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
    expect(props.find((p) => p.slug === "smallNavStrong")!.proposedPct).toBeGreaterThan(props.find((p) => p.slug === "bigNavWeak")!.proposedPct);
  });
  it("applies a return hurdle so a near-flat cash-parker cannot outrank a genuine performer", () => {
    // A: near-flat but ultra-smooth (great risk-adjusted metrics, negligible return).
    // B: genuine positive return with solid metrics. B must outrank A.
    const cards = [
      sc("cashParker", { cumulativeTwr: 0.004, calmar: 5, sharpe: 2, consistency: 0.95, riskDiscipline: 0.9, attributionQuality: 0.8 }),
      sc("genuine", { cumulativeTwr: 0.15, calmar: 3, sharpe: 1.4, consistency: 0.75, riskDiscipline: 0.8, attributionQuality: 0.7 }),
      ...NINE.slice(2).map((s) => sc(s, { cumulativeTwr: 0.08 })),
    ];
    const props = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
    expect(props.find((p) => p.slug === "genuine")!.rank).toBeLessThan(props.find((p) => p.slug === "cashParker")!.rank);
    expect(props.find((p) => p.slug === "genuine")!.proposedPct).toBeGreaterThan(props.find((p) => p.slug === "cashParker")!.proposedPct);
  });
  it("is order-independent (deterministic)", () => {
    const cards = NINE.map((s, i) => sc(s, { calmar: i }));
    const a = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
    const b = computeAllocationProposal([...cards].reverse(), { currentAllocation: equalCurrent });
    const map = (ps: typeof a) => Object.fromEntries(ps.map((p) => [p.slug, p.proposedPct]));
    expect(map(a)).toEqual(map(b));
  });
  it("gives ineligible managers the floor with an INSUFFICIENT_TRACK_RECORD reason", () => {
    const cards = [sc("newbie", { eligible: false }), ...NINE.slice(1).map((s) => sc(s, { calmar: 2 }))];
    const props = computeAllocationProposal(cards, { currentAllocation: equalCurrent });
    const n = props.find((p) => p.slug === "newbie")!;
    expect(n.reasonCodes).toContain("ALLOC_INSUFFICIENT_TRACK_RECORD");
    expect(n.proposedPct).toBeCloseTo(ALLOC_FLOOR_PCT, 6);
  });
  it("imports no LLM client in the allocation modules", () => {
    const dir = join(process.cwd(), "src", "lib", "paper-lab", "dna");
    for (const f of readdirSync(dir).filter((x) => x.startsWith("allocation") && x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const imports = [...readFileSync(join(dir, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const s of imports) expect(/openai|anthropic|llm/i.test(s), `${f} imports ${s}`).toBe(false);
    }
  });
});
