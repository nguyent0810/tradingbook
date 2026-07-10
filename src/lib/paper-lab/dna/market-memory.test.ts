import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { neutralManagerState } from "@/lib/paper-lab/dna/manager-state";
import { evaluateManager } from "@/lib/paper-lab/dna/evaluate-manager";
import {
  computeMarketMemory,
  computeMemoryModulation,
  deriveSetupOutcomes,
  type MarketMemory,
  type SetupOutcomeRecord,
  type StyleRates,
  type StyleTag,
} from "@/lib/paper-lab/dna/market-memory";

function rec(style: StyleTag, date: string, worked: boolean, failedFast = false, windowClose = date, regime: "Bull" | "Bear" | "Sideways" = "Bull"): SetupOutcomeRecord {
  return { sessionDate: date, windowCloseDate: windowClose, styleTag: style, regimeTag: regime, forwardReturnPct: worked ? 5 : failedFast ? -5 : 0, worked, failedFast };
}
function rates(o: Partial<StyleRates>): StyleRates {
  return { successRate20: 0.5, successRate60: 0.5, successRate120: 0.5, falseBreakoutRate20: 0.3, falseBreakoutRate60: 0.3, avgForwardReturnPct: 0, byRegime: {}, sampleSize: 30, ...o };
}
function memory(byStyle: Partial<Record<StyleTag, StyleRates>>, extra: Partial<MarketMemory> = {}): MarketMemory {
  return { asOfSession: "2026-07-08", byStyle, marketChurnScore: 0.3, trendPersistence: 0.5, ...extra };
}
function risingBars(n: number, override?: { idx: number; close: number }): Gate2BarInput[] {
  const base = Date.UTC(2026, 0, 1);
  return Array.from({ length: n }, (_, i) => {
    const close = override && override.idx === i ? override.close : 100 + i; // +1/session, exceeds prior high
    return { date: new Date(base + i * 86_400_000), open: close, high: close + 0.1, low: close - 0.1, close, volume: 1000 };
  });
}

describe("no-lookahead", () => {
  it("excludes records whose forward window has not closed by asOf", () => {
    const records = [rec("breakout", "2026-07-01", true, false, "2026-07-06"), rec("breakout", "2026-07-04", true, false, "2026-07-20")];
    const early = computeMarketMemory(records, "2026-07-10");
    expect(early.byStyle.breakout?.sampleSize).toBe(1); // only the record closed by 07-10
    const late = computeMarketMemory(records, "2026-07-25");
    expect(late.byStyle.breakout?.sampleSize).toBe(2);
  });

  it("changing a future bar does not change a past record's outcome", () => {
    const idx = risingBars(80);
    const before = deriveSetupOutcomes(risingBars(80), idx);
    const mutated = deriveSetupOutcomes(risingBars(80, { idx: 78, close: 5 }), idx); // bar far after T+W
    const day = before[3]!.sessionDate; // an early session whose window closed well before idx 78
    const pick = (rs: SetupOutcomeRecord[], d: string) =>
      JSON.stringify(rs.filter((x) => x.sessionDate === d).sort((a, b) => a.styleTag.localeCompare(b.styleTag)));
    expect(pick(mutated, day)).toBe(pick(before, day));
  });
});

describe("base-rate computation", () => {
  it("computes breakout success and false-breakout rates", () => {
    const recs = [...Array(7)].map((_, i) => rec("breakout", `2026-06-0${i + 1}`, true)).concat([...Array(3)].map((_, i) => rec("breakout", `2026-06-1${i}`, false, true)));
    const m = computeMarketMemory(recs, "2026-07-08");
    expect(m.byStyle.breakout?.sampleSize).toBe(10);
    expect(m.byStyle.breakout?.successRate20).toBeCloseTo(0.7);
    expect(m.byStyle.breakout?.falseBreakoutRate20).toBeCloseTo(0.3);
  });
  it("computes mean-reversion success", () => {
    const recs = [...Array(8)].map((_, i) => rec("mean_reversion", `2026-06-0${i + 1}`, true)).concat([...Array(2)].map((_, i) => rec("mean_reversion", `2026-06-1${i}`, false)));
    const m = computeMarketMemory(recs, "2026-07-08");
    expect(m.byStyle.mean_reversion?.successRate20).toBeCloseTo(0.8);
  });
  it("deriveSetupOutcomes produces breakout+trend records on a rising series", () => {
    const recs = deriveSetupOutcomes(risingBars(80), risingBars(80));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.styleTag === "breakout")).toBe(true);
    expect(recs.every((r) => r.windowCloseDate >= r.sessionDate)).toBe(true);
  });
});

describe("manager modulation", () => {
  it("Breakout Hunter reduces risk when false-breakout rate is high", () => {
    const mod = computeMemoryModulation(memory({ breakout: rates({ successRate60: 0.4, falseBreakoutRate20: 0.7, sampleSize: 30 }) }, { marketChurnScore: 0.7 }), getManagerDna("aggressive_investor")!.marketMemory);
    expect(mod.active).toBe(true);
    expect(mod.riskMult).toBeLessThan(1);
    expect(mod.confirmationDelta).toBe(1);
  });
  it("Mean-Reversion Dip increases activity when bounces are working", () => {
    const mod = computeMemoryModulation(memory({ mean_reversion: rates({ successRate60: 0.8, falseBreakoutRate20: 0.1, sampleSize: 30 }) }), getManagerDna("mean_reversion_trader")!.marketMemory);
    expect(mod.active).toBe(true);
    expect(mod.riskMult).toBeGreaterThan(1);
  });
  it("Trend Rider reduces entries when trend persistence decays", () => {
    const mod = computeMemoryModulation(memory({ trend: rates({ successRate60: 0.5, sampleSize: 30 }) }, { trendPersistence: 0.2 }), getManagerDna("trend_follower")!.marketMemory);
    expect(mod.riskMult).toBeLessThan(1);
  });
  it("is neutral when the sample size is too small", () => {
    const mod = computeMemoryModulation(memory({ breakout: rates({ sampleSize: 3 }) }), getManagerDna("aggressive_investor")!.marketMemory);
    expect(mod.active).toBe(false);
    expect(mod.riskMult).toBe(1);
  });
});

describe("determinism & flag safety", () => {
  const state = neutralManagerState("a", 500_000_000);
  function buyBundle(): MarketContextBundle {
    return {
      symbol: "TST",
      price: { closeKVnd: 20, openKVnd: 20, highKVnd: 20.5, lowKVnd: 19.5, prevCloseKVnd: 20, changePct: 0, barsAvailable: 200 },
      volume: { volRatioMa20: 2 },
      technicals: { ma20: 19, ma50: 18, atr14KVnd: 0.5, range20dHigh: 21, range20dLow: 18 },
      relativeStrength: { returns: [{ lookbackSessions: 20, rsSpreadPct: 5 }, { lookbackSessions: 50, rsSpreadPct: 6 }], dualUptrendMa50: true, stockAboveMa50: true },
      earlyEntry: null,
      gate2Setup: { quality: "A", breakoutLevel: 20, pullbackZoneLow: 18.5, pullbackZoneHigh: 20.5, stopLevel: 18.5, close: 20 },
      marketRegime: { gate1Level: "PASS", regimeDimensions: { trendRegime: "StrongBull" }, regimeConfidence: 0.8 },
      agentMemoryRecall: null,
      existingPosition: null,
      portfolioState: { agentId: "a", cashVnd: 500_000_000, navVnd: 500_000_000, exposurePct: 0, openPositionCount: 0, sectorExposure: {} },
    } as unknown as MarketContextBundle;
  }
  const dna = getManagerDna("aggressive_investor")!;

  it("same records → same memory row", () => {
    const recs = [rec("breakout", "2026-06-01", true), rec("breakout", "2026-06-02", false, true)];
    expect(computeMarketMemory(recs, "2026-07-08")).toEqual(computeMarketMemory(recs, "2026-07-08"));
  });

  it("same memory → identical decision", () => {
    const m = memory({ breakout: rates({ successRate60: 0.4, falseBreakoutRate20: 0.7, sampleSize: 30 }) }, { marketChurnScore: 0.7 });
    expect(evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08", memory: m })).toEqual(evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08", memory: m }));
  });

  it("absent memory equals a neutral (small-sample) memory — no behavior change", () => {
    const neutral = memory({ breakout: rates({ sampleSize: 2 }) });
    const withNeutral = evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08", memory: neutral });
    const without = evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08" });
    expect(withNeutral.quantity).toBe(without.quantity);
    expect(withNeutral.confidence).toBe(without.confidence);
  });

  it("high false-breakout memory reduces the BUY size vs neutral", () => {
    const bad = memory({ breakout: rates({ successRate60: 0.4, falseBreakoutRate20: 0.7, sampleSize: 30 }) }, { marketChurnScore: 0.7 });
    const withBad = evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08", memory: bad });
    const without = evaluateManager({ bundle: buyBundle(), dna, state, sessionDate: "2026-07-08" });
    expect(withBad.action).toBe("BUY");
    expect(withBad.quantity!).toBeLessThan(without.quantity!);
  });
});
