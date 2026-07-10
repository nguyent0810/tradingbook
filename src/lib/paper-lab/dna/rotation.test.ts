import { describe, expect, it } from "vitest";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { neutralManagerState } from "@/lib/paper-lab/dna/manager-state";
import { evaluateRotation, opportunityScore, weakestHoldingScore } from "@/lib/paper-lab/dna/rotation";

const state = neutralManagerState("a", 500_000_000);
const SESSION = "2026-07-08";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface MK {
  nav: number; cash: number; openCount: number;
  close?: number; quality?: "A" | "B" | null; rs20?: number; rs50?: number; dual?: boolean; aboveMa50?: boolean;
  trend?: string; gate1?: "PASS" | "WARNING" | "FAIL"; breakoutLevel?: number;
  pos?: { entry: number; stop: number; qty: number; holdingDays: number; initialRisk: number };
}
function mk(symbol: string, o: MK): MarketContextBundle {
  const close = o.close ?? 20;
  return {
    symbol,
    price: { closeKVnd: close, openKVnd: close, highKVnd: close * 1.02, lowKVnd: close * 0.98, prevCloseKVnd: close, changePct: 0, barsAvailable: 200 },
    volume: { volRatioMa20: 2 },
    technicals: { ma20: 19, ma50: 18, atr14KVnd: 0.5, range20dHigh: 25, range20dLow: 18 },
    relativeStrength: { returns: [{ lookbackSessions: 20, rsSpreadPct: o.rs20 ?? 6 }, { lookbackSessions: 50, rsSpreadPct: o.rs50 ?? 7 }], dualUptrendMa50: o.dual ?? true, stockAboveMa50: o.aboveMa50 ?? true },
    earlyEntry: null,
    gate2Setup: o.quality === null ? null : { quality: o.quality ?? "A", breakoutLevel: o.breakoutLevel ?? 20, pullbackZoneLow: 18.5, pullbackZoneHigh: 20.5, stopLevel: 18.5, close },
    marketRegime: { gate1Level: o.gate1 ?? "PASS", regimeDimensions: { trendRegime: o.trend ?? "StrongBull" }, regimeConfidence: 0.8 },
    agentMemoryRecall: null,
    portfolioState: { agentId: "a", cashVnd: o.cash, navVnd: o.nav, exposurePct: 0, openPositionCount: o.openCount, sectorExposure: {} },
    existingPosition: o.pos ? {
      positionId: symbol, quantity: o.pos.qty, entryPriceKVnd: o.pos.entry, stopLossKVnd: o.pos.stop, takeProfitKVnd: 30,
      unrealizedPnlVnd: 0, holdingDays: o.pos.holdingDays, status: "OPEN",
      initialRiskPerShareKvnd: o.pos.initialRisk, highWaterMarkKvnd: o.pos.entry, trailingStopKvnd: o.pos.stop,
      addsCount: 0, partialsCount: 0, maxFavorableExcursionKvnd: 0, maxAdverseExcursionKvnd: 0,
    } : null,
  } as unknown as MarketContextBundle;
}

const rot = (slug: string, bundles: MarketContextBundle[], rotationsToday = 0) =>
  evaluateRotation({ dna: getManagerDna(slug)!, state, sessionDate: SESSION, bundles, rotationsToday });

describe("rotation scoring", () => {
  const dna = getManagerDna("momentum_investor")!;
  it("scores a stronger candidate higher", () => {
    const strong = mk("S", { nav: 5e8, cash: 5e8, openCount: 0, quality: "A", rs20: 9, rs50: 10, trend: "StrongBull" });
    const weak = mk("W", { nav: 5e8, cash: 5e8, openCount: 0, quality: null, rs20: 1, rs50: 1, trend: "Sideways" });
    expect(opportunityScore(strong, dna)).toBeGreaterThan(opportunityScore(weak, dna));
  });
  it("scores a losing/old holding weaker than a winning fresh one", () => {
    const loser = mk("L", { nav: 5e8, cash: 5e8, openCount: 1, close: 18.8, pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 20, initialRisk: 1.5 } });
    const winner = mk("Wn", { nav: 5e8, cash: 5e8, openCount: 1, close: 24, pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 2, initialRisk: 1.5 } });
    expect(weakestHoldingScore(loser, dna)).toBeLessThan(weakestHoldingScore(winner, dna));
  });
});

describe("rotation firing", () => {
  // RS Rotator, at max slots (5), strong candidate, weak holdings → EXIT-to-fund.
  function fullSlots(candidateRs = 10, holdingClose = 18.8) {
    const holds = [0, 1, 2, 3, 4].map((i) => mk(`H${i}`, { nav: 5e8, cash: 5e8, openCount: 5, close: holdingClose, pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 20, initialRisk: 1.5 } }));
    const cand = mk("CAND", { nav: 5e8, cash: 5e8, openCount: 5, quality: "A", rs20: 8, rs50: candidateRs, trend: "StrongBull" });
    return [...holds, cand];
  }

  it("fires when the score gap clears the threshold (EXIT-to-fund at max slots)", () => {
    const plan = rot("momentum_investor", fullSlots());
    expect(plan.kind).toBe("rotate");
    if (plan.kind === "rotate") {
      expect(plan.laggardAction).toBe("EXIT");
      expect(plan.rotatedInSymbol).toBe("CAND");
      expect(plan.scoreGap).toBeGreaterThan(0);
      expect(plan.items.map((i) => i.decision.action)).toEqual(["EXIT", "BUY"]);
      expect(plan.items[0].decision.reason_codes).toContain("ROTATE_EXIT_LAGGARD");
      expect(plan.items[1].decision.reason_codes).toContain("ROTATE_INTO_LEADER");
    }
  });

  it("is blocked when the score gap is below threshold", () => {
    // Strong, fresh holdings + a modest candidate → negative gap.
    const holds = [0, 1, 2, 3, 4].map((i) => mk(`H${i}`, { nav: 5e8, cash: 5e8, openCount: 5, close: 30, pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 1, initialRisk: 1.5 } }));
    const cand = mk("CAND", { nav: 5e8, cash: 5e8, openCount: 5, quality: null, rs20: 6, rs50: 5, trend: "StrongBull" });
    const plan = rot("momentum_investor", [...holds, cand]);
    expect(plan.kind).toBe("blocked");
    if (plan.kind === "blocked") expect(plan.reason).toBe("ROTATE_THRESHOLD_NOT_MET");
  });

  it("is blocked by an unclean regime when requireCleanRegime is set", () => {
    // All-Weather requires a clean (PASS + Bull) regime to rotate; Sideways is not clean.
    const holds = [0, 1, 2, 3, 4].map((i) => mk(`H${i}`, { nav: 5e8, cash: 5e8, openCount: 5, close: 18.8, trend: "Sideways", pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 20, initialRisk: 1.5 } }));
    const cand = mk("CAND", { nav: 5e8, cash: 5e8, openCount: 5, quality: "A", trend: "Sideways", breakoutLevel: 20 });
    const plan = rot("safe_investor", [...holds, cand]);
    expect(plan.kind).toBe("blocked");
    if (plan.kind === "blocked") expect(plan.reason).toBe("ROTATE_BLOCKED_REGIME");
  });

  it("respects maxRotationsPerDay", () => {
    const plan = rot("momentum_investor", fullSlots(), 2); // RS maxRotationsPerDay = 2
    expect(plan.kind).toBe("blocked");
    if (plan.kind === "blocked") expect(plan.reason).toBe("ROTATE_CAP_REACHED");
  });

  it("REDUCE-to-funds when a slot is free but exposure is full and a partial covers it", () => {
    // Pullback Operator: reduceVsExitBias 0.3; slot free (openCount 1 < 5), ~64% invested.
    const weak = mk("WEAK", { nav: 5e8, cash: 1.8e8, openCount: 1, close: 20, dual: true, aboveMa50: true, pos: { entry: 20, stop: 18.5, qty: 16000, holdingDays: 15, initialRisk: 1.5 } });
    const cand = mk("CAND", { nav: 5e8, cash: 1.8e8, openCount: 1, quality: "A", dual: true, aboveMa50: true, trend: "StrongBull", close: 20, breakoutLevel: 19 });
    const plan = rot("value_investor", [weak, cand]);
    expect(plan.kind).toBe("rotate");
    if (plan.kind === "rotate") {
      expect(plan.laggardAction).toBe("REDUCE");
      expect(plan.items[0].decision.action).toBe("REDUCE");
      expect(plan.items[0].decision.quantity).toBeGreaterThan(0);
      expect(plan.items[0].decision.reason_codes).toContain("ROTATE_REDUCE_LAGGARD");
    }
  });

  it("produces a deterministic rotationGroupId", () => {
    const a = rot("momentum_investor", fullSlots());
    const b = rot("momentum_investor", fullSlots());
    expect(a.kind).toBe("rotate");
    if (a.kind === "rotate" && b.kind === "rotate") {
      expect(a.rotationGroupId).toBe(b.rotationGroupId);
      expect(a.rotationGroupId).toMatch(UUID_RE);
    }
  });

  it("returns none for a rotation-disabled manager", () => {
    const holds = [mk("H", { nav: 5e8, cash: 5e8, openCount: 4, close: 18.8, pos: { entry: 20, stop: 18.5, qty: 2000, holdingDays: 20, initialRisk: 1.5 } })];
    const cand = mk("CAND", { nav: 5e8, cash: 5e8, openCount: 4, quality: "A", dual: true, aboveMa50: true });
    expect(rot("trend_follower", [...holds, cand]).kind).toBe("none"); // Trend Rider rotation disabled
  });
});
