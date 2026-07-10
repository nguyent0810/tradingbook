import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { computeTrailingUpdate } from "@/lib/paper-lab/engine/trailing";
import {
  computeCashDragVnd,
  computeTradeAttribution,
  type AttributionEntryDecisionInput,
  type ComputeAttributionInput,
} from "@/lib/paper-lab/dna/attribution";

const dna = getManagerDna("aggressive_investor")!;
type P = ComputeAttributionInput;
function attr(o: {
  trade?: Partial<P["trade"]>; position?: Partial<P["position"]>; ed?: AttributionEntryDecisionInput;
  regimeAtExit?: string | null; range?: { low: number; high: number } | null; post?: { high: number; low: number; close: number }[];
}) {
  const trade = { id: "t", entryKvnd: 20, exitKvnd: 24, quantity: 1000, realizedPnlVnd: 3_900_000, rMultiple: null as number | null, holdingDays: 10, exitReason: "TAKE_PROFIT_HIT", ...o.trade };
  const position = { id: "p", avgEntryKvnd: 20, stopLossKvnd: 18.5, initialRiskPerShareKvnd: 1.5, maxFavorableExcursionKvnd: 4.5, maxAdverseExcursionKvnd: 0.5, highWaterMarkKvnd: 24.5, ...o.position };
  return computeTradeAttribution({ trade, position, agentId: "a", dna, entryDecision: o.ed, regimeAtExit: o.regimeAtExit, entrySessionRange: o.range, postExitBars: o.post });
}

describe("MFE/MAE maintenance", () => {
  const base = { avgEntryKvnd: 20, stopLossKvnd: 18, initialRiskPerShareKvnd: 2, highWaterMarkKvnd: 20, trailingStopKvnd: 18, maxFavorableExcursionKvnd: 0, maxAdverseExcursionKvnd: 0, trailingEnabled: false, breakevenAtR: null };
  it("updates from the current bar high/low only", () => {
    const u = computeTrailingUpdate({ ...base, bar: { low: 19, high: 23, close: 21 } });
    expect(u.maxFavorableExcursionKvnd).toBe(3); // 23 - 20
    expect(u.maxAdverseExcursionKvnd).toBe(1); // 20 - 19
  });
  it("is monotonic (never decreases)", () => {
    const u = computeTrailingUpdate({ ...base, maxFavorableExcursionKvnd: 5, maxAdverseExcursionKvnd: 4, bar: { low: 19.5, high: 21, close: 20 } });
    expect(u.maxFavorableExcursionKvnd).toBe(5);
    expect(u.maxAdverseExcursionKvnd).toBe(4);
  });
  it("is null-safe for legacy positions", () => {
    const u = computeTrailingUpdate({ ...base, highWaterMarkKvnd: null, trailingStopKvnd: null, initialRiskPerShareKvnd: null, bar: { low: 19, high: 22, close: 21 } });
    expect(u.highWaterMarkKvnd).toBe(22);
    expect(u.maxFavorableExcursionKvnd).toBe(2);
  });
});

describe("entry attribution", () => {
  it("rewards entering near the session low over the high", () => {
    const good = attr({ trade: { entryKvnd: 19.6 }, range: { low: 19.5, high: 20.5 } }).entryQualityScore;
    const poor = attr({ trade: { entryKvnd: 20.4 }, range: { low: 19.5, high: 20.5 } }).entryQualityScore;
    expect(good).toBeGreaterThan(poor);
  });
  it("scores an A setup above a B setup", () => {
    expect(attr({ ed: { setupQuality: "A" } }).entryQualityScore).toBeGreaterThan(attr({ ed: { setupQuality: "B" } }).entryQualityScore);
  });
  it("penalizes high adverse excursion before profit", () => {
    const low = attr({ position: { maxAdverseExcursionKvnd: 0.2 } }).entryQualityScore;
    const high = attr({ position: { maxAdverseExcursionKvnd: 3 } }).entryQualityScore;
    expect(low).toBeGreaterThan(high);
  });
});

describe("holding attribution", () => {
  it("rewards high MFE capture, penalizes large giveback", () => {
    const highCapture = attr({ trade: { rMultiple: 2.67 }, position: { maxFavorableExcursionKvnd: 4.5 } }).holdingQualityScore;
    const lowCapture = attr({ trade: { rMultiple: 1 }, position: { maxFavorableExcursionKvnd: 9 } }).holdingQualityScore;
    expect(highCapture).toBeGreaterThan(lowCapture);
  });
});

describe("exit attribution", () => {
  it("ranks a clean target exit above time and stop exits", () => {
    const target = attr({ trade: { exitReason: "TAKE_PROFIT_HIT", exitKvnd: 24 }, position: { highWaterMarkKvnd: 24 } }).exitQualityScore;
    const time = attr({ trade: { exitReason: "TIME_EXIT", exitKvnd: 21, rMultiple: 0.67 }, position: { highWaterMarkKvnd: 21 } }).exitQualityScore;
    const stop = attr({ trade: { exitReason: "STOP_LOSS_HIT", exitKvnd: 18.5, rMultiple: -1, realizedPnlVnd: -1_600_000 }, position: { highWaterMarkKvnd: 20 } }).exitQualityScore;
    expect(target).toBeGreaterThan(time);
    expect(target).toBeGreaterThan(stop);
  });
  it("penalizes giveback from the high-water mark", () => {
    const clean = attr({ trade: { exitReason: "AGENT_EXIT", exitKvnd: 24 }, position: { highWaterMarkKvnd: 24 } }).exitQualityScore;
    const gaveback = attr({ trade: { exitReason: "AGENT_EXIT", exitKvnd: 21 }, position: { highWaterMarkKvnd: 24.5 } }).exitQualityScore;
    expect(clean).toBeGreaterThan(gaveback);
  });
  it("computes left-on-table only when the post-exit window is complete (no lookahead)", () => {
    const incomplete = attr({ post: [{ high: 25, low: 24, close: 24.5 }] }); // < 5 bars
    expect(incomplete.leftOnTablePct).toBeNull();
    const complete = attr({ trade: { exitKvnd: 24 }, post: Array.from({ length: 5 }, () => ({ high: 26.4, low: 25, close: 26 })) });
    expect(complete.leftOnTablePct).toBeCloseTo(0.1); // (26.4-24)/24
  });
});

describe("sizing attribution", () => {
  it("distinguishes confident winners from weak-confidence oversizing", () => {
    const confidentWin = attr({ ed: { confidence: 0.9 }, trade: { rMultiple: 2 } }).sizingQualityScore;
    const weakWin = attr({ ed: { confidence: 0.3 }, trade: { rMultiple: 2 } }).sizingQualityScore;
    expect(confidentWin).toBeGreaterThan(weakWin);
  });
  it("captures memory/psychology modulation from decision metadata", () => {
    const boostedWin = attr({ ed: { confidence: 0.7, riskMult: 1.3 }, trade: { rMultiple: 2 } }).sizingQualityScore;
    const neutralWin = attr({ ed: { confidence: 0.7, riskMult: 1 }, trade: { rMultiple: 2 } }).sizingQualityScore;
    expect(boostedWin).toBeGreaterThan(neutralWin);
  });
});

describe("regime & setup", () => {
  it("scores regime fit by preferred/avoided", () => {
    expect(attr({ ed: { regimeAtEntry: "StrongBull" } }).regimeFitScore).toBe(1);
    expect(attr({ ed: { regimeAtEntry: "StrongBear" } }).regimeFitScore).toBe(0);
    expect(attr({ ed: { regimeAtEntry: "Sideways" } }).regimeFitScore).toBe(0.5);
  });
  it("tags the setup type from the manager archetype", () => {
    expect(attr({}).setupType).toBe("breakout_hunter");
  });
});

describe("cash drag", () => {
  it("is negative (drag) in a rising benchmark, positive (protection) in a falling one, zero flat", () => {
    expect(computeCashDragVnd(0.3, 5, 500_000_000)).toBeLessThan(0);
    expect(computeCashDragVnd(0.3, -5, 500_000_000)).toBeGreaterThan(0);
    expect(computeCashDragVnd(0.3, 0, 500_000_000)).toBe(0);
  });
});

describe("reconciliation, determinism, no-LLM", () => {
  it("monetary contributions reconcile to realized P&L (gross - fees == realized)", () => {
    const r = attr({});
    expect(r.grossPriceMoveVnd - r.feesVnd).toBe(r.realizedPnlVnd);
    const m = r.contributions.monetary as { grossPriceMoveVnd: number; feesVnd: number; realizedPnlVnd: number };
    expect(m.grossPriceMoveVnd - m.feesVnd).toBe(m.realizedPnlVnd);
  });
  it("is deterministic (same input → same result + hash)", () => {
    expect(attr({ ed: { confidence: 0.7 } })).toEqual(attr({ ed: { confidence: 0.7 } }));
  });
  it("imports no LLM client in the attribution modules", () => {
    const dir = join(process.cwd(), "src", "lib", "paper-lab", "dna");
    for (const f of readdirSync(dir).filter((x) => x.startsWith("attribution") && x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const imports = [...readFileSync(join(dir, f), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const s of imports) expect(/openai|anthropic|llm/i.test(s), `${f} imports ${s}`).toBe(false);
    }
  });
});
