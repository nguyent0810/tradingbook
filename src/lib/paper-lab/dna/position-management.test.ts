import { describe, expect, it } from "vitest";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import { neutralManagerState } from "@/lib/paper-lab/dna/manager-state";
import { evaluateManager } from "@/lib/paper-lab/dna/evaluate-manager";

const state = neutralManagerState("a", 500_000_000);
const SESSION = "2026-07-08";

interface PosKnobs {
  close: number; entry?: number; stop?: number; tp?: number; qty?: number;
  holdingDays?: number; addsCount?: number; partialsCount?: number; initialRisk?: number;
  trend?: string; gate1?: "PASS" | "WARNING" | "FAIL";
}

function posBundle(k: PosKnobs): MarketContextBundle {
  const entry = k.entry ?? 20;
  const stop = k.stop ?? 18.5;
  return {
    symbol: "TST",
    price: { closeKVnd: k.close, openKVnd: k.close, highKVnd: k.close * 1.02, lowKVnd: k.close * 0.98, prevCloseKVnd: k.close, changePct: 0, barsAvailable: 200 },
    volume: { volume: 1_000_000, volMa20: 500_000, volRatioMa20: 2 },
    technicals: { ma20: 19, ma50: 18, atr14KVnd: 0.5, range20dHigh: 22, range20dLow: 18 },
    relativeStrength: { returns: [{ lookbackSessions: 20, rsSpreadPct: 5 }, { lookbackSessions: 50, rsSpreadPct: 6 }], dualUptrendMa50: true, stockAboveMa50: true },
    earlyEntry: null,
    gate2Setup: { quality: "A", breakoutLevel: 20, pullbackZoneLow: 18.5, pullbackZoneHigh: 20.5, stopLevel: stop, close: k.close },
    marketRegime: { gate1Level: k.gate1 ?? "PASS", regimeDimensions: { trendRegime: k.trend ?? "StrongBull" }, regimeConfidence: 0.8 },
    agentMemoryRecall: null,
    portfolioState: { agentId: "a", cashVnd: 500_000_000, navVnd: 500_000_000, exposurePct: 0, openPositionCount: 1, sectorExposure: {} },
    existingPosition: {
      positionId: "p1", quantity: k.qty ?? 1000, entryPriceKVnd: entry, stopLossKVnd: stop, takeProfitKVnd: k.tp ?? 26,
      unrealizedPnlVnd: 0, holdingDays: k.holdingDays ?? 3, status: "OPEN",
      initialRiskPerShareKvnd: k.initialRisk ?? (entry - stop), highWaterMarkKvnd: entry, trailingStopKvnd: stop,
      addsCount: k.addsCount ?? 0, partialsCount: k.partialsCount ?? 0, maxFavorableExcursionKvnd: 0, maxAdverseExcursionKvnd: 0,
    },
  } as unknown as MarketContextBundle;
}

function evalFor(slug: string, k: PosKnobs) {
  return evaluateManager({ bundle: posBundle(k), dna: getManagerDna(slug)!, state, sessionDate: SESSION });
}

describe("ADD lifecycle", () => {
  it("adds when a winner reaches the trigger R and adds remain", () => {
    // Breakout Hunter: add.triggerAtR 1, maxAdds 1. entry 20 stop 18.5 (R 1.5), close 21.5 → gainR 1.
    const d = evalFor("aggressive_investor", { close: 21.5 });
    expect(d.action).toBe("ADD");
    expect(d.reason_codes).toContain("ADD_PYRAMID");
    expect(d.quantity && d.quantity % 100).toBe(0);
    expect(d.entry_price).toBe(21.5);
    expect(d.stop_loss).toBe(18.5);
  });

  it("respects maxAdds (no further add)", () => {
    const d = evalFor("aggressive_investor", { close: 21.5, addsCount: 1 });
    expect(d.action).toBe("HOLD");
    expect(d.reason_codes).toEqual(["HOLD_MANAGED"]);
  });
});

describe("REDUCE lifecycle", () => {
  it("takes a partial at the target R (once)", () => {
    // Swing Tactician: reduce.partialAtR 1, reduceFraction 0.5. gainR 1 at close 21.5.
    const d = evalFor("swing_trader", { close: 21.5, qty: 1000 });
    expect(d.action).toBe("REDUCE");
    expect(d.reason_codes).toContain("REDUCE_PARTIAL_PROFIT");
    expect(d.quantity).toBe(500); // floor(1000 * 0.5 / 100) * 100
  });

  it("does not reduce twice", () => {
    const d = evalFor("swing_trader", { close: 21.5, qty: 1000, partialsCount: 1 });
    expect(d.action).toBe("HOLD");
  });
});

describe("EXIT lifecycle", () => {
  it("exits on the time stop", () => {
    const d = evalFor("swing_trader", { close: 20, holdingDays: 10 }); // maxHoldingDays 10
    expect(d.action).toBe("EXIT");
    expect(d.reason_codes).toContain("EXIT_TIME_STOP");
  });

  it("exits dead money (held past deadMoney.days below minR)", () => {
    const d = evalFor("swing_trader", { close: 20, holdingDays: 6 }); // deadMoney {days:5, minR:0.2}; gainR 0
    expect(d.action).toBe("EXIT");
    expect(d.reason_codes).toContain("EXIT_DEAD_MONEY");
  });

  it("exits on a regime downgrade", () => {
    const d = evalFor("trend_follower", { close: 20, trend: "WeakBear" }); // regimeExitAtOrBelow WeakBear
    expect(d.action).toBe("EXIT");
    expect(d.reason_codes).toContain("EXIT_REGIME");
  });

  it("exits on setup invalidation (close below stop)", () => {
    const d = evalFor("aggressive_investor", { close: 18 }); // stop 18.5
    expect(d.action).toBe("EXIT");
    expect(d.reason_codes).toContain("EXIT_SETUP_INVALIDATION");
  });
});
