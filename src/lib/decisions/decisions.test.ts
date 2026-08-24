import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decideMarketRisk } from "./d0-market-risk";
import { decideVisibility } from "./d1-visibility";
import { decideFeasibility } from "./d2-feasibility";
import { decideRanking, toRankingInput } from "./d3-ranking";
import { decideSizing, M1_REACHABLE_ELIGIBILITY, M1_UNREACHABLE_ELIGIBILITY } from "./d4-sizing";
import { decideStance } from "./d5-stance";
import { runShadowDecisions, runShadowSafely, type ShadowCandidateInput } from "./run-shadow";
import { CONTRACT_ASSERTIONS_HOLD, type SizingInput } from "./contracts";
import { DIVERGENCE_CLASSIFICATION, classifyDivergence } from "./shadow-record";
import type { Gate2RankComponents } from "@/lib/scanner/gate2/rank-components";

const RANK: Gate2RankComponents = {
  volumeTerm: 1500, extensionTerm: 200, maDistanceTerm: 300, depthPenalty: 50, rankScore: 1950,
  inputs: { volRatio: 1.5, extensionPct: 2, maDistancePct: 6, depthFrac: 0.25 },
};

function candidate(over: Partial<ShadowCandidateInput> = {}): ShadowCandidateInput {
  return {
    symbol: "AAA",
    session: "2024-03-04",
    gate1Level: "PASS",
    quality: "A",
    validity: "VALID",
    entryPriceKVnd: 20,
    structuralStopKVnd: 18.6,
    atrKVnd: 0.5,
    board: "HOSE",
    avgDailyValueVnd: 5_000_000_000,
    rankComponents: RANK,
    accountEquityVnd: 1_000_000_000,
    portfolioOpenRiskVnd: null,
    volumePrimitives: { gate2VolRatioMedian: 1.8, contextVolRatioMean: 1.6, sameSideOf1_5Cutoff: true },
    ...over,
  };
}

describe("contract enforcement", () => {
  it("compile-time forbidden-read assertions are present and hold", () => {
    // The real enforcement is `tsc`: adding a banned field to a contract makes
    // the corresponding `Forbidden<...>` resolve to `never`, and the assignment
    // of `true` stops compiling. Verified by deliberately smuggling `quality`
    // into VisibilityInput, which produced TS2322 at contracts.ts:191.
    expect(CONTRACT_ASSERTIONS_HOLD).toBe(true);
  });

  it("no decision module reads `quality` — only the legacy adapter does", () => {
    const dir = join(process.cwd(), "src", "lib", "decisions");
    for (const f of ["d0-market-risk.ts", "d1-visibility.ts", "d2-feasibility.ts", "d3-ranking.ts", "d4-sizing.ts", "d5-stance.ts"]) {
      const src = readFileSync(join(dir, f), "utf-8");
      // strip comments before searching, so prose about `quality` does not count
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, `${f} must not reference quality`).not.toMatch(/\bquality\b/);
    }
  });

  it("D5 imports no upstream decision module — anti-circularity by module graph", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "decisions", "d5-stance.ts"), "utf-8");
    for (const upstream of ["d0-market-risk", "d1-visibility", "d2-feasibility", "d3-ranking", "d4-sizing", "run-shadow"]) {
      expect(src, `d5 must not import ${upstream}`).not.toContain(upstream);
    }
  });

  it("no decision imports another decision — only the orchestrator composes them", () => {
    const dir = join(process.cwd(), "src", "lib", "decisions");
    const decisions = ["d0-market-risk", "d1-visibility", "d2-feasibility", "d3-ranking", "d4-sizing", "d5-stance"];
    for (const f of decisions) {
      const src = readFileSync(join(dir, `${f}.ts`), "utf-8");
      const localImports = [...src.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      // `contracts` is the shared vocabulary and is allowed; anything else would
      // make one decision depend on another's result.
      expect(localImports.filter((x) => x !== "contracts"), `${f} imports a sibling decision`).toEqual([]);
    }
  });

  it("contains no unsafe casts that could defeat the typed narrowing", () => {
    const dir = join(process.cwd(), "src", "lib", "decisions");
    for (const f of ["contracts.ts", "d0-market-risk.ts", "d1-visibility.ts", "d2-feasibility.ts", "d3-ranking.ts", "d4-sizing.ts", "d5-stance.ts", "run-shadow.ts"]) {
      const src = readFileSync(join(dir, f), "utf-8");
      expect(src, `${f} must not use 'as any'`).not.toMatch(/\bas any\b/);
      expect(src, `${f} must not suppress type errors`).not.toMatch(/@ts-(ignore|expect-error)/);
    }
  });

  it("the divergence taxonomy is frozen and complete", () => {
    expect(Object.keys(DIVERGENCE_CLASSIFICATION).sort()).toEqual([
      "FEASIBILITY_DIVERGENCE", "MISSING_INPUT", "RANKING_INPUT_DIVERGENCE",
      "SIZING_DIVERGENCE", "STANCE_DIVERGENCE", "VISIBILITY_DIVERGENCE",
      "VOLUME_PRIMITIVE_DIVERGENCE",
    ]);
    expect(classifyDivergence("SOMETHING_INVENTED_LATER")).toBe("UNCLASSIFIED");
  });
});

describe("invariants", () => {
  it("I1 — changing ranking input does not change validity or visibility", () => {
    const a = runShadowDecisions(candidate());
    const b = runShadowDecisions(candidate({
      rankComponents: { ...RANK, volumeTerm: 999_999, rankScore: 999_999 },
    }));
    expect(b.d3Ranking.score).not.toBe(a.d3Ranking.score);
    expect(b.d1Visibility).toEqual(a.d1Visibility);
    expect(b.d2Feasibility).toEqual(a.d2Feasibility);
  });

  it("I2 — changing sizing inputs does not change visibility", () => {
    const base = runShadowDecisions(candidate());
    for (const equity of [null, 1, 10_000_000_000]) {
      const v = runShadowDecisions(candidate({ accountEquityVnd: equity }));
      expect(v.d1Visibility).toEqual(base.d1Visibility);
    }
  });

  it("I3 — visibility outcome never changes the structural stop", () => {
    const shown = candidate();
    const hidden = candidate({ validity: "NOT_A_SETUP" });
    const a = runShadowDecisions(shown);
    const b = runShadowDecisions(hidden);
    expect(a.d1Visibility.decision).toBe("SHOWN");
    expect(b.d1Visibility.decision).toBe("HIDDEN");
    // the stop is an input; D1 has no channel to alter it and the risk fraction
    // computed from it is identical in both
    expect(b.d2Feasibility.riskFracOfEntry).toBe(a.d2Feasibility.riskFracOfEntry);
  });

  it("I4 — market risk class never changes validity or feasibility", () => {
    const pass = runShadowDecisions(candidate({ gate1Level: "PASS" }));
    for (const g of ["WARNING", "FAIL"] as const) {
      const r = runShadowDecisions(candidate({ gate1Level: g }));
      expect(r.d2Feasibility).toEqual(pass.d2Feasibility);
      expect(r.d1Visibility).toEqual(pass.d1Visibility);
    }
  });

  it("I5 — no stock attribute changes the market risk class", () => {
    const base = decideMarketRisk({ gate1Level: "WARNING" });
    // D0's input type has no stock field at all, so this is enforced by the
    // compiler; the runtime check confirms the mapping is a pure function of it.
    expect(decideMarketRisk({ gate1Level: "WARNING" })).toEqual(base);
    expect(base.usage).toBe("SHADOW_ONLY");
  });

  it("I6 — VALID + NOT_FEASIBLE is reachable", () => {
    const r = runShadowDecisions(candidate({ structuralStopKVnd: 19.99, atrKVnd: 0.5 }));
    expect(r.d2Feasibility.verdict).toBe("NOT_FEASIBLE_NOISE");
    expect(r.divergences.some((d) => d.code === "FEASIBILITY_DIVERGENCE")).toBe(true);
  });

  it("I7 — SHOWN while the market grants no budget is reachable", () => {
    const r = runShadowDecisions(candidate({ gate1Level: "FAIL" }));
    expect(r.d1Visibility.decision).toBe("SHOWN");
    expect(r.d0MarketRisk.riskClass).toBe("NONE");
    expect(r.d4Sizing.eligibility).toBe("NOT_ELIGIBLE_NO_BUDGET");
  });

  it("I8 — a probe-like stance does not require the normal risk class", () => {
    const probe = decideStance({
      marketRiskClass: "REDUCED",
      counts: { shown: 3, hidden: 1, feasible: 2 },
      aggregateOpenRiskVnd: null,
    });
    expect(probe.stance).toBe("PROBE");
  });

  it("I9 — duplicate primitive paths in ranking are reported, not hidden", () => {
    const clean = decideRanking(toRankingInput(RANK));
    expect(clean.duplicatedSources).toEqual([]);
    const dirty = decideRanking({
      terms: [
        { name: "a", value: 1, source: "volRatioMedian" },
        { name: "b", value: 2, source: "volRatioMedian" },
      ],
    });
    expect(dirty.duplicatedSources).toEqual(["volRatioMedian"]);
  });

  it("I10 — D4 emits no order, and says so in the value", () => {
    expect(runShadowDecisions(candidate()).d4Sizing.emitsOrder).toBe(false);
    expect(decideSizing({
      structuralRiskPerShareKVnd: 1, entryPriceKVnd: 20, marketRiskClass: "NORMAL",
      portfolioOpenRiskVnd: null, accountEquityVnd: null,
    }).emitsOrder).toBe(false);
  });

  it("I11 — D2 is order-independent and a pure function of one candidate", () => {
    const inputs = [candidate(), candidate({ entryPriceKVnd: 30, structuralStopKVnd: 27 }), candidate({ symbol: "BBB" })];
    const forward = inputs.map((c) => decideFeasibility({
      entryPriceKVnd: c.entryPriceKVnd, structuralStopKVnd: c.structuralStopKVnd,
      atrKVnd: c.atrKVnd, board: c.board, avgDailyValueVnd: c.avgDailyValueVnd,
    }));
    const backward = [...inputs].reverse().map((c) => decideFeasibility({
      entryPriceKVnd: c.entryPriceKVnd, structuralStopKVnd: c.structuralStopKVnd,
      atrKVnd: c.atrKVnd, board: c.board, avgDailyValueVnd: c.avgDailyValueVnd,
    })).reverse();
    expect(backward).toEqual(forward);
  });
});

describe("runtime narrowing, not just type narrowing", () => {
  it("the orchestrator builds every decision input field-by-field, never by spread", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "decisions", "run-shadow.ts"), "utf-8");
    // A spread would carry the whole candidate into a narrow contract at runtime,
    // defeating the typed isolation even though `tsc` stays happy.
    const calls = [...src.matchAll(/decide[A-Z]\w*\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c, `spread into ${c.slice(0, 24)}...`).not.toContain("...");
  });

  it("the sizing input retained in the record carries exactly the contract keys", () => {
    const rec = runShadowDecisions(candidate());
    expect(Object.keys(rec.d4Sizing.inputs).sort()).toEqual([
      "accountEquityVnd", "entryPriceKVnd", "marketRiskClass",
      "portfolioOpenRiskVnd", "structuralRiskPerShareKVnd",
    ]);
    expect(rec.d4Sizing.inputs).not.toHaveProperty("quality");
    expect(rec.d4Sizing.inputs).not.toHaveProperty("symbol");
  });

  it("no narrowing cast is used to force a wide object into a contract", () => {
    const dir = join(process.cwd(), "src", "lib", "decisions");
    for (const f of ["run-shadow.ts", "legacy-adapter.ts"]) {
      const src = readFileSync(join(dir, f), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const contract of ["MarketRiskInput", "VisibilityInput", "FeasibilityInput", "RankingInput", "SizingInput", "StanceInput"]) {
        expect(src, `${f} casts into ${contract}`).not.toMatch(new RegExp(`as\\s+${contract}\\b`));
      }
    }
  });

  it("the pipeline is fully synchronous — nothing to reject unhandled", () => {
    const out = runShadowDecisions(candidate());
    expect(out).not.toBeInstanceOf(Promise);
    const src = readFileSync(join(process.cwd(), "src", "lib", "decisions", "run-shadow.ts"), "utf-8");
    expect(src).not.toMatch(/\basync\b|\bawait\b|new Promise/);
  });

  it("D4's capacity verdict is unreachable in M1, deliberately and testably", () => {
    // Deciding capacity needs a risk fraction, and choosing one is the parameter
    // selection M1 forbids. The branch is declared but must never fire.
    const cases: SizingInput[] = [
      { structuralRiskPerShareKVnd: 1.4, entryPriceKVnd: 20, marketRiskClass: "NORMAL", portfolioOpenRiskVnd: null, accountEquityVnd: null },
      { structuralRiskPerShareKVnd: 1.4, entryPriceKVnd: 20, marketRiskClass: "REDUCED", portfolioOpenRiskVnd: 0, accountEquityVnd: 1 },
      { structuralRiskPerShareKVnd: 1.4, entryPriceKVnd: 20, marketRiskClass: "NONE", portfolioOpenRiskVnd: 9e12, accountEquityVnd: 9e12 },
      { structuralRiskPerShareKVnd: 0, entryPriceKVnd: 20, marketRiskClass: "NORMAL", portfolioOpenRiskVnd: null, accountEquityVnd: null },
    ];
    for (const c of cases) {
      const e = decideSizing(c).eligibility;
      expect(M1_REACHABLE_ELIGIBILITY).toContain(e);
      expect(M1_UNREACHABLE_ELIGIBILITY).not.toContain(e);
    }
  });
});

describe("shadow isolation", () => {
  it("is pure — repeated calls with equal input give equal output", () => {
    expect(runShadowDecisions(candidate())).toEqual(runShadowDecisions(candidate()));
  });

  it("fails open — a throw inside the pipeline is returned as a value", () => {
    const poisoned = candidate();
    Object.defineProperty(poisoned, "gate1Level", {
      get() { throw new Error("shadow exploded"); },
    });
    const r = runShadowSafely(poisoned);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("shadow exploded");
  });

  it("emits no order and mutates nothing it was given", () => {
    const input = candidate();
    const frozen = JSON.stringify(input);
    const rec = runShadowDecisions(input);
    expect(JSON.stringify(input)).toBe(frozen);
    expect(rec.d4Sizing.emitsOrder).toBe(false);
  });

  it("the visibility divergence with V1 is present, classified, and explained", () => {
    // WARNING x B: V1 hides it; the shadow contract cannot see either input V1 used
    const r = runShadowDecisions(candidate({ gate1Level: "WARNING", quality: "B" }));
    expect(r.legacy.visibility).toBe("HIDDEN");
    expect(r.d1Visibility.decision).toBe("SHOWN");
    const d = r.divergences.find((x) => x.code === "VISIBILITY_DIVERGENCE");
    expect(d).toBeDefined();
    expect(d!.classification).toBe("EXPECTED");
    expect(d!.decision).toBe("D1");
    expect(d!.reason).toBe("v1_hid_on_gate1_x_quality_shadow_has_neither_input");
  });
});

describe("D5 composes and cannot gate", () => {
  it("returns NO_TRADE when the market grants nothing, whatever the counts", () => {
    expect(decideStance({
      marketRiskClass: "NONE", counts: { shown: 99, hidden: 0, feasible: 99 }, aggregateOpenRiskVnd: null,
    }).stance).toBe("NO_TRADE");
  });
  it("is a pure function of its three fields", () => {
    const i = { marketRiskClass: "NORMAL" as const, counts: { shown: 1, hidden: 0, feasible: 1 }, aggregateOpenRiskVnd: null };
    expect(decideStance(i)).toEqual(decideStance(i));
  });
});

describe("feasibility gate — visibility invariant (§6)", () => {
  // The feasibility label is observational. No setup may become shown or hidden
  // because a feasibility verdict changed. V1 visibility must remain a pure
  // function of (gate1Level, quality).
  it("V1 visibility is independent of the feasibility verdict", () => {
    const verdicts = [
      "FEASIBLE", "NOT_FEASIBLE_NOISE", "NOT_FEASIBLE_LIQUIDITY", "UNKNOWN_INPUT",
    ] as const;
    for (const gate1 of ["PASS", "WARNING", "FAIL"] as const) {
      for (const quality of ["A", "B"] as const) {
        const seen = new Set<string>();
        for (const v of verdicts) {
          // drive the whole pipeline with inputs that produce each verdict
          const c = candidate({
            gate1Level: gate1,
            quality,
            structuralStopKVnd: v === "NOT_FEASIBLE_NOISE" ? 19.99 : 18.6,
            avgDailyValueVnd: v === "NOT_FEASIBLE_LIQUIDITY" ? 1_000 : 5_000_000_000,
            entryPriceKVnd: v === "UNKNOWN_INPUT" ? 0 : 20,
          });
          seen.add(runShadowDecisions(c).legacy.visibility);
        }
        expect(seen.size, `V1 visibility moved for ${gate1}/${quality}`).toBe(1);
      }
    }
  });

  it("V1 visibility is reproduced by (gate1Level, quality) alone", () => {
    const expected: Record<string, "SHOWN" | "HIDDEN"> = {
      "PASS/A": "SHOWN", "PASS/B": "SHOWN",
      "WARNING/A": "SHOWN", "WARNING/B": "HIDDEN",
      "FAIL/A": "HIDDEN", "FAIL/B": "HIDDEN",
    };
    for (const gate1 of ["PASS", "WARNING", "FAIL"] as const) {
      for (const quality of ["A", "B"] as const) {
        const r = runShadowDecisions(candidate({ gate1Level: gate1, quality }));
        expect(r.legacy.visibility, `${gate1}/${quality}`).toBe(expected[`${gate1}/${quality}`]);
      }
    }
  });
});
